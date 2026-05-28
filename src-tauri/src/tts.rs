//! macOS native TTS via the `say` binary.
//!
//! `say -v <voice> -r <rate> <text>` is the universal path. Bundled
//! voices live under /System/Library/Speech/Voices; the user can
//! pick via the macOS Voice Memos UI. We surface the voice + rate
//! as optional params and default to "Samantha" at 200 wpm.
//!
//! The command is fire-and-forget - Tokio spawns the child, returns
//! immediately, and the OS owns the process lifetime. A second call
//! interrupts the first (we kill the previous handle via a shared
//! Mutex<Option<Child>>).

use std::process::Stdio;
use std::sync::Mutex;
use tokio::process::Command;

#[derive(Default)]
pub struct TtsState {
    current: Mutex<Option<tokio::process::Child>>,
}

#[tauri::command]
pub async fn say_text(
    state: tauri::State<'_, TtsState>,
    text: String,
    voice: Option<String>,
    rate: Option<u32>,
) -> Result<(), String> {
    // Interrupt anything currently speaking.
    if let Ok(mut guard) = state.current.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.start_kill();
        }
    }

    let selected_voice = voice
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or("Samantha");

    let mut cmd = Command::new("/usr/bin/say");
    cmd.arg("-v").arg(selected_voice);
    cmd.arg("-r").arg((rate.unwrap_or(200)).to_string());
    cmd.arg(text);
    cmd.stdout(Stdio::null()).stderr(Stdio::null());

    let child = cmd.spawn().map_err(|e| e.to_string())?;
    if let Ok(mut guard) = state.current.lock() {
        *guard = Some(child);
    }
    Ok(())
}

#[tauri::command]
pub async fn stop_tts(state: tauri::State<'_, TtsState>) -> Result<(), String> {
    if let Ok(mut guard) = state.current.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.start_kill();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn list_voices() -> Result<Vec<String>, String> {
    let output = Command::new("/usr/bin/say")
        .arg("-v")
        .arg("?")
        .output()
        .await
        .map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    // Each line: "Samantha            en_US    # description..."
    let voices: Vec<String> = stdout
        .lines()
        .filter_map(|line| line.split_whitespace().next().map(String::from))
        .collect();
    Ok(voices)
}
