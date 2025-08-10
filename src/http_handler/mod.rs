use std::{ffi::OsStr, os::unix::ffi::OsStrExt, sync::Arc};

use futures_util::TryStreamExt;
use http_body_util::{BodyExt, Full, StreamBody};
use hyper::{
    Method, Request, Response, StatusCode,
    body::{Buf, Bytes, Frame},
};
use serde::Deserialize;
use serde_json::from_str;
use tokio::{
    fs::{self, File, metadata},
    io::{self, AsyncWriteExt},
    process::Command,
    sync::Semaphore,
};
use tokio_util::io::ReaderStream;

use crate::{
    common::{DIR_PATH, MAX_CONCURRENT_FFMPEG, Preview, SharedState, save_state},
    http_handler::{
        defs::{
            DeleteRequest, JsonError, PreparePreviewReq, RenameTagRequest, VideoMetadataEditReq,
        },
        util::{
            CORS, MyResponse, build_html_response, build_json_response, build_text_response,
            escape_html,
        },
    },
    util::{BoxedError, format_size},
};

mod defs;
mod util;

#[derive(Deserialize, Debug)]
struct FfprobeOutputStream {
    width: u32,
    height: u32,
}

#[derive(Deserialize, Debug)]
struct FfprobeOutputFormat {
    duration: String,
}

#[derive(Deserialize, Debug)]
struct FfprobeOutput {
    streams: (FfprobeOutputStream,),
    format: FfprobeOutputFormat,
}

async fn handle_request(req: Request<hyper::body::Incoming>, state: SharedState) -> MyResponse {
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
        (&Method::POST, "/tag/rename") => {
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
        (&Method::POST, "/preview") => {
            let request: PreparePreviewReq =
                serde_json::from_reader(req.collect().await?.aggregate().reader())?;
            let videos = state
                .read()
                .await
                .videos
                .iter()
                .filter_map(|video| {
                    if video.tags.contains(&request.tag) && video.preview.is_none() {
                        Some(video.clone())
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>();
            eprintln!(
                "Generating {} preview videos for tag {}",
                videos.len(),
                request.tag,
            );
            let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_FFMPEG));
            let handles = videos
                .into_iter()
                .map(|video| {
                    let path_clone = video.path.clone();
                    let state = state.clone();
                    let semaphore = semaphore.clone();
                    let handle = tokio::spawn(async move {
                        let _permit = semaphore.acquire_owned().await?;
                        let ffprobe_result = Command::new("ffprobe")
                            // only print errors
                            .arg("-v")
                            .arg("error")
                            // select one video stream
                            .arg("-select_streams")
                            .arg("v:0")
                            // only print these fields
                            .arg("-show_entries")
                            .arg("stream=width,height:format=duration")
                            .arg("-output_format")
                            .arg("json")
                            .arg(&video.path)
                            .output()
                            .await?;
                        if !ffprobe_result.status.success() {
                            eprintln!("ffprobe error in {:?}", video.path.file_name(),);
                            io::stderr().write_all(&ffprobe_result.stderr).await?;
                            Err("ffprobe error")?;
                        }
                        let ffprobe_output: FfprobeOutput =
                            from_str(&String::from_utf8(ffprobe_result.stdout)?)?;
                        println!("{:?}", ffprobe_output);

                        let preview_path =
                            format!("{DIR_PATH}/thumbs/{}.mp4", video.thumbnail_name);
                        let ffmpeg_result = Command::new("ffmpeg")
                            .arg("-i")
                            .arg(&video.path)
                            // fairly low quality
                            .arg("-crf")
                            .arg("32")
                            // 480p; -2 means to keep the other dimension even,
                            // because videos like even resolutions
                            .arg("-vf")
                            .arg(
                                // fix the smaller dimension to 480
                                if ffprobe_output.streams.0.width < ffprobe_output.streams.0.height
                                {
                                    "scale=480:-2"
                                } else {
                                    "scale=-2:480"
                                },
                            )
                            // 16kbps and 32kbps sound basically just as bad
                            .arg("-b:a")
                            .arg("16k")
                            // unspecified video and audio codec defaults to
                            // h264 and aac for mp4
                            .arg(&preview_path)
                            .output()
                            .await?;
                        if !ffmpeg_result.status.success() {
                            eprintln!("Failed to create preview for {:?}.", video.path.file_name());
                            io::stderr().write_all(&ffmpeg_result.stderr).await?;
                            Err("ffmpeg preview error")?;
                        }
                        let size = metadata(&preview_path).await?.len();
                        eprintln!(
                            "[preview] {:?} ({})",
                            video.path.file_name(),
                            format_size(size)
                        );

                        {
                            let mut state = state.write().await;
                            state
                                .videos
                                .iter_mut()
                                .find(|v| v.path == video.path)
                                .ok_or("cant find video i was making preview for")?
                                .preview = Some(Preview {
                                size,
                                original_width: ffprobe_output.streams.0.width,
                                original_height: ffprobe_output.streams.0.height,
                                original_duration: ffprobe_output.format.duration.parse()?,
                            });
                        }
                        save_state(&*state.read().await).await?;
                        Ok::<(), BoxedError>(())
                    });
                    (path_clone, handle)
                })
                .collect::<Vec<_>>();
            for (path, handle) in handles {
                match handle.await {
                    Err(err) => {
                        eprintln!("Unexpected join error in {:?}: {err:?}.", path.file_name());
                    }
                    Ok(Err(err)) => {
                        eprintln!("Unexpected error in {:?}: {err:?}.", path.file_name());
                    }
                    Ok(Ok(_)) => {}
                }
            }
            eprintln!("Preview generation complete");
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
