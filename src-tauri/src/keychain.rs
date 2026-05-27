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

/// Profile id used by the JS migration when wrapping an old flat-shape
/// settings file into a single profile. Must stay in sync with the JS
/// constant `DEFAULT_PROFILE_ID` in `settings.svelte.ts`.
const DEFAULT_PROFILE_ID: &str = "default";

fn entry(account: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, account).map_err(|e| format!("keyring entry: {e}"))
}

fn get_secret(account: &str) -> Result<Option<String>, String> {
    let e = entry(account)?;
    match e.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(err) => Err(format!("keyring read [{account}]: {err}")),
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
