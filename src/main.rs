use std::ffi::OsStr;
use std::io::ErrorKind;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::process::exit;
use std::sync::Arc;

use http_body_util::BodyExt;
use http_body_util::Full;
use http_body_util::combinators::BoxBody;
use hyper::body::Bytes;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use serde::Deserialize;
use serde::Serialize;
use tokio::fs;
use tokio::net::TcpListener;
use tokio::sync::RwLock;

const PORT: u16 = 8008;
const DIR_PATH: &str = "./.video-sort";

type MyResult<T> = Result<T, Box<dyn std::error::Error + Send + Sync>>;
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

async fn handle_request(
    req: Request<hyper::body::Incoming>,
    state: SharedState,
) -> MyResult<Response<BoxBody<Bytes, std::io::Error>>> {
    Ok(Response::builder().status(StatusCode::OK).body(
        Full::new(
            include_str!("./index.html")
                .replace(
                    "{v}",
                    &format!("{} videos", state.read().await.videos.len()),
                )
                .into(),
        )
        .map_err(|e| match e {})
        .boxed(),
    )?)
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
                    service_fn(move |req| handle_request(req, state_clone.clone())),
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
