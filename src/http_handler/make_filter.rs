use std::{collections::HashSet, path::PathBuf};

use tokio::process::Command;

use crate::{
    common::{Preview, State},
    http_handler::defs::CookReq,
    util::MyResult,
};

struct CookClip<'a> {
    video_path: &'a PathBuf,
    preview: &'a Preview,
    start: f64,
    end: f64,
}

pub fn make_filter(
    state: &State,
    request: &CookReq,
    command: &mut Command,
    output_path: &str,
) -> MyResult<()> {
    let clips = request
        .clips
        .iter()
        .filter_map(|clip| {
            state
                .videos
                .iter()
                .find(|video| video.thumbnail_name == clip.thumbnail_name)
                .and_then(|video| {
                    video.preview.as_ref().map(|preview| CookClip {
                        video_path: video.current_loc(),
                        preview: &preview,
                        start: clip.start,
                        end: clip.end,
                    })
                })
        })
        .collect::<Vec<_>>();
    let width = request.width;
    let height = request.height;
    let aspect_ratio = width as f64 / height as f64;
    let inputs_sets = clips
        .iter()
        .map(|v| v.video_path.clone())
        .collect::<HashSet<_>>();
    let inputs = inputs_sets.iter().collect::<Vec<_>>();
    let mut filters = String::new();
    let mut concat = String::new();
    for (i, clip) in clips.iter().enumerate() {
        let Some(clip_index) = inputs.iter().position(|input| *input == clip.video_path) else {
            Err("clip video missing in inputs")?
        };
        let my_aspect_ratio =
            clip.preview.original_width as f64 / clip.preview.original_height as f64;
        let need_bg = my_aspect_ratio != aspect_ratio;
        // trim video
        filters.push_str(&format!(
            "[{clip_index}:v] trim = start={} : end={}, setpts=PTS-STARTPTS",
            clip.start, clip.end
        ));
        match clip.preview.original_rotation {
            crate::common::Rotation::Unrotated => {}
            crate::common::Rotation::Neg90 => filters.push_str(&format!(
                ", transpose = dir=clock : passthrough={}",
                if my_aspect_ratio > 1.0 {
                    "landscape"
                } else {
                    "portrait"
                }
            )),
            crate::common::Rotation::Pos90 => filters.push_str(&format!(
                ", transpose = dir=cclock : passthrough={}",
                if my_aspect_ratio > 1.0 {
                    "landscape"
                } else {
                    "portrait"
                }
            )),
        }
        if need_bg {
            filters.push_str(&format!(
                ", split [clip{i}v_trimmed] [clip{i}v_trimmed_copy]; "
            ));
        } else {
            filters.push_str(&format!(" [clip{i}v_trimmed]; "));
        }
        filters.push_str(&format!(
            "[{clip_index}:a] atrim = start={} : end={}, asetpts=PTS-STARTPTS [clip{i}a_trimmed]; ",
            clip.start, clip.end
        ));

        let output_name = if need_bg {
            filters.push_str(&format!(
                "[clip{i}v_trimmed] scale = {}, setsar = 1 [clip{i}v_scaled]; ",
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
            let cropped_width = clip
                .preview
                .original_width
                .min(clip.preview.original_height * width / height);
            let cropped_height = clip
                .preview
                .original_height
                .min(clip.preview.original_width * height / width);
            const DOWNSCALE_FACTOR: u32 = 3;
            const BLUR_FACTOR: f64 = 0.1;
            // split up long strings because they break rustfmt
            filters.push_str(&format!(
                "[clip{i}v_trimmed_copy] crop = {cropped_width}:{cropped_height}:{}:{}, ",
                (clip.preview.original_width - cropped_width) / 2,
                (clip.preview.original_height - cropped_height) / 2,
            ));
            filters.push_str(&format!(
                "scale = {}:{}, gblur = sigma={}, scale = {width}:{height}, ",
                width / DOWNSCALE_FACTOR,
                height / DOWNSCALE_FACTOR,
                (width / DOWNSCALE_FACTOR) as f64 * BLUR_FACTOR,
            ));
            filters.push_str(&format!("setsar = 1 [clip{i}v_blurred]; "));
            filters.push_str(&format!("[clip{i}v_blurred] [clip{i}v_scaled] "));
            filters.push_str(&format!(
                "overlay = (main_w-overlay_w)/2:(main_h-overlay_h)/2 [clip{i}v_overlain]; "
            ));
            format!("[clip{i}v_overlain]")
        } else if clip.preview.original_width != width || clip.preview.original_height != height {
            // aspect ratio is the same, just need to scale up/down
            filters.push_str(&format!(
                "[clip{i}v_trimmed] scale = {width}:{height}, setsar = 1 [clip{i}v_scaled]; "
            ));
            format!("[clip{i}v_scaled]")
        } else {
            format!("[clip{i}v_trimmed]")
        };
        concat.push_str(&format!("{output_name} [clip{i}a_trimmed] "));
    }
    // 1 video stream, 1 audio stream
    concat.push_str(&format!(
        "concat = n={} : v=1 : a=1 [outv] [outa]",
        clips.len()
    ));
    filters.push_str(&concat);
    for input in inputs {
        // remove rotation metadata i think
        command.arg("-display_rotation").arg("0");
        command.arg("-i").arg(input);
    }
    command.arg("-filter_complex").arg(filters);
    // specify what the outputs are
    command.arg("-map").arg("[outv]");
    command.arg("-map").arg("[outa]");
    // set rotation to 0 (termux ffmpeg seems to copy it)
    command.arg("-metadata:s:v").arg("rotate=0");
    // should be fine if we overwrite whatever's there. just in case, so it
    // doesn't get blocked by the yes thing
    command.arg("-y");
    command.arg(output_path);

    Ok(())
}
