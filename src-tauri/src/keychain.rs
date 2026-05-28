// Bearer-token storage backed by the macOS Keychain (via the `keyring` crate).
//
// Service name is shared across accounts so all IronClaw Desktop secrets sit
// in a single namespace in the keychain.
//
// Accounts (per-profile shape introduced by the Profiles system):
//   - `gateway-token:<profile-id>`    : remote gateway bearer
//   - `openrouter-key:<profile-id>`   : OpenRouter API key for local sidecar
//   - `local-gateway-token`           : auto-generated UUID used as the bearer
//                                       for the local sidecar's own gateway
//                                       (kept global — there is one bundled
//                                       sidecar per app install regardless of
//                                       how many profiles exist).
//
// Legacy fallback: a pre-Profiles install will have credentials at the
// suffix-less accounts `gateway-token` and `openrouter-key`. On the first
// read of a profile-scoped account we promote that legacy value to
// `<account>:default` (matching the migrated default-profile id) and clear
// the legacy entry. Idempotent — safe to call repeatedly.

use keyring::{Entry, Error as KeyringError};

const SERVICE: &str = "com.openclaw.ironclaw-desktop";

const ACCOUNT_GATEWAY_PREFIX: &str = "gateway-token";
const ACCOUNT_OPENROUTER_PREFIX: &str = "openrouter-key";
const ACCOUNT_LOCAL_TOKEN: &str = "local-gateway-token";
/// Prefix for per-LLM-provider credentials stored by the desktop's
/// LlmProviderPicker. Combined with the provider id and profile id this
/// produces `llm-<provider-id>:<profile-id>` slots (e.g.
/// `llm-openai:default`, `llm-anthropic:abc-123`).
const ACCOUNT_LLM_PROVIDER_PREFIX: &str = "llm";

/// Profile id used by the JS migration when wrapping an old flat-shape
/// settings file into a single profile. Must stay in sync with the JS
/// constant `DEFAULT_PROFILE_ID` in `settings.svelte.ts`.
const DEFAULT_PROFILE_ID: &str = "default";

fn entry(account: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, account).map_err(|e| format!("keyring entry: {e}"))
}

fn get_secret(account: &str) -> Result<Option<String>, String> {
    // Log the slot name only — never the secret value. Useful for tracing
    // which credentials each surface reads on startup / IPC dispatch.
    log::info!(target: "ironclaw_keychain", "read service={SERVICE} account={account}");
    let e = entry(account)?;
    match e.get_password() {
        Ok(s) => {
            log::info!(
                target: "ironclaw_keychain",
                "READ OK [{account}] len={}",
                s.len()
            );
            Ok(Some(s))
        }
        Err(KeyringError::NoEntry) => {
            log::warn!(target: "ironclaw_keychain", "READ NO_ENTRY [{account}] — keyring crate doesn't see the entry");
            Ok(None)
        }
        Err(err) => {
            log::warn!(target: "ironclaw_keychain", "READ FAILED [{account}]: {err}");
            Err(format!("keyring read [{account}]: {err}"))
        }
    }
}

fn set_secret(account: &str, value: &str) -> Result<(), String> {
    let e = entry(account)?;
    e.set_password(value)
        .map_err(|err| format!("keyring write [{account}]: {err}"))
}

fn delete_secret(account: &str) -> Result<(), String> {
    let e = entry(account)?;
    match e.delete_credential() {
        Ok(()) => Ok(()),
        Err(KeyringError::NoEntry) => Ok(()),
        Err(err) => Err(format!("keyring delete [{account}]: {err}")),
    }
}

fn account_for(prefix: &str, profile_id: &str) -> String {
    format!("{prefix}:{profile_id}")
}

