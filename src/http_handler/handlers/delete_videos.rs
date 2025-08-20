use std::io::ErrorKind;

use http_body_util::BodyExt;
use hyper::body::Buf;
use tokio::fs;

use crate::{
    common::{DIR_PATH, SharedState, save_state},
    http_handler::{
        defs::VideoSelectRequest,
        util::{MyResponse, Req, build_json_response},
    },
};

pub async fn handle(req: Req, state: SharedState) -> MyResponse {
    let request: VideoSelectRequest =
        serde_json::from_reader(req.collect().await?.aggregate().reader())?;
    let deleted_videos = {
        let mut state = state.write().await;
        let (deleted, remaining) = state
            .videos
            .drain(..)
            .partition(|video| request.match_video(video));
        state.videos = remaining;
        deleted
    };
    if !deleted_videos.is_empty() {
        for video in &deleted_videos {
            // remove preview video
            fs::remove_file(&format!("{DIR_PATH}/thumbs/{}.mp4", video.thumbnail_name))
                .await
                .or_else(|err| {
                    if err.kind() == ErrorKind::NotFound {
                        Ok(())
                    } else {
                        Err(err)
                    }
                })?;
            fs::remove_file(&format!("{DIR_PATH}/thumbs/{}", video.thumbnail_name)).await?;
            fs::remove_file(&video.current_loc()).await?;
            println!("D {:?}", video.display_name());
        }
        save_state(&*state.read().await).await?;
    }
    build_json_response(&*state.read().await)
}
