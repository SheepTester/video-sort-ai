use tokio::process::Command;

use crate::{common::ProbeResult, http_handler::probe::CookClip, util::MyResult};

pub fn make_clip(
    clip: &CookClip,
    base_encode: &ProbeResult,
    output_path: &str,
) -> MyResult<Command> {
    let mut command = Command::new("ffmpeg");
    // only log errors and stats
    command.arg("-v").arg("error");
    command.arg("-stats");

    command.arg("-display_rotation").arg("0");
    command.arg("-i").arg(&clip.video_path);

    let mut filters = String::new();

    if let Some(audio) = &base_encode.audio {
        if clip.probe.audio.is_some() {
            filters.push_str(&format!(
                "[0:a] atrim = start={} : end={}, asetpts=PTS-STARTPTS [outa]; ",
                clip.start, clip.end
            ));
        } else {
            filters.push_str(&format!(
                "anullsrc = r={} : cl={}, atrim = start=0 : end={}",
                audio.sample_rate,
                audio.channel_layout,
                clip.end - clip.start
            ));
            filters.push_str(", asetpts=PTS-STARTPTS [outa]; ");
        }
    }

    let ProbeResult { width, height, .. } = base_encode;
    let aspect_ratio = *width as f64 / *height as f64;
    let (original_width, original_height) = match &clip.override_rotation {
        // One of them is unrotated and the other is not, so we need to transpose the size
        Some(rot) if rot.transposed() != clip.probe.rotation.transposed() => {
            (clip.probe.height, clip.probe.width)
        }
        _ => (clip.probe.width, clip.probe.height),
    };
    let my_aspect_ratio = original_width as f64 / original_height as f64;
    let need_bg = my_aspect_ratio != aspect_ratio;

    // trim video
    filters.push_str(&format!(
        "[0:v] trim = start={} : end={}, setpts=PTS-STARTPTS",
        clip.start, clip.end
    ));
    match clip
        .override_rotation
        .as_ref()
        .unwrap_or(&clip.probe.rotation)
    {
        crate::common::Rotation::Unrotated => {}
        crate::common::Rotation::Neg90 => filters.push_str(&format!(", transpose = dir=clock")),
        crate::common::Rotation::Pos90 => filters.push_str(&format!(", transpose = dir=cclock")),
        crate::common::Rotation::Neg180 => filters.push_str(&format!(", hflip, vflip")),
    }

    if need_bg {
        filters.push_str(", split [v_trimmed] [v_trimmed_copy]; ");
        filters.push_str(&format!(
            "[v_trimmed] scale = {}, setsar = 1 [v_scaled]; ",
            if my_aspect_ratio >= aspect_ratio {
                // this clip is wider, use their width
                format!("{width}:-1")
            } else {
                format!("-1:{height}")
            }
        ));

        // create the blurred background:
        // 1. crop the video to what is needed (crop =
        //    width:height:x:y)
        // 2. scale the video down
        // 3. blur it
        // 4. scale the video up
        // 5. overlay the actual video
        let cropped_width = original_width.min(original_height * width / height);
        let cropped_height = original_height.min(original_width * height / width);
        const DOWNSCALE_FACTOR: u32 = 3;
        const BLUR_FACTOR: f64 = 0.1;
        // split up long strings because they break rustfmt
        filters.push_str(&format!(
            "[v_trimmed_copy] crop = {cropped_width}:{cropped_height}:{}:{}, ",
            (original_width - cropped_width) / 2,
            (original_height - cropped_height) / 2,
        ));
        filters.push_str(&format!(
            "scale = {}:{}, gblur = sigma={}, scale = {width}:{height}, ",
            width / DOWNSCALE_FACTOR,
            height / DOWNSCALE_FACTOR,
            (width / DOWNSCALE_FACTOR) as f64 * BLUR_FACTOR,
        ));
        filters.push_str(&format!("setsar = 1 [v_blurred]; "));
        filters.push_str(&format!("[v_blurred] [v_scaled] "));
        filters.push_str(&format!(
            "overlay = (main_w-overlay_w)/2:(main_h-overlay_h)/2 [outv]; "
        ));
    } else if original_width != *width || original_height != *height {
        // aspect ratio is the same, just need to scale up/down
        filters.push_str(&format!(", scale = {width}:{height}, setsar = 1 [outv]"));
    } else {
        filters.push_str(" [outv]");
    }

    command.arg("-filter_complex").arg(filters);
    // specify what the outputs are
    command.arg("-map").arg("[outv]");
    if base_encode.audio.is_some() {
        command.arg("-map").arg("[outa]");
    }
    // fast and good quality
    command.arg("-preset").arg("veryfast");
    command.arg("-crf").arg("18");
    command.arg("-c:v").arg("libx264"); // force h264
    command.arg("-pix_fmt").arg(&base_encode.pix_fmt);
    command
        .arg("-color_primaries")
        .arg(base_encode.color_primaries.as_ref().map_or("bt709", |v| v));
    command
        .arg("-color_trc")
        .arg(base_encode.color_transfer.as_ref().map_or("bt709", |v| v));
    command
        .arg("-colorspace")
        .arg(base_encode.color_space.as_ref().map_or("bt709", |v| v));
    command.arg("-fps_mode").arg("vfr"); // force variable frame rate
    if let Some(audio) = &base_encode.audio {
        command.arg("-c:a").arg("aac"); // force aac
        command.arg("-ar").arg(audio.sample_rate.to_string());
        command.arg("-ac").arg(audio.channels.to_string());
        command.arg("-channel_layout").arg(&audio.channel_layout);
    }
    // set rotation to 0 (termux ffmpeg seems to copy it)
    command.arg("-metadata:s:v").arg("rotate=0");
    // 1/90000 time scale, for consistent time base before concat. vfr
    // timestamps are defined in terms of this
    command.arg("-video_track_timescale").arg("90000");
    // make video concattable
    command.arg("-fflags").arg("+genpts");
    // should be fine if we overwrite whatever's there. just in case, so it
    // doesn't get blocked by the yes thing
    command.arg("-y");
    command.arg(output_path);

    Ok(command)
}
