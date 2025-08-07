use std::collections::HashSet;
use std::ffi::OsStr;
use std::io::ErrorKind;
use std::net::SocketAddr;
use std::os::unix::ffi::OsStrExt;
use std::path::PathBuf;
use std::process::exit;
use std::sync::Arc;

use futures_util::TryStreamExt;
use http_body_util::BodyExt;
use http_body_util::Full;
use http_body_util::StreamBody;
use http_body_util::combinators::BoxBody;
use hyper::Method;
use hyper::body::Buf;
use hyper::body::Bytes;
use hyper::body::Frame;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use serde::Deserialize;
use serde::Serialize;
use tokio::fs;
use tokio::fs::File;
use tokio::io;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpListener;
use tokio::process::Command;
use tokio::sync::RwLock;
use tokio::sync::Semaphore;
use tokio_util::io::ReaderStream;

const PORT: u16 = 8008;
const DIR_PATH: &str = "./.video-sort";

type BoxedError = Box<dyn std::error::Error + Send + Sync>;
type MyResult<T> = Result<T, BoxedError>;
type MyResponse = MyResult<Response<BoxBody<Bytes, std::io::Error>>>;
type SharedState = Arc<RwLock<State>>;

#[derive(Serialize, Deserialize, Debug)]
struct Video {
    path: PathBuf,
    thumbnail_name: String,
    tags: HashSet<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct State {
    videos: Vec<Video>,
}

#[derive(Serialize, Deserialize, Debug)]
struct TagEditReq {
    thumbnail_name: String,
    tag: String,
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
        .body(Full::from(message).map_err(|e| match e {}).boxed())?)
}

fn build_html_response(status: StatusCode, message: String) -> MyResponse {
    Ok(Response::builder()
        .status(status)
        .header("Content-Type", "text/html")
        .body(Full::from(message).map_err(|e| match e {}).boxed())?)
}

