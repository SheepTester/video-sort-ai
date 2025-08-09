use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct VideoMetadataEditReq {
    pub thumbnail_name: String,
    pub tag_or_note: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RenameTagRequest {
    pub old: String,
    pub new: String,
}

#[derive(Deserialize, Debug)]
pub enum DeleteRequest {
    Thumbnail(String),
    Tag(String),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct JsonError {
    pub error: String,
}
