use std::{
    process::Stdio,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use futures_util::TryStreamExt;
use http_body_util::{BodyExt, StreamBody};
use hyper::{
    Response, StatusCode,
    body::{Buf, Bytes, Frame},
};
use tokio::{
    fs,
    io::{AsyncBufReadExt, BufReader},
    process::Command,
    sync::{Semaphore, mpsc},
};
use tokio_stream::wrappers::ReceiverStream;
use tokio_util::io::ReaderStream;

use crate::{
    common::{DIR_PATH, MAX_CONCURRENT_FFMPEG, SharedState},
    fmt::faded,
    http_handler::{
        defs::CookReq,
        make_filter::make_clip,
        probe::defs::CookClip,
        util::{CORS, MyResponse, Req},
    },
    util::BoxedError,
};

pub async fn handle(req: Req, state: SharedState) -> MyResponse {
    let request: CookReq = serde_json::from_reader(req.collect().await?.aggregate().reader())?;

    let work_dir = format!(
        "{DIR_PATH}/work/{}",
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
    let clip_count = clips.len();
    let handles = clips
        .into_iter()
        .enumerate()
        .map(|(i, clip)| {
            let semaphore = semaphore.clone();
            let tx = tx.clone();
            let work_dir = work_dir.clone();
            let encoding = request.encoding.clone();
            tokio::spawn(async move {
                let _permit = semaphore.acquire_owned().await?;
                let mut command = make_clip(&clip, &encoding, &format!("{work_dir}/clip{i}.mp4"))?;
                eprintln!("{}", faded(&format!("[cook.{i}] {command:?}")));
                command.stderr(Stdio::piped());
                let mut child = command.spawn()?;
                let mut reader =
                    BufReader::new(child.stderr.take().ok_or("no stderr??")?).split(b'\r');
                while let Some(line) = reader.next_segment().await.transpose() {
                    tx.send(line.map(|line| {
                        Bytes::from(format!("[{i}] {}\n", String::from_utf8_lossy(&line)))
                    }))
                    .await?;
                }
                match child.wait().await {
                    Ok(status) if status.success() => {}
                    Ok(status) => Err(format!("[cook] ffmpeg failed with status: {status}"))?,
                    Err(err) => Err(format!("[cook] ffmpeg failed to run: {err}"))?,
                }
                Ok::<(), BoxedError>(())
            })
        })
        .collect::<Vec<_>>();

    let concat_path = format!("{work_dir}/concat.txt");
    fs::write(
        &concat_path,
        // note: without -safe 0, ffmpeg concat will reject file paths
        // with a . in it
        (0..clip_count)
            .map(|i| format!("file 'clip{i}.mp4'\n"))
            .collect::<String>(),
    )
    .await?;
    let out_path = format!("./storage/downloads/{}.mp4", request.name);
    let mut command = Command::new("ffmpeg");
    command.arg("-v").arg("error");
    command.arg("-stats");
    command.arg("-f").arg("concat");
    command.arg("-i").arg(&concat_path);
    command.arg("-c").arg("copy");
    command.arg("-y");
    command.arg(&out_path);
    command.stderr(Stdio::piped());

    tokio::spawn(async move {
        let mut failed = false;
        for (i, handle) in handles.into_iter().enumerate() {
            match handle.await {
                Err(err) => {
                    eprintln!("[cook.{i}] Unexpected join error in clip:\n{err:?}");
                    failed = true;
                }
                Ok(Err(err)) => {
                    eprintln!("[cook.{i}] Unexpected error in clip:\n{err:?}");
                    failed = true;
                }
                Ok(Ok(_)) => {}
            }
        }
        if failed {
            eprintln!("{}", faded(&format!("[cook] Clip generation failed.")));
            return;
        }
        eprintln!("{}", faded(&format!("[cook] Clip generation complete.")));

        eprintln!("{}", faded(&format!("[cook] {command:?}")));
        let mut child = match command.spawn() {
            Ok(child) => child,
            Err(err) => {
                eprintln!("[cook] Spawning concat failed: {err:?}.");
                return;
            }
        };
        let Some(stderr) = child.stderr.take() else {
            eprintln!("[cook] concat child doesnt have stderr??");
            return;
        };

        let mut reader_stream = ReaderStream::new(stderr);
        while let Some(chunk) = tokio_stream::StreamExt::next(&mut reader_stream).await {
            // Send the raw chunk directly to the channel
            if let Err(_) = tx.send(chunk).await {
                break;
            }
        }
        match child.wait().await {
            Ok(status) if status.success() => eprintln!("[cook] Bon appetit! {out_path}"),
            Ok(status) => eprintln!("[cook] ffmpeg failed with status: {status}"),
            Err(err) => eprintln!("[cook] ffmpeg failed to run: {err}"),
        }
        if let Err(err) = fs::remove_dir_all(work_dir).await {
            eprintln!("[cook] failed to clean up workspace: {err}")
        }
    });

    let stream = ReceiverStream::new(rx);
    let stream_body = StreamBody::new(stream.map_ok(Frame::data));
    let boxed_body = BodyExt::boxed(stream_body);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/plain; charset=utf-8")
        .header("Access-Control-Allow-Origin", CORS)
        .body(boxed_body)?)
}
