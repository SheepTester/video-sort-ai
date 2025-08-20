pub fn bold(text: &str) -> String {
    // bold cyan
    format!("\x1b[1m\x1b[36m{}\x1b[0m", text)
}

pub fn code(text: &str) -> String {
    // yellow
    format!("\x1b[33m{}\x1b[0m", text)
}

pub fn faded(text: &str) -> String {
    // dim
    format!("\x1b[2m{}\x1b[0m", text)
}

pub fn link(text: &str) -> String {
    // blue underline
    format!("\x1b[34m\x1b[4m{}\x1b[0m", text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bold() {
        assert_eq!(bold("hello"), "\x1b[1m\x1b[36mhello\x1b[0m");
    }

    #[test]
    fn test_code() {
        assert_eq!(code("hello"), "\x1b[33mhello\x1b[0m");
    }

    #[test]
    fn test_faded() {
        assert_eq!(faded("hello"), "\x1b[2mhello\x1b[0m");
    }

    #[test]
    fn test_link() {
        assert_eq!(link("hello"), "\x1b[34m\x1b[4mhello\x1b[0m");
    }
}
