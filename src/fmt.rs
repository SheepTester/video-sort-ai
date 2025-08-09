pub fn bold(text: &str) -> String {
    format!("\x1b[1m{}\x1b[0m", text)
}

pub fn link(text: &str) -> String {
    format!("\x1b[34m\x1b[4m{}\x1b[0m", text)
}
