//! Push a single assistant turn into Apple Notes via osascript.
//!
//! Best-effort: failures bubble back to the JS caller so the UI can
//! decide whether to surface a toast.

use std::io::Read;
use std::process::{Command, Stdio};

#[tauri::command]
pub async fn export_to_notes(title: String, body: String) -> Result<(), String> {
    // Build the AppleScript as a single osascript expression so the user's
    // title/body content never becomes shell syntax.
    let title = title.replace('"', "\\\"");
    let body = body.replace('"', "\\\"").replace('\n', "\\n");
    let script = format!(
        "tell application \"Notes\"\n  tell account 1\n    make new note at folder \"Notes\" with properties {{name:\"{}\", body:\"{}\"}}\n  end tell\nend tell",
        title, body
    );

    let mut child = Command::new("/usr/bin/osascript")
        .arg("-e")
        .arg(&script)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    let status = child.wait().map_err(|e| e.to_string())?;
    if !status.success() {
        let mut err = String::new();
        if let Some(mut stderr) = child.stderr.take() {
            let _ = stderr.read_to_string(&mut err);
        }
        return Err(format!("osascript exited {}: {}", status, err.trim()));
    }
    Ok(())
}
