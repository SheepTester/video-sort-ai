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

const KIBIBYTE: u64 = 1024;
const MEBIBYTE: u64 = 1024 * KIBIBYTE;
const GIBIBYTE: u64 = 1024 * MEBIBYTE;
const TEBIBYTE: u64 = 1024 * GIBIBYTE;

pub fn format_size(size: u64) -> String {
    if size >= TEBIBYTE {
        format!("{:.2} TiB", size as f64 / TEBIBYTE as f64)
    } else if size >= GIBIBYTE {
        format!("{:.2} GiB", size as f64 / GIBIBYTE as f64)
    } else if size >= MEBIBYTE {
        format!("{:.2} MiB", size as f64 / MEBIBYTE as f64)
    } else if size >= KIBIBYTE {
        format!("{:.2} KiB", size as f64 / KIBIBYTE as f64)
    } else {
        format!("{size} B")
    }
}
