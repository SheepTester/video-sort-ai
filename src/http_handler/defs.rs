use serde::{Deserialize, Serialize};

use crate::common::{Rotation, Video};

#[derive(Deserialize, Debug)]
pub struct VideoMetadataEditReq {
    pub target: VideoSelectRequest,
    pub tag_or_note: String,
}

#[derive(Deserialize, Debug)]
pub struct RenameTagRequest {
    pub old: String,
    pub new: String,
}

#[derive(Deserialize, Debug)]
pub enum VideoSelectRequest {
    Thumbnail(String),
    Thumbnails(Vec<String>),
    Tag(String),
}
impl VideoSelectRequest {
    pub fn match_video(&self, video: &Video) -> bool {
        match self {
            VideoSelectRequest::Thumbnail(thumbnail_name) => {
                video.thumbnail_name == *thumbnail_name
            }
            VideoSelectRequest::Thumbnails(thumbnail_names) => {
                thumbnail_names.contains(&video.thumbnail_name)
            }
            VideoSelectRequest::Tag(tag) => video.tags.contains(tag),
        }
    }
}

#[derive(Serialize, Debug)]
pub struct JsonError {
    pub error: String,
}

#[derive(Deserialize, Debug)]
pub struct PreparePreviewReq {
    pub tag: String,
}

#[derive(Deserialize, Debug)]
pub struct Clip {
    pub start: f64,
    pub end: f64,
    pub thumbnail_name: String,
    pub override_rotation: Option<Rotation>,
}

#[derive(Deserialize, Debug)]
pub struct CookReq {
    pub clips: Vec<Clip>,
    pub width: u32,
    pub height: u32,
    pub name: String,
}
