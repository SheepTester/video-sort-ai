pub type BoxedError = Box<dyn std::error::Error + Send + Sync>;
pub type MyResult<T> = Result<T, BoxedError>;

const KILOBYTE: u64 = 1000;
const MEGABYTE: u64 = 1000 * KILOBYTE;
const GIGABYTE: u64 = 1000 * MEGABYTE;
const TERABYTE: u64 = 1000 * GIGABYTE;

pub fn format_size(size: u64) -> String {
    if size >= TERABYTE {
        format!("{:.2} TB", size as f64 / TERABYTE as f64)
    } else if size >= GIGABYTE {
        format!("{:.2} GB", size as f64 / GIGABYTE as f64)
    } else if size >= MEGABYTE {
        format!("{:.2} MB", size as f64 / MEGABYTE as f64)
    } else if size >= KILOBYTE {
        format!("{:.2} KB", size as f64 / KILOBYTE as f64)
    } else {
        format!("{size} B")
    }
}
