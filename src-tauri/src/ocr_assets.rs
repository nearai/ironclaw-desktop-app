// Loopback HTTP server for the OCR asset pack (tesseract worker, wasm core,
// language data). WKWebView does not route fetches made INSIDE Web Workers
// through custom URL-scheme handlers, so a worker can never load assets from
// tauri://localhost — but it can fetch plain http://127.0.0.1. This serves
// exactly five allowlisted files from the bundled resources, nothing else.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

const ALLOWED: [(&str, &str); 5] = [
    ("tesseract.esm.min.js", "text/javascript; charset=utf-8"),
    ("worker.min.js", "text/javascript; charset=utf-8"),
    ("tesseract-core-simd-lstm.wasm.js", "text/javascript; charset=utf-8"),
    ("tesseract-core-simd-lstm.wasm", "application/wasm"),
    ("eng.traineddata", "application/octet-stream"),
];

static SERVER_PORT: OnceLock<u16> = OnceLock::new();
static ASSET_ROOTS: OnceLock<Mutex<Vec<PathBuf>>> = OnceLock::new();

/// Start (once) and return the loopback port. `roots` are searched in order
/// for the allowlisted files — packaged resources first, repo paths in dev.
pub fn ensure_started(roots: Vec<PathBuf>) -> Result<u16, String> {
    if let Some(port) = SERVER_PORT.get() {
        return Ok(*port);
    }
    ASSET_ROOTS.get_or_init(|| Mutex::new(roots));

    let listener =
        TcpListener::bind("127.0.0.1:0").map_err(|e| format!("ocr asset server bind: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("ocr asset server addr: {e}"))?
        .port();

    std::thread::Builder::new()
        .name("ocr-asset-server".into())
        .spawn(move || {
            for stream in listener.incoming().flatten() {
                // Serial handling is fine: five small files, one client.
                let _ = handle(stream);
            }
        })
        .map_err(|e| format!("ocr asset server thread: {e}"))?;

    let _ = SERVER_PORT.set(port);
    Ok(port)
}

fn lookup(name: &str) -> Option<(&'static str, Vec<u8>)> {
    let (_, content_type) = ALLOWED.iter().find(|(allowed, _)| *allowed == name)?;
    let roots = ASSET_ROOTS.get()?.lock().ok()?;
    for root in roots.iter() {
        let candidate = root.join(name);
        if let Ok(bytes) = std::fs::read(&candidate) {
            return Some((content_type, bytes));
        }
    }
    None
}

fn handle(mut stream: TcpStream) -> std::io::Result<()> {
    let mut buf = [0u8; 2048];
    let n = stream.read(&mut buf)?;
    let request = String::from_utf8_lossy(&buf[..n]);
    let path = request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .unwrap_or("/");
    let name = path.trim_start_matches('/');

    match lookup(name) {
        Some((content_type, bytes)) => {
            // CORS open on loopback: the WebView page origin is tauri://,
            // and the worker inherits it — both need the explicit allow.
            let header = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: max-age=86400\r\nConnection: close\r\n\r\n",
                bytes.len()
            );
            stream.write_all(header.as_bytes())?;
            stream.write_all(&bytes)?;
        }
        None => {
            stream.write_all(
                b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
            )?;
        }
    }
    Ok(())
}
