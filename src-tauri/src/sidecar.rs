// Sidecar lifecycle: spawn, monitor, stop.
//
// Local Sidecar mode runs the bundled IronClaw binary as a child process of
// the Tauri app. The child is registered in Tauri's managed-state container
// (`SidecarState`) so any command can locate it; on app exit the lifecycle
// hook in `lib.rs` calls `stop()` to make sure we don't leak processes.
//
// The bundled binary is wired up via `bundle.externalBin` in
// `tauri.conf.json`. At runtime, Tauri's shell plugin resolves
// `binaries/ironclaw` to the per-target-triple variant (e.g.
// `binaries/ironclaw-aarch64-apple-darwin`). If the file is missing — for
// example a debug build that didn't go through `tauri build` — spawn will
// return a clear error.

use std::{net::TcpListener, path::PathBuf, time::Duration};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};
use tokio::sync::Mutex;

const PORT_MIN: u16 = 3100;
const PORT_MAX: u16 = 3200;
const HEALTH_POLL_INTERVAL: Duration = Duration::from_millis(250);
const HEALTH_POLL_TIMEOUT: Duration = Duration::from_secs(15);

/// Selects which LLM provider env block we feed the sidecar at spawn.
/// Mirrors the JS `llmProviderId` but kept local so `sidecar::spawn` is
/// independent of the on-disk settings shape.
///
/// v1 only wires four provider env blocks (per the LlmProviderPicker
/// scope-down). New providers should add a variant + a `match` arm in
/// the per-backend env section below. TODO(sidecar.rs): wire the other
/// 20+ providers from the gateway's catalog — bedrock, google, vertex,
/// ollama, groq, mistral, cohere, fireworks, together, etc.
#[derive(Debug, Clone)]
pub enum BackendConfig {
    /// NEAR.AI Cloud — IronClaw's built-in inference. No API key at spawn;
    /// auth happens inside IronClaw via its onboard/login flow on first
    /// connect.
    Nearai,
    /// OpenRouter (openai-compatible). Requires a non-empty API key.
    Openrouter { api_key: String },
    /// OpenAI native API. Requires a non-empty API key.
    OpenAi { api_key: String },
    /// Anthropic native API. Requires a non-empty API key.
    Anthropic { api_key: String },
}

/// Shared state held by Tauri's manager. Only one sidecar is supported at
/// a time, matching the single-window model of the app.
#[derive(Default)]
pub struct SidecarState {
    child: Mutex<Option<CommandChild>>,
    port: Mutex<Option<u16>>,
}

/// JSON shape returned to the frontend by the `sidecar_status` IPC command.
#[derive(Debug, Serialize)]
pub struct SidecarStatus {
    pub running: bool,
    pub port: Option<u16>,
}

