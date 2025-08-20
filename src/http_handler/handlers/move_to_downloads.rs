use http_body_util::BodyExt;
use hyper::body::Buf;
use tokio::fs;

use crate::{
    common::SharedState,
    http_handler::{
        defs::VideoSelectRequest,
        util::{MyResponse, Req, build_json_response},
    },
};

pub async fn handle(req: Req, state: SharedState) -> MyResponse {
    fs::create_dir_all(format!("./storage/downloads/for-youtube/")).await?;
    let request: VideoSelectRequest =
        serde_json::from_reader(req.collect().await?.aggregate().reader())?;
    {
        let mut state = state.write().await;
        for video in &mut state.videos {
            if !request.match_video(video) {
                continue;
            }
            video
                .move_file(
                    format!(
                        "./storage/downloads/for-youtube/yt_{}.mp4",
                        video.thumbnail_name
                    )
                    .into(),
                )
                .await?;
        }
    }
    build_json_response(&*state.read().await)
}
