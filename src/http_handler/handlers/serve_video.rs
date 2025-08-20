use futures_util::TryStreamExt;
use http_body_util::{BodyExt, StreamBody};
use hyper::{Response, StatusCode, body::Frame};
use tokio::{
    fs::File,
    io::{AsyncReadExt, AsyncSeekExt},
};
use tokio_util::io::ReaderStream;

use crate::{
    common::SharedState,
    http_handler::util::{CORS, MyResponse, Req, build_html_response, escape_html},
};

pub async fn handle(req: Req, state: SharedState) -> MyResponse {
    let path = req.uri().path();
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
            include_str!("../../static/404.html").replace("{PATH}", &escape_html(path)),
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
    let reader_stream = ReaderStream::new(file.take(if let Some((start, end)) = byte_range {
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
