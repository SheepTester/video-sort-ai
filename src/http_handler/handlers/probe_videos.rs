use std::sync::Arc;

use http_body_util::BodyExt;
use hyper::body::Buf;
use tokio::sync::Semaphore;

use crate::{
    common::{MAX_CONCURRENT_FFMPEG, SharedState, save_state},
    fmt::faded,
    http_handler::{
        defs::PreparePreviewReq,
        probe::probe_video,
        util::{MyResponse, Req, build_json_response},
    },
    util::BoxedError,
};

pub async fn handle(req: Req, state: SharedState) -> MyResponse {
    let request: PreparePreviewReq =
        serde_json::from_reader(req.collect().await?.aggregate().reader())?;
    let videos = state
        .read()
        .await
        .videos
        .iter()
        .filter_map(|video| {
            if video.tags.contains(&request.tag) && video.probe.is_none() {
                Some(video.clone())
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    eprintln!(
        "{}",
        faded(&format!(
            "[preview] Generating {} preview videos for tag {}...",
            videos.len(),
            request.tag,
        ))
    );
    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_FFMPEG));
    let handles = videos
        .into_iter()
        .map(|video| {
            let display_name = video.display_name();
            let state = state.clone();
            let semaphore = semaphore.clone();
            let handle = tokio::spawn(async move {
                let _permit = semaphore.acquire_owned().await?;
                let result = probe_video(video.current_loc()).await?;
                {
                    let mut state = state.write().await;
                    state
                        .videos
                        .iter_mut()
                        .find(|v| v.thumbnail_name == video.thumbnail_name)
                        .ok_or("cant find video i was making preview for")?
                        .probe = Some(result);
                }
                save_state(&*state.read().await).await?;
                Ok::<(), BoxedError>(())
            });
            (display_name, handle)
        })
        .collect::<Vec<_>>();
    for (display_name, handle) in handles {
        match handle.await {
            Err(err) => {
                eprintln!(
                    "[preview] Unexpected join error in {}: {err:?}.",
                    display_name
                );
            }
            Ok(Err(err)) => {
                eprintln!("[preview] Unexpected error in {}: {err:?}.", display_name);
            }
            Ok(Ok(_)) => {}
        }
    }
    eprintln!("[preview] Preview generation complete");
    build_json_response(&*state.read().await)
}
