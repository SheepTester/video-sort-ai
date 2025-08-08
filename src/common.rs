use std::{collections::HashSet, path::PathBuf, sync::Arc};

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
