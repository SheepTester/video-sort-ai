use std::{collections::HashSet, ffi::OsStr, fmt::format, os::unix::ffi::OsStrExt, sync::Arc};

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
    common::{DIR_PATH, MAX_CONCURRENT_FFMPEG, Preview, SharedState, Video, save_state},
    http_handler::{
        defs::{
            CookReq, DeleteRequest, JsonError, PreparePreviewReq, RenameTagRequest,
            VideoMetadataEditReq,
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

struct CookClip<'a> {
    video: &'a Video,
    start: f64,
    end: f64,
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
        (&Method::POST, "/cook") => {
            let request: CookReq =
                serde_json::from_reader(req.collect().await?.aggregate().reader())?;
            let mut command = Command::new("ffmpeg");
            {
                let state = state.read().await;
                let clips = request
                    .clips
                    .iter()
                    .filter_map(|clip| {
                        state
                            .videos
                            .iter()
                            .find(|video| video.thumbnail_name == clip.thumbnail_name)
                            .map(|video| CookClip {
                                video,
                                start: clip.start,
                                end: clip.end,
                            })
                    })
                    .collect::<Vec<_>>();
                let (width, height) = match request
                    .sizing
                    .and_then(|thumb| {
                        state
                            .videos
                            .iter()
                            .find(|video| video.thumbnail_name == thumb)
                    })
                    .and_then(|video| video.preview.as_ref())
                {
                    Some(preview) => (preview.original_width, preview.original_height),
                    None => (
                        clips
                            .iter()
                            .map(|clip| clip.video.preview.as_ref().map_or(0, |p| p.original_width))
                            .max()
                            .unwrap_or(0),
                        clips
                            .iter()
                            .map(|clip| {
                                clip.video.preview.as_ref().map_or(0, |p| p.original_height)
                            })
                            .max()
                            .unwrap_or(0),
                    ),
                };
                let aspect_ratio = width as f64 / height as f64;
                let inputs_sets = clips
                    .iter()
                    .map(|v| v.video.path.clone())
                    .collect::<HashSet<_>>();
                let inputs = inputs_sets.iter().collect::<Vec<_>>();
                let mut filters = String::new();
                let mut concat = String::new();
                for (i, clip) in clips.iter().enumerate() {
                    let Some(clip_index) =
                        inputs.iter().position(|input| **input == clip.video.path)
                    else {
                        Err("clip video missing in inputs")?
                    };
                    let Some(ref preview) = clip.video.preview else {
                        Err("clip video has no dimensions computed")?
                    };
                    let my_aspect_ratio =
                        preview.original_width as f64 / preview.original_height as f64;
                    let need_bg = my_aspect_ratio == aspect_ratio;
                    // trim video
                    filters.push_str(&format!(
                        "[{clip_index}:v] trim = start={} : end={}, setpts=PTS-STARTPTS",
                        clip.start, clip.end
                    ));
                    if need_bg {
                        filters.push_str(&format!(
                            ", split [clip{i}v_trimmed] [clip{i}v_trimmed_copy]; "
                        ));
                    } else {
                        filters.push_str(&format!(" [clip{i}v_trimmed]; "));
                    }
                    filters.push_str(&format!("[{clip_index}:a] atrim = start={} : end={}, asetpts=PTS-STARTPTS [clip{i}a_trimmed]; ", clip.start, clip.end));

                    let output_name = if preview.original_width != width
                        || preview.original_height != height
                    {
                        // stretch videos
                        filters.push_str(&format!(
                            "[clip{i}v_trimmed] scale = {} [clip{i}v_scaled]; ",
                            if my_aspect_ratio >= aspect_ratio {
                                // this clip is wider, use their width
                                format!("{width}:-1")
                            } else {
                                format!("-1:{height}")
                            }
                        ));
                        if need_bg {
                            // create the blurred background:
                            // 1. crop the video to what is needed (crop =
                            //    width:height:x:y)
                            // 2. scale the video down
                            // 3. blur it
                            // 4. scale the video up
                            // 5. overlay the actual video
                            filters.push_str(&format!(
                                "[clip{i}v_trimmed_copy] scale = {} [clip{i}v_blurred]; ",
                                if my_aspect_ratio >= aspect_ratio {
                                    // this clip is wider, so use their height
                                    format!("-1:{height}")
                                } else {
                                    format!("{width}:-1")
                                }
                            ));
                            filters.push_str(&format!(
                                "[clip{i}v_blurred] [clip{i}v_scaled] overlay = {} [clip{i}v_overlain]; ",
                                "0:0" // TODO
                            ));
                            format!("[clip{i}v_overlain]")
                        } else {
                            format!("[clip{i}v_scaled]")
                        }
                    } else {
                        format!("[clip{i}v_trimmed]")
                    };
                    concat.push_str(&format!("{output_name} [clip{i}a_trimmed] "));
                }
                // 1 video stream, 1 audio stream
                concat.push_str(&format!(
                    "concat = n={} : v=1 : a=1 [outv] [outa]",
                    clips.len()
                ));
                filters.push_str(&concat);
                for input in inputs {
                    command.arg("-i").arg(input);
                }
                command.arg("-filter_complex").arg(filters);
                // specify what the outputs are
                command.arg("-map").arg("[outv]");
                command.arg("-map").arg("[outa]");
                command.arg("test.mp4");
            };

            let ffmpeg_result = command.output().await?;
            if !ffmpeg_result.status.success() {
                eprintln!("ffmpeg failure");
                io::stderr().write_all(&ffmpeg_result.stderr).await?;
                Err("ffmpeg failure")?;
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
