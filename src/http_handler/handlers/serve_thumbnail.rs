use futures_util::TryStreamExt;
use http_body_util::{BodyExt, StreamBody};
use hyper::{Response, StatusCode, body::Frame};
use tokio::fs::File;
use tokio_util::io::ReaderStream;

use crate::{
    common::DIR_PATH,
    http_handler::util::{CORS, MyResponse, Req},
};

pub async fn handle(req: Req) -> MyResponse {
    let path = req.uri().path();
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
