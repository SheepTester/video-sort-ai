use http_body_util::{BodyExt, Full, combinators::BoxBody};
use hyper::{Response, StatusCode, body::Bytes};
use serde::Serialize;

use crate::util::MyResult;

pub const CORS: &str = "http://127.0.0.1:8000";

pub type MyResponse = MyResult<Response<BoxBody<Bytes, std::io::Error>>>;

pub fn escape_html(text: &str) -> String {
    text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
}

pub fn build_text_response(status: StatusCode, message: String) -> MyResponse {
    Ok(Response::builder()
        .status(status)
        .header("Content-Type", "text/plain")
        .header("Access-Control-Allow-Origin", CORS)
        .body(Full::from(message).map_err(|e| match e {}).boxed())?)
}

pub fn build_html_response(status: StatusCode, message: String) -> MyResponse {
    Ok(Response::builder()
        .status(status)
        .header("Content-Type", "text/html")
        .header("Access-Control-Allow-Origin", CORS)
        .body(Full::from(message).map_err(|e| match e {}).boxed())?)
}

pub fn build_json_response<T: Serialize>(object: &T) -> MyResponse {
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", CORS)
        .body(
            Full::from(serde_json::to_string(object)?)
                .map_err(|e| match e {})
                .boxed(),
        )?)
}