/// Promote a legacy suffix-less entry to its `:default` profile-scoped
/// counterpart, if the target slot is empty. Best-effort — failures don't
/// block subsequent reads, but they're surfaced via the Result so the
/// caller can log.
fn promote_legacy_if_needed(prefix: &str, profile_id: &str) -> Result<(), String> {
    if profile_id != DEFAULT_PROFILE_ID {
        return Ok(());
    }
    let target_account = account_for(prefix, profile_id);
    // If we already have a value at the new slot, leave the legacy slot
    // alone — the user (or this same migration on a previous boot) has
    // already written there.
    if get_secret(&target_account)?.is_some() {
        return Ok(());
    }
    let Some(legacy) = get_secret(prefix)? else {
        return Ok(());
    };
    if legacy.is_empty() {
        // Treat an empty legacy entry as "nothing to migrate" — but still
        // clear it so we don't keep re-checking on every read.
        let _ = delete_secret(prefix);
        return Ok(());
    }
    set_secret(&target_account, &legacy)?;
    // Best-effort clear — if delete fails for any reason, the data is
    // already safely copied to the new slot, so this isn't fatal.
    let _ = delete_secret(prefix);
    Ok(())
}

// ---- Remote gateway bearer ------------------------------------------------

pub fn get(profile_id: &str) -> Result<Option<String>, String> {
    promote_legacy_if_needed(ACCOUNT_GATEWAY_PREFIX, profile_id)?;
    get_secret(&account_for(ACCOUNT_GATEWAY_PREFIX, profile_id))
}

pub fn set(profile_id: &str, token: &str) -> Result<(), String> {
    set_secret(&account_for(ACCOUNT_GATEWAY_PREFIX, profile_id), token)
}

pub fn delete(profile_id: &str) -> Result<(), String> {
    delete_secret(&account_for(ACCOUNT_GATEWAY_PREFIX, profile_id))
}

// ---- OpenRouter API key ---------------------------------------------------

pub fn get_openrouter_key(profile_id: &str) -> Result<Option<String>, String> {
    promote_legacy_if_needed(ACCOUNT_OPENROUTER_PREFIX, profile_id)?;
    get_secret(&account_for(ACCOUNT_OPENROUTER_PREFIX, profile_id))
}

pub fn set_openrouter_key(profile_id: &str, key: &str) -> Result<(), String> {
    set_secret(&account_for(ACCOUNT_OPENROUTER_PREFIX, profile_id), key)
}

pub fn delete_openrouter_key(profile_id: &str) -> Result<(), String> {
    delete_secret(&account_for(ACCOUNT_OPENROUTER_PREFIX, profile_id))
}

// ---- Per-provider LLM credentials (LlmProviderPicker) --------------------
//
// The picker stores each provider's API key / token in its own slot so
// the user can switch between providers without losing their other
// configured credentials. The OpenRouter case still flows through the
// dedicated `*_openrouter_key` helpers above so the legacy
// `openrouter-key:<profile>` slot continues to work.

fn llm_account_for(provider_id: &str, profile_id: &str) -> String {
    // Sanitize the provider id defensively: keyring entries treat the
    // account string as opaque but we still want a predictable layout
    // and no embedded colons (which we use as the profile separator).
    let safe_provider: String = provider_id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    format!("{ACCOUNT_LLM_PROVIDER_PREFIX}-{safe_provider}:{profile_id}")
}

pub fn get_llm_provider_credential(
    profile_id: &str,
    provider_id: &str,
) -> Result<Option<String>, String> {
    get_secret(&llm_account_for(provider_id, profile_id))
}

pub fn set_llm_provider_credential(
    profile_id: &str,
    provider_id: &str,
    value: &str,
) -> Result<(), String> {
    set_secret(&llm_account_for(provider_id, profile_id), value)
}

pub fn delete_llm_provider_credential(
    profile_id: &str,
    provider_id: &str,
) -> Result<(), String> {
    delete_secret(&llm_account_for(provider_id, profile_id))
}

// ---- Local gateway token (auto-generated if missing) ----------------------

/// Returns the stored local gateway token, generating + persisting a fresh
/// UUID v4 if none exists. Idempotent — callers can invoke on every boot.
/// Kept global (no profile scoping) — there is one bundled sidecar per
/// install, and its bearer is an app-level secret, not a per-profile one.
pub fn get_or_create_local_token() -> Result<String, String> {
    if let Some(existing) = get_secret(ACCOUNT_LOCAL_TOKEN)? {
        if !existing.is_empty() {
            return Ok(existing);
        }
    }
    let fresh = uuid::Uuid::new_v4().to_string();
    set_secret(ACCOUNT_LOCAL_TOKEN, &fresh)?;
    Ok(fresh)
}
