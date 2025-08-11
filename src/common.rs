use std::{collections::HashSet, path::PathBuf, sync::Arc, time::SystemTime};

use serde::{Deserialize, Serialize};
use tokio::{fs, sync::RwLock};

use crate::util::MyResult;

pub const DIR_PATH: &str = "./.video-sort";
pub const MAX_CONCURRENT_FFMPEG: usize = 1;

pub type SharedState = Arc<RwLock<State>>;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Video {
    path: PathBuf,
    /// usable as an ID for the video
    pub thumbnail_name: String,
    pub tags: HashSet<String>,
    pub note: String,
    pub mtime: SystemTime,
    pub size: u64,
    pub probe: Option<ProbeResult>,
    /// currently unused, but will be used for stowing videos in Termux to avoid
    /// persecution by Google Photos, or for making it easier to find a
    /// particular video in an app's file selector
    stow_state: StowState,
}

impl Video {
    pub fn new(path: PathBuf, thumbnail_name: String, mtime: SystemTime, size: u64) -> Self {
        Self {
            path,
            thumbnail_name,
            tags: HashSet::new(),
            note: String::new(),
            mtime,
            size,
            probe: None,
            stow_state: StowState::Original,
        }
    }

    // returns the path to the current location of the video file contents, which may not
    // be its original path
    pub fn current_loc(&self) -> &PathBuf {
        match &self.stow_state {
            StowState::Original => &self.path,
            StowState::Elsewhere(path) => path,
        }
    }

    // returns the file name
    pub fn display_name(&self) -> String {
        self.path.file_name().map_or_else(
            || String::from(".mp4"),
            |name| name.to_string_lossy().to_string(),
        )
    }

    pub async fn move_file(&mut self, new_path: PathBuf) -> MyResult<()> {
        match self.stow_state {
            StowState::Original => {
                fs::rename(&self.path, &new_path).await?;
                self.stow_state = StowState::Elsewhere(new_path);
            }
            StowState::Elsewhere(_) => Err("i'm already elsewhere")?,
        }
        Ok(())
    }

    pub async fn restore_file(&mut self) -> MyResult<()> {
        match &self.stow_state {
            StowState::Original => {}
            StowState::Elsewhere(path) => {
                fs::rename(path, &self.path).await?;
            }
        }
        self.stow_state = StowState::Original;
        Ok(())
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
enum StowState {
    Original,
    Elsewhere(PathBuf),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProbeResult {
    pub width: u32,
    pub height: u32,
    pub duration: f64,
    pub rotation: Rotation,
    // stuff to match stream settings (excl codec, which I am forcing to be
    // h264)
    pub pix_fmt: String,
    pub color_space: Option<String>,
    pub color_transfer: Option<String>,
    pub color_primaries: Option<String>,
    pub bit_rate: u32, // oops bitrate does not matter
    pub audio: Option<AudioProbeResult>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AudioProbeResult {
    // stuff to match stream settings (excl codec, which I am forcing to be aac)
    pub sample_rate: u32,
    pub bit_rate: u32,
    pub channels: u32,
    pub channel_layout: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum Rotation {
    Unrotated,
    Neg90,
    Pos90,
    Neg180,
}

impl Rotation {
    pub fn transposed(&self) -> bool {
        match self {
            Rotation::Unrotated => false,
            Rotation::Neg90 => true,
            Rotation::Pos90 => true,
            Rotation::Neg180 => false,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct State {
    pub videos: Vec<Video>,
    pub version: Option<String>,
}

pub async fn save_state(state: &State) -> MyResult<()> {
    fs::write(
        format!("{DIR_PATH}/state.json"),
        serde_json::to_string_pretty(state)?,
    )
    .await?;
    Ok(())
}
