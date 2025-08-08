use std::{collections::HashSet, ffi::OsStr, sync::Arc};

use tokio::{
    fs::{self, metadata},
    io::{self, AsyncWriteExt},
    process::Command,
    sync::Semaphore,
};

use crate::common::{BoxedError, DIR_PATH, MyResult, SharedState, StowState, Video, save_state};

const MAX_CONCURRENT_FFMPEG: usize = 10;

pub async fn add_videos(path: &str, state: SharedState) -> MyResult<()> {
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
                // _ will immediately drop the permit
                let _permit = semaphore.acquire_owned().await?;
                let file_name = path
                    .file_name()
                    .map(|s| s.to_string_lossy())
                    .unwrap_or_default();
                let mtime = metadata(&path).await?.modified()?;
                let thumbnail_name = format!(
                    "{}.jpg",
                    sanitize_filename::sanitize(path.as_os_str().to_string_lossy())
                );
                eprintln!("Creating thumbnail for {file_name}...");
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
                    println!("+ {file_name}");
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
                        note: String::new(),
                        mtime,
                        stow_state: StowState::Original,
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
    } else {
        eprintln!("Done.");
    }

    Ok(())
}
