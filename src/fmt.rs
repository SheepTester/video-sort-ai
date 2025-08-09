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
