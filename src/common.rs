use std::{collections::HashSet, path::PathBuf, sync::Arc, time::SystemTime};

use serde::{Deserialize, Serialize};
use tokio::{fs, sync::RwLock};

use crate::util::MyResult;

pub const DIR_PATH: &str = "./.video-sort";
pub const MAX_CONCURRENT_FFMPEG: usize = 10;

pub type SharedState = Arc<RwLock<State>>;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Video {
    pub path: PathBuf,
    pub thumbnail_name: String,
    pub tags: HashSet<String>,
    pub note: String,
    pub mtime: SystemTime,
    pub size: u64,
    pub preview: Option<Preview>,
    /// currently unused, but will be used for stowing videos in Termux to avoid
    /// persecution by Google Photos
    pub stow_state: StowState,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum StowState {
    Original,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Preview {
    pub size: u64,
    pub original_width: u32,
    pub original_height: u32,
    pub original_duration: f64,
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
