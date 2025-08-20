use http_body_util::{BodyExt, Full};
use hyper::{Method, Request, Response, StatusCode, body::Bytes};

use crate::{
    common::SharedState,
    http_handler::{
        handlers::{
            cook, delete_videos,
            edit_video_metadata::{self, ReqType},
            move_to_downloads, probe_videos, rename_tag, restore_from_downloads, serve_thumbnail,
            serve_video,
        },
        util::{
            CORS, MyResponse, Req, build_html_response, build_json_response, build_text_response,
            escape_html,
        },
    },
};

mod defs;
mod handlers;
mod make_filter;
mod probe;
mod util;

async fn handle_request(req: Req, state: SharedState) -> MyResponse {
    match (req.method(), req.uri().path()) {
        (&Method::GET, "/") => build_html_response(
            StatusCode::OK,
            String::from(include_str!("../static/index.html")),
        ),
        (&Method::GET, "/index.css") => Ok(Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "text/css")
            .header("Access-Control-Allow-Origin", CORS)
            .body(
                Full::from(&include_bytes!("../static/index.css")[..])
                    .map_err(|e| match e {})
                    .boxed(),
            )?),
        (&Method::GET, "/index.js") => Ok(Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "text/javascript")
            .header("Access-Control-Allow-Origin", CORS)
            .body(
                Full::from(&include_bytes!("../static/index.js")[..])
                    .map_err(|e| match e {})
                    .boxed(),
            )?),
        (&Method::GET, "/favicon.ico") => Ok(Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "image/vnd.microsoft.icon")
            .header("Access-Control-Allow-Origin", CORS)
            .body(
                Full::from(&include_bytes!("../static/favicon.ico")[..])
                    .map_err(|e| match e {})
                    .boxed(),
            )?),
        (&Method::GET, "/list") => build_json_response(&*state.read().await),
        (&Method::POST, "/for-youtube") => move_to_downloads::handle(req, state).await,
        (&Method::POST, "/restore") => restore_from_downloads::handle(req, state).await,
        (&Method::DELETE, "/videos") => delete_videos::handle(req, state).await,
        (&Method::POST, "/tag/rename") => rename_tag::handle(req, state).await,
        (&Method::POST, "/preview") => probe_videos::handle(req, state).await,
        (&Method::POST, "/cook") => cook::handle(req, state).await,
        (&Method::OPTIONS, _) => Ok(Response::builder()
            .status(StatusCode::NO_CONTENT)
            .header("Access-Control-Allow-Origin", CORS)
            .header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
            .header("Access-Control-Allow-Headers", "Content-Type")
            .body(Full::new(Bytes::new()).map_err(|e| match e {}).boxed())?),
        (&Method::POST, path)
            if path == "/tag/add" || path == "/tag/remove" || path == "/editnote" =>
        {
            let req_type = match path {
                "/tag/add" => ReqType::Add,
                "/tag/remove" => ReqType::Remove,
                "/editnote" => ReqType::EditNote,
                path => Err(format!("what path... {path}"))?,
            };
            edit_video_metadata::handle(req, state, req_type).await
        }
        (&Method::GET, path) if path.starts_with("/v/") => serve_video::handle(req, state).await,
        (&Method::GET, path) if path.starts_with("/t/") => serve_thumbnail::handle(req).await,
        (&Method::GET, path) => build_html_response(
            StatusCode::NOT_FOUND,
            include_str!("../static/404.html").replace("{PATH}", &escape_html(path)),
        ),
        (method, path) => build_text_response(
            StatusCode::METHOD_NOT_ALLOWED,
            format!("Method {method} not supported at {path}."),
        ),
    }
}

pub async fn handle_request_wrapper(
    req: Request<hyper::body::Incoming>,
    state: SharedState,
) -> MyResponse {
    match handle_request(req, state).await {
        Err(err) => build_text_response(StatusCode::INTERNAL_SERVER_ERROR, format!("{err:?}")),
        response => response,
    }
}
