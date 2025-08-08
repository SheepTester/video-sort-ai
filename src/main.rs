use std::{io::ErrorKind, net::SocketAddr, process::exit, sync::Arc};

use hyper::{server::conn::http1, service::service_fn};
use hyper_util::rt::TokioIo;
use tokio::{fs, net::TcpListener, sync::RwLock};

use crate::{
    common::{DIR_PATH, MyResult, SharedState, State},
    http_handler::handle_request_wrapper,
    register::add_videos,
};

mod common;
mod http_handler;
mod register;

async fn start_server(state: SharedState) -> MyResult<()> {
    const PORT: u16 = 8008;
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

#[tokio::main]
async fn main() -> MyResult<()> {
    fs::create_dir_all(format!("{DIR_PATH}/thumbs/")).await?;
    let sharable_state = Arc::new(RwLock::new({
        let mut state = match fs::read_to_string(format!("{DIR_PATH}/state.json")).await {
            Ok(json) => serde_json::from_str(&json)?,
            Err(err) if err.kind() == ErrorKind::NotFound => State { videos: Vec::new() },
            Err(err) => Err(err)?,
        };
        state.videos.sort_by_key(|v| v.mtime);
        state
    }));

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
            let video_count = sharable_state.read().await.videos.len();
            eprintln!("Video Sort {}", include_str!("./static/version.txt"));
            eprintln!(
                "I'm tracking {video_count} videos. Run `{program_name} add <path>` to add more."
            );
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