/// Spawn the bundled IronClaw sidecar with the given backend config and
/// local gateway bearer. Returns the chosen TCP port on success.
///
/// Errors are stringified for the frontend (Tauri commands serialize
/// `Result<T, String>` cleanly to JSON).
pub async fn spawn(
    app: AppHandle,
    state: State<'_, SidecarState>,
    backend: BackendConfig,
    gateway_token: String,
) -> Result<u16, String> {
    // Per-backend validation. NEAR.AI needs no upfront secret — IronClaw
    // handles auth via its own onboard/login flow on first connect. The
    // other three v1 providers all require a non-empty API key.
    match &backend {
        BackendConfig::Nearai => {}
        BackendConfig::Openrouter { api_key } => {
            if api_key.trim().is_empty() {
                return Err(
                    "Set your OpenRouter API key in Settings before starting local mode"
                        .into(),
                );
            }
        }
        BackendConfig::OpenAi { api_key } => {
            if api_key.trim().is_empty() {
                return Err(
                    "Set your OpenAI API key in Settings before starting local mode".into(),
                );
            }
        }
        BackendConfig::Anthropic { api_key } => {
            if api_key.trim().is_empty() {
                return Err(
                    "Set your Anthropic API key in Settings before starting local mode"
                        .into(),
                );
            }
        }
    }
    if gateway_token.trim().is_empty() {
        return Err("Local gateway token is empty (unexpected)".into());
    }

    // If a previous sidecar is already running, tear it down before
    // re-spawning. Easier than reconciling state from a stale handle.
    if state.child.lock().await.is_some() {
        let _ = stop_inner(&state).await;
    }

    let port = pick_free_port()?;
    let cwd = ensure_data_dir(&app)?;

    // Base env shared by both backends (gateway wiring, db, agent name).
    let mut envs: Vec<(String, String)> = vec![
        ("GATEWAY_AUTH_TOKEN".into(), gateway_token),
        ("GATEWAY_HOST".into(), "127.0.0.1".into()),
        ("GATEWAY_PORT".into(), port.to_string()),
        ("DATABASE_BACKEND".into(), "libsql".into()),
        ("AGENT_NAME".into(), "ironclaw".into()),
        ("GATEWAY_ENABLED".into(), "true".into()),
        ("CLI_ENABLED".into(), "false".into()),
    ];

    // Per-backend env. NEAR.AI Cloud uses IronClaw's native `nearai`
    // backend; OpenRouter, OpenAI, and Anthropic each get their own env
    // block matching the gateway's catalog entries.
    match &backend {
        BackendConfig::Nearai => {
            envs.extend([
                ("LLM_BACKEND".into(), "nearai".into()),
                ("NEARAI_BASE_URL".into(), "https://private.near.ai".into()),
                (
                    "NEARAI_API_URL".into(),
                    "https://private.near.ai/v1".into(),
                ),
                ("NEARAI_MODEL".into(), "auto".into()),
                (
                    "IRONCLAW_OAUTH_EXCHANGE_URL".into(),
                    "https://ironclaw-oauth.up.railway.app".into(),
                ),
                (
                    "IRONCLAW_OAUTH_CALLBACK_URL".into(),
                    "https://ironclaw-oauth.up.railway.app".into(),
                ),
            ]);
        }
        BackendConfig::Openrouter { api_key } => {
            envs.extend([
                ("LLM_BACKEND".into(), "openai_compatible".into()),
                ("LLM_BASE_URL".into(), "https://openrouter.ai/api/v1".into()),
                (
                    "LLM_MODEL".into(),
                    "deepseek/deepseek-chat-v3-0324".into(),
                ),
                ("OPENROUTER_API_KEY".into(), api_key.clone()),
            ]);
        }
        BackendConfig::OpenAi { api_key } => {
            envs.extend([
                ("LLM_BACKEND".into(), "openai".into()),
                ("LLM_BASE_URL".into(), "https://api.openai.com/v1".into()),
                ("LLM_MODEL".into(), "gpt-4o-mini".into()),
                ("OPENAI_API_KEY".into(), api_key.clone()),
            ]);
        }
        BackendConfig::Anthropic { api_key } => {
            envs.extend([
                ("LLM_BACKEND".into(), "anthropic".into()),
                ("LLM_BASE_URL".into(), "https://api.anthropic.com".into()),
                ("LLM_MODEL".into(), "claude-3-5-sonnet-latest".into()),
                ("ANTHROPIC_API_KEY".into(), api_key.clone()),
            ]);
        }
    }

    let command = app
        .shell()
        .sidecar("ironclaw")
        .map_err(|e| sidecar_missing_error(e.to_string()))?
        .envs(envs)
        .current_dir(&cwd)
        .args(["--no-onboard", "run"]);

    let (mut rx, child) = command
        .spawn()
        .map_err(|e| format!("spawn sidecar: {e}"))?;

    // Stash the child immediately so any error path can still clean it up
    // via stop().
    {
        let mut slot = state.child.lock().await;
        *slot = Some(child);
    }
    {
        let mut slot = state.port.lock().await;
        *slot = Some(port);
    }

    // Forward stdout/stderr from the sidecar to the Tauri log so the
    // contents are inspectable via `RUST_LOG=ironclaw_desktop_lib=info
    // npm run tauri dev`. We never log secrets (OpenRouter key, NEAR.AI
    // OAuth bearer) — they're only ever passed through env, not echoed.
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let line = String::from_utf8_lossy(&bytes);
                    log::info!(target: "ironclaw_sidecar", "{}", line.trim_end());
                }
                CommandEvent::Stderr(bytes) => {
                    let line = String::from_utf8_lossy(&bytes);
                    log::warn!(target: "ironclaw_sidecar", "{}", line.trim_end());
                }
                CommandEvent::Error(err) => {
                    log::warn!(target: "ironclaw_sidecar", "command error: {err}");
                }
                CommandEvent::Terminated(payload) => {
                    log::warn!(
                        target: "ironclaw_sidecar",
                        "sidecar exited (code={:?}, signal={:?})",
                        payload.code,
                        payload.signal
                    );
                    break;
                }
                _ => {}
            }
        }
    });

    log::info!(
        target: "ironclaw_sidecar",
        "Sidecar spawned on port {port}, waiting for /api/health"
    );

    // Wait for the gateway's /api/health to respond before considering the
    // sidecar started. If the timeout elapses, kill the child and surface
    // an error.
    match wait_for_health(port).await {
        Ok(()) => {
            log::info!(
                target: "ironclaw_sidecar",
                "Sidecar healthy on port {port}"
            );
            Ok(port)
        }
        Err(err) => {
            log::warn!(
                target: "ironclaw_sidecar",
                "Sidecar health check failed on port {port}: {err}"
            );
            let _ = stop_inner(&state).await;
            Err(err)
        }
    }
}

/// Stop the running sidecar if any. Idempotent.
pub async fn stop(state: State<'_, SidecarState>) -> Result<(), String> {
    stop_inner(&state).await
}

