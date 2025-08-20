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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_size() {
        assert_eq!(format_size(0), "0 B");
        assert_eq!(format_size(999), "999 B");
        assert_eq!(format_size(1000), "1.00 KB");
        assert_eq!(format_size(1024), "1.02 KB");
        assert_eq!(format_size(1_000_000), "1.00 MB");
        assert_eq!(format_size(1_500_000), "1.50 MB");
        assert_eq!(format_size(1_000_000_000), "1.00 GB");
        assert_eq!(format_size(1_000_000_000_000), "1.00 TB");
    }
}
