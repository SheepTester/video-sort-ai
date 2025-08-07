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
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use tokio_util::io::ReaderStream;

const PORT: u16 = 8008;
const DIR_PATH: &str = "./.video-sort";

type MyResult<T> = Result<T, Box<dyn std::error::Error + Send + Sync>>;
type MyResponse = MyResult<Response<BoxBody<Bytes, std::io::Error>>>;
type SharedState = Arc<RwLock<State>>;

#[derive(Serialize, Deserialize, Debug)]
struct Video {
    path: PathBuf,
    tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct State {
    videos: Vec<Video>,
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
                            "<a href=\"/v/{}\">{}</a><br>",
                            urlencoding::encode_binary(video.path.as_os_str().as_encoded_bytes()),
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

async fn start_server(state: State) -> MyResult<()> {
    let addr = SocketAddr::from(([0, 0, 0, 0], PORT));
    let listener = TcpListener::bind(addr).await?;
    eprintln!("http://localhost:{PORT}");
    let sharable_state = Arc::new(RwLock::new(state));

    loop {
        let state_clone = sharable_state.clone();
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

async fn add_videos(path: &str, mut state: State) -> MyResult<()> {
    let mut entries = fs::read_dir(path).await?;
    let mut found_videos = false;
    while let Some(entry) = entries.next_entry().await? {
        let path = entry.path();
        if path.extension() == Some(&OsStr::new("mp4"))
            && !state.videos.iter().any(|video| video.path == path)
        {
            println!("{:?}", entry.file_name());
            found_videos = true;
            state.videos.push(Video {
                path,
                tags: Vec::new(),
            });
        }
    }

    if found_videos {
        save_state(&state).await?;
    } else {
        eprintln!("No new .mp4 files found in {path}.");
    }

    Ok(())
}

#[tokio::main]
async fn main() -> MyResult<()> {
    fs::create_dir_all(DIR_PATH).await?;
    let state = match fs::read_to_string(format!("{DIR_PATH}/state.json")).await {
        Ok(json) => serde_json::from_str(&json)?,
        Err(err) if err.kind() == ErrorKind::NotFound => State { videos: Vec::new() },
        Err(err) => Err(err)?,
    };

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
            start_server(state).await?;
        }
        Some("add") => {
            let Some(path) = add_path else {
                eprintln!("Missing path: `{program_name} add <path>`");
                exit(2);
            };
            add_videos(&path, state).await?;
        }
        Some("help") => {
            eprintln!("Available commands:");
            eprintln!("$ {program_name}");
            eprintln!("| Start the web server.");
            eprintln!("$ {program_name} add <path>");
            eprintln!("| Registers all .mp4 files in the given directory (shallow).");
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
