// App settings persisted as a JSON file in the platform AppData directory.
//
// The bearer token is intentionally NOT in this file — it lives in the
// macOS Keychain via the `keychain` module.
//
// We round-trip the settings blob as a raw `serde_json::Value` so the
// frontend owns the schema (including the profile shape introduced in
// the Profiles system). This keeps schema migrations + defaults in one
// place (the JS side) and means the Rust process doesn't need to know
// about new fields like `profiles[]` to load + save the file faithfully.

use std::{fs, io::ErrorKind, path::PathBuf};

use serde_json::Value;
use tauri::{AppHandle, Manager};

const SETTINGS_FILE: &str = "settings.json";

/// Opaque settings payload — JS owns the schema. Rust treats the file as
/// a JSON blob that round-trips cleanly via Tauri IPC.
pub type AppSettings = Value;

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("resolve app_data_dir: {e}"))?;
    if let Err(e) = fs::create_dir_all(&dir) {
        return Err(format!("create app_data_dir {}: {e}", dir.display()));
    }
    Ok(dir.join(SETTINGS_FILE))
}

pub fn load(app: &AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app)?;
    match fs::read(&path) {
        Ok(bytes) => serde_json::from_slice::<Value>(&bytes)
            .map_err(|e| format!("parse settings.json: {e}")),
        // First-run: return an empty object. JS layer will overlay defaults.
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(Value::Object(Default::default())),
        Err(e) => Err(format!("read {}: {e}", path.display())),
    }
}

pub fn save(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    let bytes = serde_json::to_vec_pretty(settings).map_err(|e| format!("serialize: {e}"))?;
    fs::write(&path, bytes).map_err(|e| format!("write {}: {e}", path.display()))?;
    Ok(())
}
