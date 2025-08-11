use std::{
    io::ErrorKind,
    path::PathBuf,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use futures_util::TryStreamExt;
use http_body_util::{BodyExt, Full, StreamBody};
use hyper::{
    Method, Request, Response, StatusCode,
    body::{Buf, Bytes, Frame},
};
use serde::Deserialize;
use tokio::{
    fs::{self, File},
    io::{AsyncBufReadExt, AsyncReadExt, AsyncSeekExt, BufReader},
    sync::{Semaphore, mpsc},
};
use tokio_stream::wrappers::ReceiverStream;
use tokio_util::io::ReaderStream;

use crate::{
    common::{DIR_PATH, MAX_CONCURRENT_FFMPEG, ProbeResult, Rotation, SharedState, save_state},
    fmt::faded,
    http_handler::{
        defs::{
            CookReq, JsonError, PreparePreviewReq, RenameTagRequest, VideoMetadataEditReq,
            VideoSelectRequest,
        },
        make_filter::make_clip,
        probe::probe_video,
        util::{
            CORS, MyResponse, build_html_response, build_json_response, build_text_response,
            escape_html,
        },
    },
    util::BoxedError,
};

mod defs;
mod make_filter;
mod probe;
mod util;

pub struct CookClip {
    pub video_path: PathBuf,
    pub probe: ProbeResult,
    pub start: f64,
    pub end: f64,
    pub override_rotation: Option<Rotation>,
}

#[derive(Deserialize, Debug)]
struct FfprobeVideoStream {
    width: u32,
    height: u32,
    pix_fmt: String,
    color_space: String,
    color_transfer: String,
    color_primaries: String,
    bit_rate: String,
    side_data_list: Option<(FfprobeVideoStreamSideData,)>,
}

#[derive(Deserialize, Debug)]
struct FfprobeVideoStreamSideData {
    rotation: i32,
}

#[derive(Deserialize, Debug)]
struct FfprobeOutputFormat {
    duration: String,
}

#[derive(Deserialize, Debug)]
struct FfprobeVideo {
    streams: (FfprobeVideoStream,),
    format: FfprobeOutputFormat,
}

#[derive(Deserialize, Debug)]
struct FfprobeAudioStream {
    sample_rate: String,
    channels: u32,
    channel_layout: String,
    bit_rate: String,
}

#[derive(Deserialize, Debug)]
struct FfprobeAudio {
    streams: Vec<FfprobeAudioStream>,
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
        (&Method::POST, "/for-youtube") => {
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
        (&Method::POST, "/restore") => {
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
        (&Method::DELETE, "/videos") => {
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
        (&Method::POST, "/cook") => {
            let request: CookReq =
                serde_json::from_reader(req.collect().await?.aggregate().reader())?;

            let work_dir = format!(
                "{DIR_PATH}/work/{}/",
                SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis()
            );
            fs::create_dir_all(&work_dir).await?;

            eprintln!(
                "{}",
                faded(&format!(
                    "[cook] Generating {} clips...",
                    request.clips.len()
                ))
            );

            let (tx, rx) = mpsc::channel::<std::io::Result<Bytes>>(100);
            let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_FFMPEG));
            let clips = {
                let state = state.read().await;
                request
                    .clips
                    .into_iter()
                    .filter_map(|clip| {
                        state
                            .videos
                            .iter()
                            .find(|video| video.thumbnail_name == clip.thumbnail_name)
                            .and_then(|video| {
                                video.probe.as_ref().map(|probe| CookClip {
                                    video_path: video.current_loc().to_path_buf(),
                                    probe: probe.clone(),
                                    start: clip.start,
                                    end: clip.end,
                                    override_rotation: clip.override_rotation.clone(),
                                })
                            })
                    })
                    .collect::<Vec<_>>()
            };
            let temp_base_encode = clips.get(0).ok_or("no clips")?.probe.clone();
            for (i, handle) in clips
                .into_iter()
                .enumerate()
                .map(|(i, clip)| {
                    let semaphore = semaphore.clone();
                    let tx = tx.clone();
                    let temp_base_encode = temp_base_encode.clone();
                    let work_dir = work_dir.clone();
                    tokio::spawn(async move {
                        let _permit = semaphore.acquire_owned().await?;
                        let mut command = make_clip(
                            &clip,
                            request.width,
                            request.height,
                            &temp_base_encode,
                            &format!("{work_dir}/clip_{i}.mp4"),
                        )?;
                        let mut child = command.spawn()?;
                        let mut reader =
                            BufReader::new(child.stdout.take().ok_or("no stdout??")?).split(b'\r');
                        while let Some(line) = reader.next_segment().await.transpose() {
                            tx.send(line.map(|line| {
                                Bytes::from(format!("[{i}] {}\n", String::from_utf8_lossy(&line)))
                            }))
                            .await?;
                        }
                        Ok::<(), BoxedError>(())
                    })
                })
                .enumerate()
            {
                match handle.await {
                    Err(err) => {
                        eprintln!("[cook] Unexpected join error in clip {i}:\n{err:?}");
                    }
                    Ok(Err(err)) => {
                        eprintln!("[cook] Unexpected error in clip {i}:\n{err:?}");
                    }
                    Ok(Ok(_)) => {}
                }
            }

            let out_path = format!("./storage/downloads/{}.mp4", request.name);

            // close the original tx since it's like referenced counted or
            // whatever
            drop(tx);
            let stream = ReceiverStream::new(rx);
            let stream_body = StreamBody::new(stream.map_ok(Frame::data));
            let boxed_body = BodyExt::boxed(stream_body);

            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "text/plain; charset=utf-8")
                .header("Access-Control-Allow-Origin", CORS)
                .body(boxed_body)?)
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
                let mut success = false;
                for video in &mut state.videos {
                    if request.target.match_video(video) {
                        match path.as_str() {
                            "/tag/add" => {
                                video.tags.insert(request.tag_or_note.clone());
                            }
                            "/tag/remove" => {
                                video.tags.remove(&request.tag_or_note);
                            }
                            "/editnote" => video.note = request.tag_or_note.clone(),
                            _ => {}
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
        (&Method::GET, path) if path.starts_with("/v/") => {
            let thumbnail_name = urlencoding::decode(&path[3..])?;
            let Some(file_path) = ({
                let state = state.read().await;
                state
                    .videos
                    .iter()
                    .find(|video| video.thumbnail_name == thumbnail_name)
                    .map(|video| video.current_loc().clone())
            }) else {
                return build_html_response(
                    StatusCode::NOT_FOUND,
                    include_str!("../static/404.html").replace("{PATH}", &escape_html(path)),
                );
            };
            let mut file = File::open(file_path).await?;
            let size = file.metadata().await?.len();
            let byte_range = req
                .headers()
                .get(hyper::header::RANGE)
                .and_then(|value| value.to_str().ok())
                .and_then(|range| range[6..].split_once('-'))
                .and_then(|(start, end)| {
                    start.parse::<u64>().ok().map(|start| {
                        (
                            start,
                            end.parse::<u64>().ok().unwrap_or(u64::MAX).min(size - 1),
                        )
                    })
                })
                .filter(|(start, end)| start < end);
            if let Some((start, _)) = byte_range {
                file.seek(std::io::SeekFrom::Start(start)).await?;
            }
            let reader_stream =
                ReaderStream::new(file.take(if let Some((start, end)) = byte_range {
                    end - start + 1
                } else {
                    size
                }));
            let stream_body = StreamBody::new(reader_stream.map_ok(Frame::data));
            let boxed_body = BodyExt::boxed(stream_body);
            let mut response = Response::builder()
                .status(if byte_range.is_some() {
                    StatusCode::PARTIAL_CONTENT
                } else {
                    StatusCode::OK
                })
                .header("Content-Type", "video/mp4")
                .header("Accept-Ranges", "bytes")
                .header("Access-Control-Allow-Origin", CORS)
                .header(
                    "Content-Length",
                    byte_range
                        .map_or(size, |(start, end)| end - start + 1)
                        .to_string(),
                )
                .header("Cache-Control", "public, max-age=604800");
            if let Some((start, end)) = byte_range {
                response = response.header("Content-Range", format!("bytes {start}-{end}/{size}"));
            }
            Ok(response.body(boxed_body)?)
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
