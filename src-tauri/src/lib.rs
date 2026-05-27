// IronClaw Desktop — Tauri command surface.
//
// Frontend (SvelteKit) calls these via @tauri-apps/api invoke().
// Settings live on disk (as an opaque JSON blob — the frontend owns the
// schema, see the Profiles system); the bearer token (and OpenRouter
// key, and the auto-generated local-gateway token) live in the macOS
// Keychain.
//
// Profile-scoped credentials: `get_token` / `set_token` / `delete_token`
// (and the OpenRouter equivalents) all take a `profile_id`. The legacy
// suffix-less Keychain entries are auto-migrated to `:default` on first
// read — see `keychain::promote_legacy_if_needed`.
//
// The Local Sidecar mode (`mode: 'local'`) spawns the bundled IronClaw
// binary as a child process. Lifecycle is managed via `SidecarState`,
// exposed through `start_sidecar` / `stop_sidecar` / `sidecar_status`.

mod keychain;
mod settings;
mod sidecar;
mod tray;

use serde::Deserialize;
use settings::AppSettings;
use sidecar::{BackendConfig, SidecarState, SidecarStatus};
use tauri::{AppHandle, Manager, RunEvent, State, WindowEvent};
use tauri_plugin_dialog::DialogExt;

/// Tagged backend kind passed from the frontend to `start_sidecar`. Mirrors
/// the JS `LlmBackend` type but kept narrow so the IPC payload stays
/// explicit at the boundary.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
enum BackendKind {
    Nearai,
    Openrouter,
}

// ---- Settings -------------------------------------------------------------

#[tauri::command]
async fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    settings::load(&app)
}

#[tauri::command]
async fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    settings::save(&app, &settings)
}

// ---- Gateway-token Keychain (per-profile) --------------------------------

#[tauri::command]
async fn get_token(_app: AppHandle, profile_id: String) -> Result<Option<String>, String> {
    keychain::get(&profile_id)
}

#[tauri::command]
async fn set_token(_app: AppHandle, profile_id: String, token: String) -> Result<(), String> {
    keychain::set(&profile_id, &token)
}

#[tauri::command]
async fn delete_token(_app: AppHandle, profile_id: String) -> Result<(), String> {
    keychain::delete(&profile_id)
}

// ---- OpenRouter-key Keychain (per-profile, local mode) -------------------

#[tauri::command]
async fn get_openrouter_key(
    _app: AppHandle,
    profile_id: String,
) -> Result<Option<String>, String> {
    keychain::get_openrouter_key(&profile_id)
}

#[tauri::command]
async fn set_openrouter_key(
    _app: AppHandle,
    profile_id: String,
    key: String,
) -> Result<(), String> {
    keychain::set_openrouter_key(&profile_id, &key)
}

#[tauri::command]
async fn delete_openrouter_key(_app: AppHandle, profile_id: String) -> Result<(), String> {
    keychain::delete_openrouter_key(&profile_id)
}

#[tauri::command]
async fn get_or_create_local_token(_app: AppHandle) -> Result<String, String> {
    keychain::get_or_create_local_token()
}

// ---- Sidecar lifecycle ----------------------------------------------------

#[tauri::command]
async fn start_sidecar(
    app: AppHandle,
    state: State<'_, SidecarState>,
    backend: Option<BackendKind>,
    profile_id: String,
) -> Result<u16, String> {
    // Default to NEAR.AI Cloud — IronClaw's built-in inference path. The
    // frontend may pass `backend: "openrouter"` to opt into the advanced
    // path (bring-your-own-key). NEAR.AI needs no Keychain read at spawn;
    // IronClaw handles auth via its own onboard/login flow.
    //
    // `profile_id` scopes the OpenRouter key lookup so each profile keeps
    // its own credentials. The local-gateway bearer is global — there is
    // one bundled sidecar per app install regardless of how many profiles
    // are configured.
    let backend_cfg = match backend.unwrap_or(BackendKind::Nearai) {
        BackendKind::Nearai => BackendConfig::Nearai,
        BackendKind::Openrouter => {
            // Read the key server-side so it never crosses the IPC
            // boundary. The frontend only needs to know that a key is set.
            let api_key = keychain::get_openrouter_key(&profile_id)?
                .filter(|s| !s.is_empty())
                .ok_or_else(|| {
                    "Set your OpenRouter API key in Settings before starting local mode"
                        .to_string()
                })?;
            BackendConfig::Openrouter { api_key }
        }
    };
    let gateway_token = keychain::get_or_create_local_token()?;
    sidecar::spawn(app, state, backend_cfg, gateway_token).await
}

