use std::{collections::HashSet, path::PathBuf, sync::Arc, time::SystemTime};

use serde::{Deserialize, Serialize};
use tokio::{fs, sync::RwLock};

pub const DIR_PATH: &str = "./.video-sort";

pub type BoxedError = Box<dyn std::error::Error + Send + Sync>;
pub type MyResult<T> = Result<T, BoxedError>;
pub type SharedState = Arc<RwLock<State>>;

#[derive(Serialize, Deserialize, Debug)]
pub struct Video {
    pub path: PathBuf,
    pub thumbnail_name: String,
    pub tags: HashSet<String>,
    pub note: String,
    pub mtime: SystemTime,
    pub size: u64,
    /// currently unused, but will be used for stowing videos in Termux to avoid
    /// persecution by Google Photos
    pub stow_state: StowState,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum StowState {
    Original,
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

const KILOBYTE: u64 = 1000;
const MEGABYTE: u64 = 1000 * KILOBYTE;
const GIGABYTE: u64 = 1000 * MEGABYTE;
const TERABYTE: u64 = 1000 * GIGABYTE;

pub fn format_size(size: u64) -> String {
    if size >= TERABYTE {
        format!("{:.2} TB", size as f64 / TERABYTE as f64)
    } else if size >= GIGABYTE {
        format!("{:.2} GB", size as f64 / GIGABYTE as f64)
    } else if size >= MEGABYTE {
        format!("{:.2} MB", size as f64 / MEGABYTE as f64)
    } else if size >= KILOBYTE {
        format!("{:.2} KB", size as f64 / KILOBYTE as f64)
    } else {
        format!("{size} B")
    }
}
