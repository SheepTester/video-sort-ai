use http_body_util::BodyExt;
use hyper::body::Buf;

use crate::{
    common::{SharedState, save_state},
    http_handler::{
        defs::RenameTagRequest,
        util::{MyResponse, Req, build_json_response},
    },
};

pub async fn handle(req: Req, state: SharedState) -> MyResponse {
    let request: RenameTagRequest =
        serde_json::from_reader(req.collect().await?.aggregate().reader())?;
    {
        let mut state = state.write().await;
        for video in &mut state.videos {
            if video.tags.remove(&request.old) {
                video.tags.insert(request.new.clone());
            }
        }
    }
    save_state(&*state.read().await).await?;
    build_json_response(&*state.read().await)
}
