use std::path::PathBuf;

use serde::Deserialize;

use crate::common::{ProbeResult, Rotation};

pub struct CookClip {
    pub video_path: PathBuf,
    pub probe: ProbeResult,
    pub start: f64,
    pub end: f64,
    pub override_rotation: Option<Rotation>,
}

#[derive(Deserialize, Debug)]
pub struct FfprobeVideoStream {
    pub width: u32,
    pub height: u32,
    pub pix_fmt: String,
    pub color_space: Option<String>,
    pub color_transfer: Option<String>,
    pub color_primaries: Option<String>,
    pub bit_rate: String,
    pub side_data_list: Option<(FfprobeVideoStreamSideData,)>,
}

#[derive(Deserialize, Debug)]
pub struct FfprobeVideoStreamSideData {
    pub rotation: i32,
}

#[derive(Deserialize, Debug)]
pub struct FfprobeOutputFormat {
    pub duration: String,
}

#[derive(Deserialize, Debug)]
pub struct FfprobeVideo {
    pub streams: (FfprobeVideoStream,),
    pub format: FfprobeOutputFormat,
}

#[derive(Deserialize, Debug)]
pub struct FfprobeAudioStream {
    pub sample_rate: String,
    pub channels: u32,
    pub channel_layout: String,
    pub bit_rate: String,
}

#[derive(Deserialize, Debug)]
pub struct FfprobeAudio {
    pub streams: Vec<FfprobeAudioStream>,
}
