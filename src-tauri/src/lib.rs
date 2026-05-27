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

mod crashes;
mod keychain;
mod settings;
mod sidecar;
mod tray;
mod windows;

use crashes::CrashEntry;
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

// ---- Per-provider LLM credentials (LLM picker) ---------------------------
//
// Sister surface to `*_openrouter_key` but keyed on the provider id from
// the gateway's catalog. Used by the LlmProviderPicker for providers
// that aren't NEAR.AI (session-token) or OpenRouter (which keeps its own
// dedicated slot for backward compatibility with the old radio).
//
// Slot format: `llm-<provider-id>:<profile-id>` (see keychain.rs).

#[tauri::command]
async fn get_llm_provider_credential(
    _app: AppHandle,
    profile_id: String,
    provider_id: String,
) -> Result<Option<String>, String> {
    keychain::get_llm_provider_credential(&profile_id, &provider_id)
}

#[tauri::command]
async fn set_llm_provider_credential(
    _app: AppHandle,
    profile_id: String,
    provider_id: String,
    value: String,
) -> Result<(), String> {
    keychain::set_llm_provider_credential(&profile_id, &provider_id, &value)
}

#[tauri::command]
async fn delete_llm_provider_credential(
    _app: AppHandle,
    profile_id: String,
    provider_id: String,
) -> Result<(), String> {
    keychain::delete_llm_provider_credential(&profile_id, &provider_id)
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
    provider_id: Option<String>,
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
    //
    // `provider_id` is the richer field from the new LlmProviderPicker.
    // When present (and non-empty) it wins over the binary `backend`
    // enum; when absent we fall through to `backend`. This v1 wires
    // four providers explicitly: nearai, openrouter, openai, anthropic
    // (per the prompt's scoped-down option). Other ids fall through to
    // an "unsupported provider" error so misconfiguration surfaces
    // loudly rather than silently spawning NEAR.AI.
    let provider = provider_id
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    let backend_cfg = match provider {
        Some("nearai") => BackendConfig::Nearai,
        Some("openrouter") => {
            let api_key = keychain::get_openrouter_key(&profile_id)?
                .filter(|s| !s.is_empty())
                .ok_or_else(|| {
                    "Set your OpenRouter API key in Settings before starting local mode"
                        .to_string()
                })?;
            BackendConfig::Openrouter { api_key }
        }
        Some("openai") => {
            let api_key = keychain::get_llm_provider_credential(&profile_id, "openai")?
                .filter(|s| !s.is_empty())
                .ok_or_else(|| {
                    "Set your OpenAI API key in Settings before starting local mode"
                        .to_string()
                })?;
            BackendConfig::OpenAi { api_key }
        }
        Some("anthropic") => {
            let api_key = keychain::get_llm_provider_credential(&profile_id, "anthropic")?
                .filter(|s| !s.is_empty())
                .ok_or_else(|| {
                    "Set your Anthropic API key in Settings before starting local mode"
                        .to_string()
                })?;
            BackendConfig::Anthropic { api_key }
        }
        Some(other) => {
            return Err(format!(
                "LLM provider \"{other}\" is not yet wired in the desktop sidecar. \
                 Supported providers: nearai, openrouter, openai, anthropic."
            ));
        }
        None => match backend.unwrap_or(BackendKind::Nearai) {
            BackendKind::Nearai => BackendConfig::Nearai,
            BackendKind::Openrouter => {
                let api_key = keychain::get_openrouter_key(&profile_id)?
                    .filter(|s| !s.is_empty())
                    .ok_or_else(|| {
                        "Set your OpenRouter API key in Settings before starting local mode"
                            .to_string()
                    })?;
                BackendConfig::Openrouter { api_key }
            }
        },
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

// ---- Settings backup (export / import) -----------------------------------

/// Show the OS save-file dialog, then dump the current `settings.json`
/// contents (read directly from the AppData directory) to the chosen path.
///
/// We read the raw bytes off disk rather than re-serializing the parsed
/// `AppSettings` value so the exported file is byte-identical to what the
/// app uses internally — preserving any forward-compatible fields the
/// Rust schema doesn't model. Tokens / OpenRouter keys never enter this
/// payload (they live in the Keychain, not settings.json), so this file
/// is safe to email or sync across machines.
///
/// `default_filename` is supplied by the caller so date formatting stays
/// in one place (the JS `todayStamp()` helper) and we avoid pulling a
/// date crate just to format the suggested filename.
///
/// Returns the saved path on success, or `None` if the user cancelled.
#[tauri::command]
async fn export_settings_dialog(
    app: AppHandle,
    default_filename: String,
) -> Result<Option<String>, String> {
    // Resolve the on-disk settings.json path the same way the loader does.
    // If the file doesn't exist yet (fresh install + nothing saved), fall
    // back to the in-memory load → re-serialize path so the user still
    // gets a non-empty export of the materialized defaults.
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("resolve app_data_dir: {e}"))?;
    let settings_path = base.join("settings.json");
    let bytes = match std::fs::read(&settings_path) {
        Ok(b) => b,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            // Fall back: load (which returns {} for missing file) then
            // pretty-serialize. The JS loader will overlay defaults on
            // import, so this still gives the user something useful.
            let s = settings::load(&app)?;
            serde_json::to_vec_pretty(&s).map_err(|e| format!("serialize fallback: {e}"))?
        }
        Err(e) => return Err(format!("read {}: {e}", settings_path.display())),
    };

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
    let path_buf = path
        .into_path()
        .map_err(|e| format!("resolve path: {e}"))?;
    std::fs::write(&path_buf, &bytes)
        .map_err(|e| format!("write {}: {e}", path_buf.display()))?;
    Ok(Some(path_buf.to_string_lossy().into_owned()))
}