#[tauri::command]
async fn stop_sidecar(state: State<'_, SidecarState>) -> Result<(), String> {
    sidecar::stop(state).await
}

#[tauri::command]
async fn sidecar_status(state: State<'_, SidecarState>) -> Result<SidecarStatus, String> {
    Ok(sidecar::status(state).await)
}

// ---- Data-dir reveal (Local mode UX) -------------------------------------

#[tauri::command]
async fn local_data_dir(app: AppHandle) -> Result<String, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("resolve app_data_dir: {e}"))?;
    let dir = base.join("ironclaw-data");
    std::fs::create_dir_all(&dir).map_err(|e| format!("create {}: {e}", dir.display()))?;
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
async fn reveal_in_finder(path: String) -> Result<(), String> {
    // `open -R <path>` reveals the item in Finder. Falls back to opening
    // the directory if `-R` isn't applicable for the target.
    let status = std::process::Command::new("open")
        .arg("-R")
        .arg(&path)
        .status();
    match status {
        Ok(s) if s.success() => Ok(()),
        Ok(s) => Err(format!("open exited with status {s}")),
        Err(e) => Err(format!("open: {e}")),
    }
}

// ---- Save-file dialog (chat / settings exports) --------------------------

/// Show the OS save-file dialog, then write `contents` to the chosen path.
///
/// Used by the chat surface to export a single thread (markdown or JSON) and
/// by Settings to bulk-export every conversation in one JSON blob. The
/// dialog runs the JS plugin's blocking-save shape but we call it through
/// Rust so we never expose the filesystem-write capability to the webview;
/// the only path that ever leaves Rust is the one the user picked.
///
/// Returns the saved path on success, or `None` if the user cancelled.
#[tauri::command]
async fn save_text_dialog(
    app: AppHandle,
    default_filename: String,
    contents: String,
) -> Result<Option<String>, String> {
    // `blocking_save_file` runs the native dialog and returns the chosen
    // FilePath (or None on cancel). It's blocking from the dialog plugin's
    // POV but the Tauri command runtime is fine with it inside an async fn —
    // we just need to make sure we don't call it from the main thread, so
    // we hop onto the blocking pool.
    let dialog = app.dialog().clone();
    let chosen = tauri::async_runtime::spawn_blocking(move || {
        dialog
            .file()
            .set_file_name(&default_filename)
            .blocking_save_file()
    })
    .await
    .map_err(|e| format!("dialog task: {e}"))?;

    let Some(path) = chosen else {
        return Ok(None);
    };
    // FilePath may be a URI on mobile, but on macOS desktop it always
    // resolves to a real filesystem path. `into_path()` does the right
    // thing here.
    let path_buf = path
        .into_path()
        .map_err(|e| format!("resolve path: {e}"))?;
    std::fs::write(&path_buf, contents.as_bytes())
        .map_err(|e| format!("write {}: {e}", path_buf.display()))?;
    Ok(Some(path_buf.to_string_lossy().into_owned()))
}

// ---- Tray IPC -------------------------------------------------------------

/// Swap the tray icon to reflect a new connection status.
///
/// `status` is one of: `"connected"`, `"connecting"`, `"disconnected"`,
/// `"error"`. The Rust side maps `"error"` onto the disconnected glyph
/// (same red-ish dim claw) — we surface the distinction in the sidebar
/// pill and toast layer, not in the menu bar.
///
/// Pushed from JS by the connection store whenever its `status` field
/// changes.
#[tauri::command]
async fn update_tray_status(app: AppHandle, status: String) -> Result<(), String> {
    tray::update_status(&app, &status).map_err(|e| format!("update_tray_status: {e}"))
}

