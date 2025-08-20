use http_body_util::BodyExt;
use hyper::body::Buf;

use crate::{
    common::SharedState,
    http_handler::{
        defs::VideoSelectRequest,
        util::{MyResponse, Req, build_json_response},
    },
};

pub async fn handle(req: Req, state: SharedState) -> MyResponse {
    let request: VideoSelectRequest =
        serde_json::from_reader(req.collect().await?.aggregate().reader())?;
    {
        let mut state = state.write().await;
        for video in &mut state.videos {
            if !request.match_video(video) {
                continue;
            }
            video.restore_file().await?;
        }
    }
    build_json_response(&*state.read().await)
}