fn build_json_response<T: Serialize>(object: &T) -> MyResponse {
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
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
            include_str!("./static/index.html").replace(
                "{v}",
                &format!(
                    "{} videos",
                    state
                        .read()
                        .await
                        .videos
                        .iter()
                        .map(|video| format!(
                            "<a href=\"/v/{}\"><img src=\"/t/{}\">{}</a><br>",
                            urlencoding::encode_binary(video.path.as_os_str().as_encoded_bytes()),
                            urlencoding::encode(&video.thumbnail_name),
                            escape_html(
                                &video.path.file_name().unwrap_or_default().to_string_lossy()
                            )
                        ))
                        .collect::<Vec<_>>()
                        .join("")
                ),
            ),
        ),
        (&Method::GET, "/favicon.ico") => Ok(Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "image/vnd.microsoft.icon")
            .body(
                Full::from(&include_bytes!("./static/favicon.ico")[..])
                    .map_err(|e| match e {})
                    .boxed(),
            )?),
        (&Method::GET, "/list") => build_json_response(&*state.read().await),
        (&Method::POST, path) if path == "/tag/add" || path == "/tag/remove" => {
            let add = path == "/tag/add";
            let request: TagEditReq =
                serde_json::from_reader(req.collect().await?.aggregate().reader())?;
            let success = {
                let mut state = state.write().await;
                let video = state
                    .videos
                    .iter_mut()
                    .find(|video| video.thumbnail_name == request.thumbnail_name);
                let success = video.is_some();
                if let Some(video) = video {
                    if add {
                        video.tags.insert(request.tag);
                    } else {
                        video.tags.remove(&request.tag);
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

async fn handle_request_wrapper(
    req: Request<hyper::body::Incoming>,
    state: SharedState,
) -> MyResponse {
    match handle_request(req, state).await {
        Err(err) => build_text_response(StatusCode::INTERNAL_SERVER_ERROR, format!("{err:?}")),
        response => response,
    }
}

async fn start_server(state: SharedState) -> MyResult<()> {
    let addr = SocketAddr::from(([0, 0, 0, 0], PORT));
    let listener = TcpListener::bind(addr).await?;
    eprintln!("http://localhost:{PORT}");

    loop {
        let state_clone = state.clone();
        let (stream, _) = listener.accept().await?;
        let io = TokioIo::new(stream);
        tokio::task::spawn(async move {
            if let Err(err) = http1::Builder::new()
                .serve_connection(
                    io,
                    service_fn(move |req| handle_request_wrapper(req, state_clone.clone())),
                )
                .await
            {
                eprintln!("Error serving connection: {:?}", err);
            }
        });
    }
}

async fn save_state(state: &State) -> MyResult<()> {
    fs::write(
        format!("{DIR_PATH}/state.json"),
        serde_json::to_string_pretty(state)?,
    )
    .await?;
    Ok(())
}

const MAX_CONCURRENT_FFMPEG: usize = 10;

async fn add_videos(path: &str, state: SharedState) -> MyResult<()> {
    let mut entries = fs::read_dir(path).await?;
    let mut paths = Vec::new();
    {
        let videos = &state.read().await.videos;
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.extension() == Some(&OsStr::new("mp4"))
                && !videos.iter().any(|video| video.path == path)
            {
                paths.push(path);
            }
        }
    }

    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_FFMPEG));
    let handles = paths
        .iter()
        .map(|path| {
            let path = path.clone();
            let path_clone = path.clone();
            let state = state.clone();
            let semaphore = semaphore.clone();
            let handle = tokio::spawn(async move {
                let _ = semaphore.acquire_owned().await?;
                let file_name = path
                    .file_name()
                    .map(|s| s.to_string_lossy())
                    .unwrap_or_default();
                let thumbnail_name = format!(
                    "{}.jpg",
                    sanitize_filename::sanitize(path.as_os_str().to_string_lossy())
                );
                let ffmpeg_result = Command::new("ffmpeg")
                    .arg("-i")
                    .arg(path.clone())
                    .arg("-frames")
                    .arg("1")
                    .arg("-vf")
                    .arg("scale=256:-1")
                    .arg("-q")
                    .arg("20") // lowest quality
                    .arg(format!("{DIR_PATH}/thumbs/{thumbnail_name}"))
                    .output()
                    .await?;
                if ffmpeg_result.status.success() {
                    println!("{file_name}");
                } else {
                    eprintln!("Failed to create thumbnail for {file_name}.");
                    io::stderr().write_all(&ffmpeg_result.stderr).await?;
                }
                {
                    let mut state = state.write().await;
                    state.videos.push(Video {
                        path,
                        thumbnail_name,
                        tags: HashSet::new(),
                    });
                }
                save_state(&*state.read().await).await?;
                Ok::<(), BoxedError>(())
            });
            (path_clone, handle)
        })
        .collect::<Vec<_>>();
    for (path, handle) in handles {
        if let Err(err) = handle.await {
            eprintln!("Unexpected error in {:?}: {err:?}.", path.file_name());
        };
    }

    if paths.is_empty() {
        eprintln!("No new .mp4 files found in {path}.");
    }

    Ok(())
}

#[tokio::main]
async fn main() -> MyResult<()> {
    fs::create_dir_all(format!("{DIR_PATH}/thumbs/")).await?;
    let state = match fs::read_to_string(format!("{DIR_PATH}/state.json")).await {
        Ok(json) => serde_json::from_str(&json)?,
        Err(err) if err.kind() == ErrorKind::NotFound => State { videos: Vec::new() },
        Err(err) => Err(err)?,
    };
    let sharable_state = Arc::new(RwLock::new(state));

    let (program_name, command, add_path) = {
        let mut args = std::env::args();
        (
            args.next().unwrap_or_else(|| String::from("./video-sort")),
            args.next(),
            args.next(),
        )
    };

    match command.as_deref() {
        None => {
            eprintln!("Tip: Run `{program_name} help` for a list of commands.");
            start_server(sharable_state).await?;
        }
        Some("add") => {
            let Some(path) = add_path else {
                eprintln!("Missing path: `{program_name} add <path>`");
                exit(2);
            };
            add_videos(&path, sharable_state).await?;
        }
        Some("version") => {
            println!("{}", include_str!("./static/version.txt"));
        }
        Some("help") => {
            eprintln!("Available commands:");
            eprintln!("$ {program_name}");
            eprintln!("| Start the web server.");
            eprintln!("$ {program_name} add <path>");
            eprintln!("| Registers all .mp4 files in the given directory");
            eprintln!("| (shallow).");
            eprintln!("$ {program_name} version");
            eprintln!("| Print the program version.");
            eprintln!("$ {program_name} help");
            eprintln!("| Display this list.");
        }
        Some(arg) => {
            eprintln!(
                "Unknown argument `{arg}`. Run `{program_name} help` for a list of commands."
            );
            exit(2);
        }
    }

    Ok(())
}