/// Show or hide the tray icon. Driven by the "Show in menu bar"
/// preference in /settings. We never destroy + recreate the tray on
/// flip — the underlying handle is preserved so re-enabling is instant.
#[tauri::command]
async fn set_tray_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    tray::set_visible(&app, visible).map_err(|e| format!("set_tray_visible: {e}"))
}

/// Show + focus the main window. Used by tray menu items that want to
/// surface a route immediately after firing their event (Settings,
/// Restart). The JS event listeners do the navigation; this just makes
/// sure the window isn't sitting hidden when they fire.
#[tauri::command]
async fn show_main_window(app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Err("main window not registered".into());
    };
    window
        .show()
        .map_err(|e| format!("show main window: {e}"))?;
    window
        .set_focus()
        .map_err(|e| format!("focus main window: {e}"))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        // Native save-file dialog used by chat + settings exports. We call
        // it from Rust via `save_text_dialog` so the webview never gets the
        // filesystem-write capability — only the path the user picks ever
        // crosses back into JS.
        .plugin(tauri_plugin_dialog::init())
        // Native notifications (chat replies while unfocused, routine
        // completion, sidecar exits). The JS side
        // (@tauri-apps/plugin-notification) wraps requestPermission /
        // sendNotification — no Rust commands needed here.
        .plugin(tauri_plugin_notification::init())
        // Auto-updater plugin. The JS side (@tauri-apps/plugin-updater) wraps
        // check / downloadAndInstall — no Rust commands needed here.
        // TODO: tauri.conf.json `plugins.updater.endpoints` currently points
        // at a placeholder URL (openclaw/ironclaw-desktop releases) and
        // `pubkey` is empty. Both must be set before shipping a release:
        //   1. Generate a signing keypair: `npm run tauri signer generate -- -w ~/.tauri/ironclaw.key`
        //   2. Paste the public key (base64) into `plugins.updater.pubkey`.
        //   3. Confirm the GitHub release repo + latest.json artifact path.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(SidecarState::default())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_token,
            set_token,
            delete_token,
            get_openrouter_key,
            set_openrouter_key,
            delete_openrouter_key,
            get_or_create_local_token,
            start_sidecar,
            stop_sidecar,
            sidecar_status,
            local_data_dir,
            reveal_in_finder,
            save_text_dialog,
            update_tray_status,
            set_tray_visible,
            show_main_window,
        ])
        // Build the menu-bar tray on setup so the icon is in place
        // before the first webview event fires. We swallow errors here —
        // a missing tray icon is a degraded UX, not a fatal launch
        // failure, and `update_tray_status` / `set_tray_visible` both
        // no-op when the tray hasn't been registered.
        //
        // Initial visibility honours the persisted `trayEnabled` setting
        // (default: true). We read settings synchronously off disk via
        // the same loader the IPC command uses; if it fails we keep the
        // tray visible (least-surprising default).
        .setup(|app| {
            let handle = app.handle();
            if let Err(e) = tray::create(handle) {
                log::warn!(target: "ironclaw_tray", "create failed: {e}");
            } else if let Ok(s) = settings::load(handle) {
                // `trayEnabled` defaults to true (we only hide when the
                // user explicitly stored `false`). settings.json is an
                // opaque JSON blob owned by the JS schema, so we look up
                // the field by name and treat anything-but-`false` as
                // visible — same fallback behaviour as a fresh install.
                let enabled = s
                    .get("trayEnabled")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true);
                if !enabled {
                    let _ = tray::set_visible(handle, false);
                }
            }
            Ok(())
        })
        // Hide the window on close instead of quitting so the tray stays
        // alive. Quit only happens via the tray "Quit" menu item or
        // Cmd+Q. Per-window event hook so other windows (e.g. future
        // detached chat tabs) don't get the same behaviour for free.
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // RunEvent::ExitRequested fires before the app actually exits. We kill
    // the sidecar there so we never leak a zombie child after the window
    // closes.
    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { .. } = event {
            let state = app_handle.state::<SidecarState>();
            // Best-effort: block on the async stop. The runtime is still
            // alive at this point.
            tauri::async_runtime::block_on(async {
                let _ = sidecar::stop(state).await;
            });
        }
    });
}
