use std::path::PathBuf;

use serde::Deserialize;
use serde_json::from_str;
use tokio::process::Command;

use crate::{
    common::{AudioProbeResult, ProbeResult, Rotation},
    util::MyResult,
};

pub struct CookClip {
    pub video_path: PathBuf,
    pub probe: ProbeResult,
    pub start: f64,
    pub end: f64,
    pub override_rotation: Option<Rotation>,
}

#[derive(Deserialize, Debug)]
struct FfprobeVideoStream {
    width: u32,
    height: u32,
    pix_fmt: String,
    color_space: Option<String>,
    color_transfer: Option<String>,
    color_primaries: Option<String>,
    bit_rate: String,
    side_data_list: Option<(FfprobeVideoStreamSideData,)>,
}

#[derive(Deserialize, Debug)]
struct FfprobeVideoStreamSideData {
    rotation: i32,
}

#[derive(Deserialize, Debug)]
struct FfprobeOutputFormat {
    duration: String,
}

#[derive(Deserialize, Debug)]
struct FfprobeVideo {
    streams: (FfprobeVideoStream,),
    format: FfprobeOutputFormat,
}

#[derive(Deserialize, Debug)]
struct FfprobeAudioStream {
    sample_rate: String,
    channels: u32,
    channel_layout: String,
    bit_rate: String,
}

#[derive(Deserialize, Debug)]
struct FfprobeAudio {
    streams: Vec<FfprobeAudioStream>,
}

static ENTRIES: &str = "stream=pix_fmt,width,height,bit_rate,color_space,color_transfer,color_primaries:format=duration:stream_side_data=rotation";

pub async fn probe_video(path: &PathBuf) -> MyResult<ProbeResult> {
    let ffprobe_result = Command::new("ffprobe")
        // only print errors
        .arg("-v")
        .arg("error")
        // select one video stream
        .arg("-select_streams")
        .arg("v:0")
        // only print these fields
        .arg("-show_entries")
        .arg(ENTRIES)
        .arg("-output_format")
        .arg("json")
        .arg(path)
        .output()
        .await?;
    if !ffprobe_result.status.success() {
        Err(format!(
            "ffprobe video error:\n{}",
            String::from_utf8_lossy(&ffprobe_result.stderr)
        ))?;
    }
    let ffprobe_output: FfprobeVideo = from_str(&String::from_utf8(ffprobe_result.stdout)?)?;
    let original_rotation = match &ffprobe_output.streams.0.side_data_list {
        Some((FfprobeVideoStreamSideData { rotation: 90 },)) => crate::common::Rotation::Pos90,
        Some((FfprobeVideoStreamSideData { rotation: -90 },)) => crate::common::Rotation::Neg90,
        Some((FfprobeVideoStreamSideData { rotation: -180 },)) => crate::common::Rotation::Neg180,
        None => crate::common::Rotation::Unrotated,
        Some(r) => Err(format!("Unknown rotation {}", r.0.rotation))?,
    };

    let ffprobe_result_audio = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        // select audio stream
        .arg("-select_streams")
        .arg("a:0")
        // only print these fields
        .arg("-show_entries")
        .arg("stream=channels,channel_layout,sample_rate,bit_rate")
        .arg("-output_format")
        .arg("json")
        .arg(path)
        .output()
        .await?;
    if !ffprobe_result_audio.status.success() {
        Err(format!(
            "ffprobe audio error:\n{}",
            String::from_utf8_lossy(&ffprobe_result_audio.stderr)
        ))?;
    }
    let mut ffprobe_output_audio: FfprobeAudio =
        from_str(&String::from_utf8(ffprobe_result_audio.stdout)?)?;

    let (original_width, original_height) = if original_rotation.transposed() {
        (
            ffprobe_output.streams.0.height,
            ffprobe_output.streams.0.width,
        )
    } else {
        (
            ffprobe_output.streams.0.width,
            ffprobe_output.streams.0.height,
        )
    };
    Ok(ProbeResult {
        width: original_width,
        height: original_height,
        duration: ffprobe_output.format.duration.parse()?,
        rotation: original_rotation,
        bit_rate: ffprobe_output.streams.0.bit_rate.parse()?,
        color_primaries: ffprobe_output.streams.0.color_primaries,
        color_space: ffprobe_output.streams.0.color_space,
        color_transfer: ffprobe_output.streams.0.color_transfer,
        pix_fmt: ffprobe_output.streams.0.pix_fmt,
        audio: ffprobe_output_audio
            .streams
            .pop()
            .map(|audio| -> MyResult<AudioProbeResult> {
                Ok(AudioProbeResult {
                    sample_rate: audio.sample_rate.parse()?,
                    bit_rate: audio.bit_rate.parse()?,
                    channels: audio.channels,
                    channel_layout: audio.channel_layout,
                })
            })
            .transpose()?,
    })
}
