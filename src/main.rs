use std::{
    env::current_exe,
    error::Error,
    io::ErrorKind,
    net::SocketAddr,
    process::exit,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use hyper::{server::conn::http1, service::service_fn};
use hyper_util::rt::TokioIo;
use tokio::{fs, net::TcpListener, sync::RwLock};

use crate::{
    common::{DIR_PATH, SharedState, State},
    fmt::{bold, code, link},
    http_handler::handle_request_wrapper,
    register::add_videos,
    util::{MyResult, format_size},
};

mod common;
mod fmt;
mod http_handler;
mod register;
mod util;

async fn start_server(state: SharedState) -> MyResult<()> {
    const PORT: u16 = 8008;
    let addr = SocketAddr::from(([0, 0, 0, 0], PORT));
    let listener = TcpListener::bind(addr).await?;
    eprintln!();
    eprintln!("Sort: {}", link(&format!("http://localhost:{PORT}/")));
    eprintln!("Edit: {}", link(&format!("http://localhost:{PORT}/?edit")));

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
                if !err.is_incomplete_message()
                    && !err.is_body_write_aborted()
                    && !err
                        .source()
                        .and_then(|e| e.downcast_ref::<std::io::Error>())
                        .map_or(false, |err| {
                            matches!(
                                err.kind(),
                                ErrorKind::ConnectionReset | ErrorKind::BrokenPipe
                            )
                        })
                {
                    eprintln!("Error serving connection: {:?}", err);
                }
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
            Err(err) if err.kind() == ErrorKind::NotFound => State {
                videos: Vec::new(),
                version: None,
            },
            Err(err) => Err(err)?,
        };
        state.version = Some(String::from(env!("CARGO_PKG_VERSION")));
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
            eprintln!(
                "{}",
                bold(&format!("Video Sort {}", env!("CARGO_PKG_VERSION")))
            );
            {
                let videos = &sharable_state.read().await.videos;
                let video_count = videos.len();
                let total_size: u64 = videos.iter().map(|v| v.size).sum();
                eprintln!(
                    "I'm tracking {video_count} videos ({} total). Run {} to add more.",
                    format_size(total_size),
                    code(&format!("{program_name} add <path>"))
                );
                if video_count == 0 {
                    eprintln!(
                        "{}: Run {} for a list of commands.",
                        bold("Tip"),
                        code(&format!("{program_name} help"))
                    );
                }
            }
            start_server(sharable_state).await?;
        }
        Some("add") => {
            let Some(path) = add_path else {
                eprintln!(
                    "Missing path: {}",
                    code(&format!("{program_name} add <path>"))
                );
                exit(2);
            };
            add_videos(&path, sharable_state).await?;
        }
        Some("version" | "-v" | "--version") => {
            println!("{}", env!("CARGO_PKG_VERSION"));
        }
        Some("help" | "-h" | "--help") => {
            eprintln!("{}", bold("Available commands"));
            eprintln!("$ {}", code(&program_name));
            eprintln!("| Start the web server.");
            eprintln!("$ {}", code(&format!("{program_name} add <path>")));
            eprintln!("| Registers all .mp4 files in the given directory");
            eprintln!("| (shallow).");
            eprintln!("$ {}", code(&format!("{program_name} update")));
            eprintln!("| Outputs a shell command to overwrite the program file");
            eprintln!("| with the latest version.");
            eprintln!("$ {}", code(&format!("{program_name} version")));
            eprintln!("| Print the program version.");
            eprintln!("$ {}", code(&format!("{program_name} about")));
            eprintln!("| Display information about this software.");
            eprintln!("$ {}", code(&format!("{program_name} help")));
            eprintln!("| Display this list.");
        }
        Some("about") => {
            eprintln!(
                "{}",
                bold(&format!("Video Sort {}", env!("CARGO_PKG_VERSION")))
            );
            eprintln!("Made by Sean");
            eprintln!();
            eprintln!(
                "GitHub: {}",
                link("https://github.com/SheepTester/video-sort-ai")
            );
        }
        Some("update" | "up" | "upgrade") => {
            let path = current_exe()?;
            println!(
                "curl -L https://github.com/SheepTester/video-sort-ai/releases/latest/download/video-sort?_={} > {:?}",
                SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis(),
                path
            );
            eprintln!(
                "{}: Run {} to overwrite {:?}",
                bold("Tip"),
                code(&format!("eval `{program_name} up`")),
                path
            );
        }
        Some(arg) => {
            eprintln!(
                "Unknown argument {}. Run {} for a list of commands.",
                code(arg),
                code(&format!("{program_name} help"))
            );
            exit(2);
        }
    }

    Ok(())
}
