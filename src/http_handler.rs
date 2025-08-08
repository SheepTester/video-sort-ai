use std::{ffi::OsStr, os::unix::ffi::OsStrExt};

use futures_util::TryStreamExt;
use http_body_util::{BodyExt, Full, StreamBody, combinators::BoxBody};
use hyper::{
    Method, Request, Response, StatusCode,
    body::{Buf, Bytes, Frame},
};
use serde::{Deserialize, Serialize};
use tokio::fs::{self, File};
use tokio_util::io::ReaderStream;

use crate::common::{DIR_PATH, MyResult, SharedState, save_state};

const CORS: &str = "http://127.0.0.1:8000";

type MyResponse = MyResult<Response<BoxBody<Bytes, std::io::Error>>>;

#[derive(Serialize, Deserialize, Debug)]
struct VideoMetadataEditReq {
    thumbnail_name: String,
    tag_or_note: String,
}

#[derive(Deserialize, Debug)]
enum DeleteRequest {
    Thumbnail(String),
    Tag(String),
}

#[derive(Serialize, Deserialize, Debug)]
struct JsonError {
    error: String,
}

fn escape_html(text: &str) -> String {
    text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
}

fn build_text_response(status: StatusCode, message: String) -> MyResponse {
    Ok(Response::builder()
        .status(status)
        .header("Content-Type", "text/plain")
        .header("Access-Control-Allow-Origin", CORS)
        .body(Full::from(message).map_err(|e| match e {}).boxed())?)
}

fn build_html_response(status: StatusCode, message: String) -> MyResponse {
    Ok(Response::builder()
        .status(status)
        .header("Content-Type", "text/html")
        .header("Access-Control-Allow-Origin", CORS)
        .body(Full::from(message).map_err(|e| match e {}).boxed())?)
}

fn build_json_response<T: Serialize>(object: &T) -> MyResponse {
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", CORS)
        .body(
            Full::from(serde_json::to_string(object)?)
                .map_err(|e| match e {})
                .boxed(),
        )?)
}

async fn handle_request(req: Request<hyper::body::Incoming>, state: SharedState) -> MyResponse {
    match (req.method(), req.uri().path()) {
        (&Method::GET, "/") => build_html_response(
            StatusCode::OK,
            String::from(include_str!("./static/index.html")),
        ),
        (&Method::GET, "/index.css") => Ok(Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "text/css")
            .header("Access-Control-Allow-Origin", CORS)
            .body(
                Full::from(&include_bytes!("./static/index.css")[..])
                    .map_err(|e| match e {})
                    .boxed(),
            )?),
        (&Method::GET, "/index.js") => Ok(Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "text/javascript")
            .header("Access-Control-Allow-Origin", CORS)
            .body(
                Full::from(&include_bytes!("./static/index.js")[..])
                    .map_err(|e| match e {})
                    .boxed(),
            )?),
        (&Method::GET, "/favicon.ico") => Ok(Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "image/vnd.microsoft.icon")
            .header("Access-Control-Allow-Origin", CORS)
            .body(
                Full::from(&include_bytes!("./static/favicon.ico")[..])
                    .map_err(|e| match e {})
                    .boxed(),
            )?),
        (&Method::GET, "/list") => build_json_response(&*state.read().await),
        (&Method::DELETE, "/videos") => {
            let request: DeleteRequest =
                serde_json::from_reader(req.collect().await?.aggregate().reader())?;
            let deleted_videos = {
                let mut state = state.write().await;
                let (deleted, remaining) =
                    state.videos.drain(..).partition(|video| match &request {
                        DeleteRequest::Thumbnail(thumbnail_name) => {
                            video.thumbnail_name == *thumbnail_name
                        }
                        DeleteRequest::Tag(tag) => video.tags.contains(tag),
                    });
                state.videos = remaining;
                deleted
            };
            if !deleted_videos.is_empty() {
                for video in &deleted_videos {
                    let thumb_path = format!("{DIR_PATH}/thumbs/{}", video.thumbnail_name);
                    fs::remove_file(&thumb_path).await?;
                    fs::remove_file(&video.path).await?;
                    println!("D {:?}", video.path);
                }
                save_state(&*state.read().await).await?;
            }
            build_json_response(&*state.read().await)
        }
        (&Method::OPTIONS, _) => Ok(Response::builder()
            .status(StatusCode::NO_CONTENT)
            .header("Access-Control-Allow-Origin", CORS)
            .header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
            .header("Access-Control-Allow-Headers", "Content-Type")
            .body(Full::new(Bytes::new()).map_err(|e| match e {}).boxed())?),
        (&Method::POST, path)
            if path == "/tag/add" || path == "/tag/remove" || path == "/editnote" =>
        {
            let path = String::from(path);
            let request: VideoMetadataEditReq =
                serde_json::from_reader(req.collect().await?.aggregate().reader())?;
            let success = {
                let mut state = state.write().await;
                let video = state
                    .videos
                    .iter_mut()
                    .find(|video| video.thumbnail_name == request.thumbnail_name);
                let success = video.is_some();
                if let Some(video) = video {
                    match path.as_str() {
                        "/tag/add" => {
                            video.tags.insert(request.tag_or_note);
                        }
                        "/tag/remove" => {
                            video.tags.remove(&request.tag_or_note);
                        }
                        "/editnote" => video.note = request.tag_or_note,
                        _ => {}
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
                        "Unable to find video by thumbnail name {}",
                        request.thumbnail_name
                    ),
                })
            }
        }
        (&Method::GET, path) if path.starts_with("/v/") => {
            let file = File::open(OsStr::from_bytes(&urlencoding::decode_binary(
                &path.as_bytes()[3..],
            )))
            .await?;
            let reader_stream = ReaderStream::new(file);
            let stream_body = StreamBody::new(reader_stream.map_ok(Frame::data));
            let boxed_body = BodyExt::boxed(stream_body);
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "video/mp4")
                .header("Access-Control-Allow-Origin", CORS)
                .header("Cache-Control", "public, max-age=604800")
                .body(boxed_body)?)
        }
        (&Method::GET, path) if path.starts_with("/t/") => {
            let file = File::open(format!(
                "{DIR_PATH}/thumbs/{}",
                urlencoding::decode(&path[3..])?
            ))
            .await?;
            let reader_stream = ReaderStream::new(file);
            let stream_body = StreamBody::new(reader_stream.map_ok(Frame::data));
            let boxed_body = BodyExt::boxed(stream_body);
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "image/jpeg")
                .header("Access-Control-Allow-Origin", CORS)
                .header("Cache-Control", "public, max-age=604800")
                .body(boxed_body)?)
        }
        (&Method::GET, path) => build_html_response(
            StatusCode::NOT_FOUND,
            include_str!("./static/404.html").replace("{PATH}", &escape_html(path)),
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