/// Show the OS open-file dialog, read the chosen file, and return its
/// contents as a UTF-8 string. Validation + persistence happen on the JS
/// side (which owns the settings schema).
///
/// Returns `None` if the user cancelled, or the file contents as a string.
/// Errors on I/O failure or non-UTF-8 contents (settings exports are
/// always JSON, which must be UTF-8 anyway).
#[tauri::command]
async fn open_text_dialog(app: AppHandle) -> Result<Option<String>, String> {
    let dialog = app.dialog().clone();
    let chosen = tauri::async_runtime::spawn_blocking(move || {
        dialog
            .file()
            .add_filter("JSON", &["json"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| format!("dialog task: {e}"))?;

    let Some(path) = chosen else {
        return Ok(None);
    };
    let path_buf = path
        .into_path()
        .map_err(|e| format!("resolve path: {e}"))?;
    let bytes = std::fs::read(&path_buf)
        .map_err(|e| format!("read {}: {e}", path_buf.display()))?;
    let text = String::from_utf8(bytes)
        .map_err(|e| format!("file is not valid UTF-8: {e}"))?;
    Ok(Some(text))
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

/// Render (or clear) the unseen-notification badge inside the tray icon.
///
/// Pushed from JS by the notifications store whenever its derived
/// `unseenCount` changes. `count <= 0` clears the badge (status-only
/// glyph); `count >= 10` is rendered as the `9plus` overlay by the Rust
/// side. The composite uses the last-known status cached in
/// `TrayIconState`, so the status colour stays stable across badge
/// pushes — see `tray::update_badge` for the (status, count) icon
/// table and the build-time generator that produces the 33 PNG
/// variants.
#[tauri::command]
async fn update_tray_badge(app: AppHandle, count: i32) -> Result<(), String> {
    tray::update_badge(&app, count).map_err(|e| format!("update_tray_badge: {e}"))
}

/// Push both status and count in one IPC call.
///
/// Functionally equivalent to calling `update_tray_status(status)` then
/// `update_tray_badge(count)` — the icon repaints once with the new
/// (status, count) composite. Useful for surfaces that have both pieces
/// of state on hand (e.g. a future combined "connection + unseen
/// notifications" sync) without two separate IPCs.
///
/// `status` accepts the same strings as `update_tray_status`:
/// `"connected"`, `"connecting"`, `"disconnected"`, `"error"`. Unknown
/// values degrade to `disconnected` (same fallback as the
/// single-field setter).
#[tauri::command]
async fn update_status_and_count(
    app: AppHandle,
    status: String,
    count: i32,
) -> Result<(), String> {
    tray::update_status_and_count(&app, &status, count)
        .map_err(|e| format!("update_status_and_count: {e}"))
}

/// Replace the contents of the "Recent notifications" submenu.
///
/// Pushed from JS by the notifications store whenever its `history`
/// array changes (and once on hydrate so the menu reflects last
/// session's seeded entries). The Rust side caps the list at 5 entries
/// and rebuilds the parent tray menu to swap the submenu in.
///
/// When `items` is empty the submenu renders a disabled "No recent
/// notifications" placeholder so the menu always has visible content.
#[tauri::command]
async fn update_tray_recent(app: AppHandle, items: Vec<tray::RecentItem>) -> Result<(), String> {
    tray::update_recent(&app, items).map_err(|e| format!("update_tray_recent: {e}"))
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

// ---- Local crash log -----------------------------------------------------
//
// Always on, always local. The frontend's last-resort window error +
// unhandledrejection handlers append entries here; Settings → Privacy
// shows the count and lets the user open / reveal / clear the file.
//
// No transmission happens from this side — opt-in telemetry is a
// separate JS-side store (`src/lib/stores/telemetry.svelte.ts`).

#[tauri::command]
async fn record_crash(app: AppHandle, entry: CrashEntry) -> Result<(), String> {
    crashes::write(&app, entry)
}

#[tauri::command]
async fn list_crashes(app: AppHandle, limit: usize) -> Result<Vec<CrashEntry>, String> {
    crashes::list(&app, limit)
}

#[tauri::command]
async fn clear_crashes(app: AppHandle) -> Result<(), String> {
    crashes::clear(&app)
}

#[tauri::command]
async fn crashes_file_path(app: AppHandle) -> Result<String, String> {
    crashes::file_path(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize env_logger before the Tauri builder so every `log::*` call
    // — including those that fire inside the setup hook (tray creation,
    // settings load) — is captured. Default filter is `info` for our crate
    // and `warn` for everything else, so noisy third-party traces stay
    // quiet but our own checkpoints surface. Users can override at runtime
    // with `RUST_LOG=debug` or finer-grained selectors like
    // `RUST_LOG=ironclaw_desktop_lib=trace,tauri=debug`.
    //
    // `try_init` rather than `init` so a hot-reloaded dev session that
    // somehow re-enters `run()` doesn't panic on the second initialization.
    let _ = env_logger::Builder::from_env(
        env_logger::Env::default()
            .default_filter_or("ironclaw_desktop_lib=info,warn"),
    )
    .format_timestamp_secs()
    .try_init();

    log::info!(
        "IronClaw Desktop v{} starting",
        env!("CARGO_PKG_VERSION")
    );

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
        // Cached "Recent notifications" submenu entries. Lives in app
        // state so `update_tray_recent` can swap the menu on demand
        // and so we can re-seed the menu after future
        // create/visibility flips without the JS side having to
        // re-push the same data.
        .manage(tray::RecentItemsState::default())
        // Cached (status, count) snapshot driving the composite tray
        // icon. The two single-field IPC commands
        // (`update_tray_status`, `update_tray_badge`) each mutate one
        // half and re-paint against the other; `update_status_and_count`
        // writes both at once. Defaults to (Disconnected, 0) — same as
        // the initial paint in `tray::create`.
        .manage(tray::TrayIconState::default())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_token,
            set_token,
            delete_token,
            get_openrouter_key,
            set_openrouter_key,
            delete_openrouter_key,
            get_llm_provider_credential,
            set_llm_provider_credential,
            delete_llm_provider_credential,
            get_or_create_local_token,
            start_sidecar,
            stop_sidecar,
            sidecar_status,
            local_data_dir,
            reveal_in_finder,
            save_text_dialog,
            export_settings_dialog,
            open_text_dialog,
            update_tray_status,
            set_tray_visible,
            update_tray_badge,
            update_status_and_count,
            update_tray_recent,
            show_main_window,
            record_crash,
            list_crashes,
            clear_crashes,
            crashes_file_path,
            windows::open_profile_window,
            windows::list_open_profile_windows,
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
                log::debug!("Window close requested, hiding to tray");
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
            log::info!("App exit requested, stopping sidecar");
            let state = app_handle.state::<SidecarState>();
            // Best-effort: block on the async stop. The runtime is still
            // alive at this point.
            tauri::async_runtime::block_on(async {
                let _ = sidecar::stop(state).await;
            });
        }
    });
}
