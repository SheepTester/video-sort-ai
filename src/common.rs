use std::{collections::HashSet, path::PathBuf, sync::Arc, time::SystemTime};

use serde::{Deserialize, Serialize};
use tokio::{fs, sync::RwLock};

use crate::util::MyResult;

pub const DIR_PATH: &str = "./.video-sort";

pub type SharedState = Arc<RwLock<State>>;

#[derive(Serialize, Deserialize, Debug)]
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

#[derive(Serialize, Deserialize, Debug)]
pub enum StowState {
    Original,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Preview {
    size: u64,
    original_width: u32,
    original_height: u32,
}

#[derive(Serialize, Deserialize, Debug)]
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
