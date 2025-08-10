use std::{collections::HashSet, path::PathBuf, sync::Arc, time::SystemTime};

use serde::{Deserialize, Serialize};
use tokio::{fs, sync::RwLock};

use crate::util::MyResult;

pub const DIR_PATH: &str = "./.video-sort";
pub const MAX_CONCURRENT_FFMPEG: usize = 10;

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
    #[serde(rename = "preview2")]
    pub preview: Option<Preview>,
    /// currently unused, but will be used for stowing videos in Termux to avoid
    /// persecution by Google Photos
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
            preview: None,
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
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum StowState {
    Original,
    Elsewhere(PathBuf),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Preview {
    pub size: u64,
    pub original_width: u32,
    pub original_height: u32,
    pub original_duration: f64,
    pub original_rotation: Rotation,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Rotation {
    Unrotated,
    Neg90,
    Pos90,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct State {
    pub videos: Vec<Video>,
}

pub async fn save_state(state: &State) -> MyResult<()> {
    fs::write(
        format!("{DIR_PATH}/state.json"),
        serde_json::to_string_pretty(state)?,
    )
    .await?;
    Ok(())
}
