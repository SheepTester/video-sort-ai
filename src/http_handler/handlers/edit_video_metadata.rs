use http_body_util::BodyExt;
use hyper::body::Buf;

use crate::{
    common::{SharedState, save_state},
    http_handler::{
        defs::{JsonError, VideoMetadataEditReq},
        util::{MyResponse, Req, build_json_response},
    },
};

pub enum ReqType {
    Add,
    Remove,
    EditNote,
}

pub async fn handle(req: Req, state: SharedState, req_type: ReqType) -> MyResponse {
    let request: VideoMetadataEditReq =
        serde_json::from_reader(req.collect().await?.aggregate().reader())?;
    let success = {
        let mut state = state.write().await;
        let mut success = false;
        for video in &mut state.videos {
            if request.target.match_video(video) {
                match req_type {
                    ReqType::Add => {
                        video.tags.insert(request.tag_or_note.clone());
                    }
                    ReqType::Remove => {
                        video.tags.remove(&request.tag_or_note);
                    }
                    ReqType::EditNote => video.note = request.tag_or_note.clone(),
                }
                success = true;
            }
        }
        success
    };
    if success {
        save_state(&*state.read().await).await?;
        build_json_response(&*state.read().await)
    } else {
        build_json_response(&JsonError {
            error: format!(
                "Unable to find video by thumbnail name {:?}",
                request.target
            ),
        })
    }
}
