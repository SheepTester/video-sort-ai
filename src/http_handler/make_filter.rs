use std::collections::HashSet;

use tokio::process::Command;

use crate::{
    common::{State, Video},
    http_handler::defs::CookReq,
    util::MyResult,
};

struct CookClip<'a> {
    video: &'a Video,
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
                .map(|video| CookClip {
                    video,
                    start: clip.start,
                    end: clip.end,
                })
        })
        .collect::<Vec<_>>();
    let (width, height) = match request
        .sizing
        .as_ref()
        .and_then(|thumb| {
            state
                .videos
                .iter()
                .find(|video| video.thumbnail_name == *thumb)
        })
        .and_then(|video| video.preview.as_ref())
    {
        Some(preview) => (preview.original_width, preview.original_height),
        None => (
            clips
                .iter()
                .map(|clip| clip.video.preview.as_ref().map_or(0, |p| p.original_width))
                .max()
                .unwrap_or(0),
            clips
                .iter()
                .map(|clip| clip.video.preview.as_ref().map_or(0, |p| p.original_height))
                .max()
                .unwrap_or(0),
        ),
    };
    let aspect_ratio = width as f64 / height as f64;
    let inputs_sets = clips
        .iter()
        .map(|v| v.video.path.clone())
        .collect::<HashSet<_>>();
    let inputs = inputs_sets.iter().collect::<Vec<_>>();
    let mut filters = String::new();
    let mut concat = String::new();
    for (i, clip) in clips.iter().enumerate() {
        let Some(clip_index) = inputs.iter().position(|input| **input == clip.video.path) else {
            Err("clip video missing in inputs")?
        };
        let Some(ref preview) = clip.video.preview else {
            Err("clip video has no dimensions computed")?
        };
        let my_aspect_ratio = preview.original_width as f64 / preview.original_height as f64;
        let need_bg = my_aspect_ratio != aspect_ratio;
        // trim video
        filters.push_str(&format!(
            "[{clip_index}:v] trim = start={} : end={}, setpts=PTS-STARTPTS",
            clip.start, clip.end
        ));
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
                "[clip{i}v_trimmed] scale = {} [clip{i}v_scaled]; ",
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
            let cropped_width = preview
                .original_width
                .min(preview.original_height * width / height);
            let cropped_height = preview
                .original_height
                .min(preview.original_width * height / width);
            let crop = format!(
                "{cropped_width}:{cropped_height}:{}:{}",
                (preview.original_width - cropped_width) / 2,
                (preview.original_height - cropped_height) / 2
            );
            const DOWNSCALE_FACTOR: u32 = 3;
            let downscale = format!("{}:{}", width / DOWNSCALE_FACTOR, height / DOWNSCALE_FACTOR);
            // split up long strings because they break rustfmt
            filters.push_str(&format!(
                "[clip{i}v_trimmed_copy] crop = {}, scale = {}, ",
                crop, downscale,
            ));
            filters.push_str(&format!(
                "gblur = sigma={}, scale = {width}:{height} [clip{i}v_blurred]; ",
                (width / DOWNSCALE_FACTOR) as f64 / 5.0,
            ));
            filters.push_str(&format!("[clip{i}v_blurred] [clip{i}v_scaled] "));
            filters.push_str(&format!("overlay [clip{i}v_overlain]; ",));
            format!("[clip{i}v_overlain]")
        } else if preview.original_width != width || preview.original_height != height {
            // aspect ratio is the same, just need to scale up/down
            filters.push_str(&format!(
                "[clip{i}v_trimmed] scale = {width}:{height} [clip{i}v_scaled]; "
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
        command.arg("-i").arg(input);
    }
    command.arg("-filter_complex").arg(filters);
    // specify what the outputs are
    command.arg("-map").arg("[outv]");
    command.arg("-map").arg("[outa]");
    // should be fine if we overwrite whatever's there. just in case, so it
    // doesn't get blocked by the yes thing
    command.arg("-y");
    command.arg(output_path);

    Ok(())
}