async fn stop_inner(state: &State<'_, SidecarState>) -> Result<(), String> {
    let child = {
        let mut slot = state.child.lock().await;
        slot.take()
    };
    {
        let mut slot = state.port.lock().await;
        *slot = None;
    }
    if let Some(c) = child {
        log::info!(target: "ironclaw_sidecar", "Stopping sidecar");
        c.kill().map_err(|e| format!("kill sidecar: {e}"))?;
    }
    Ok(())
}

/// Snapshot used by the `sidecar_status` IPC command.
pub async fn status(state: State<'_, SidecarState>) -> SidecarStatus {
    let running = state.child.lock().await.is_some();
    let port = *state.port.lock().await;
    SidecarStatus { running, port }
}

// ---- helpers --------------------------------------------------------------

fn pick_free_port() -> Result<u16, String> {
    for port in PORT_MIN..=PORT_MAX {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Ok(port);
        }
    }
    Err(format!(
        "no free port in {PORT_MIN}-{PORT_MAX} range for local sidecar"
    ))
}

fn ensure_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("resolve app_data_dir: {e}"))?;
    let cwd = base.join("ironclaw-data");
    std::fs::create_dir_all(&cwd)
        .map_err(|e| format!("create {}: {e}", cwd.display()))?;
    Ok(cwd)
}

async fn wait_for_health(port: u16) -> Result<(), String> {
    let url = format!("http://127.0.0.1:{port}/api/health");
    let deadline = std::time::Instant::now() + HEALTH_POLL_TIMEOUT;
    let mut last_err: Option<String> = None;
    loop {
        if std::time::Instant::now() >= deadline {
            let detail = last_err.unwrap_or_else(|| "no response".into());
            return Err(format!(
                "sidecar did not become healthy within {}s ({detail})",
                HEALTH_POLL_TIMEOUT.as_secs()
            ));
        }
        match tcp_probe(port).await {
            Ok(()) => {
                // The TCP socket is open. Try a real GET to confirm the
                // gateway is actually responding (not just a half-open
                // socket). If reqwest isn't available, accept the TCP
                // success.
                if http_health_probe(&url).await.is_ok() {
                    return Ok(());
                }
            }
            Err(e) => {
                last_err = Some(e);
            }
        }
        tokio::time::sleep(HEALTH_POLL_INTERVAL).await;
    }
}

/// Cheap "is anything listening on this port" check that doesn't pull in
/// a heavy HTTP client. Successful connect = the gateway is at least
/// bound.
async fn tcp_probe(port: u16) -> Result<(), String> {
    match tokio::time::timeout(
        Duration::from_millis(200),
        tokio::net::TcpStream::connect(("127.0.0.1", port)),
    )
    .await
    {
        Ok(Ok(_)) => Ok(()),
        Ok(Err(e)) => Err(e.to_string()),
        Err(_) => Err("connect timeout".into()),
    }
}

/// Best-effort HTTP probe using std blocking sockets (no extra deps).
/// We send `GET /api/health HTTP/1.0` and accept any 2xx/4xx response —
/// 4xx means the gateway is up but rejected our (unauthed) probe, which
/// is fine for liveness purposes.
async fn http_health_probe(url: &str) -> Result<(), String> {
    let url_owned = url.to_string();
    tokio::task::spawn_blocking(move || {
        use std::io::{Read, Write};
        // Extract host/port — caller always passes 127.0.0.1:<port>.
        let stripped = url_owned
            .strip_prefix("http://")
            .ok_or_else(|| "expected http:// url".to_string())?;
        let (authority, path) = stripped
            .split_once('/')
            .map(|(a, p)| (a.to_string(), format!("/{p}")))
            .unwrap_or((stripped.to_string(), "/".to_string()));
        let mut stream = std::net::TcpStream::connect_timeout(
            &authority
                .parse()
                .map_err(|e: std::net::AddrParseError| e.to_string())?,
            Duration::from_millis(500),
        )
        .map_err(|e| e.to_string())?;
        stream
            .set_read_timeout(Some(Duration::from_millis(800)))
            .map_err(|e| e.to_string())?;
        let req = format!(
            "GET {path} HTTP/1.0\r\nHost: {authority}\r\nConnection: close\r\n\r\n"
        );
        stream
            .write_all(req.as_bytes())
            .map_err(|e| e.to_string())?;
        let mut buf = [0u8; 64];
        let n = stream.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("empty response".into());
        }
        let line = String::from_utf8_lossy(&buf[..n]);
        // Anything matching `HTTP/1.x NNN` is acceptable — gateway is up.
        if line.starts_with("HTTP/1") {
            Ok(())
        } else {
            Err(format!("unexpected response start: {line:?}"))
        }
    })
    .await
    .map_err(|e| format!("join: {e}"))?
}

fn sidecar_missing_error(detail: String) -> String {
    format!(
        "Local sidecar binary not bundled — rebuild with `npm run tauri build` after running \
         src-tauri/binaries/download.sh ({detail})"
    )
}
