// App settings store backed by Tauri.
//
// Settings live in a JSON file at $APPDATA/settings.json (handled by the
// Rust side). The bearer token never enters this object — it's stored in
// the macOS Keychain via a separate `get_token` / `set_token` IPC pair.
//
// Profile-aware shape (introduced by the Profiles system):
//   { activeProfileId, profiles: [...], onboardingComplete }
//
// Each `ProfileConfig` carries its own mode / URLs / llmBackend so the
// user can flip between (e.g.) "abby-remote" and "local-sidecar" without
// re-typing credentials.
//
// Schema migration: a pre-Profiles install has the flat shape
// `{ mode, remoteBaseUrl, localBaseUrl, llmBackend, onboardingComplete }`
// at the top level. `loadSettings()` detects the absence of a `profiles`
// array and wraps those values into a single default profile with id
// `DEFAULT_PROFILE_ID` ("default") — matching what the Rust keychain
// migration looks for when promoting the legacy bearer slots.

import { invoke } from '@tauri-apps/api/core';

export type ConnectionMode = 'remote' | 'local';

/**
 * Local-mode LLM backend. `nearai` is the default — IronClaw's built-in
 * NEAR.AI Cloud inference; OAuth handled by IronClaw itself on first
 * connect, no key required upfront. `openrouter` is the advanced path:
 * bring your own OpenRouter key.
 */
export type LlmBackend = 'nearai' | 'openrouter';

/**
 * Per-profile gateway connection. The id is opaque (uuid-ish) and never
 * shown — `name` is the user-facing label.
 */
export interface ProfileConfig {
  /** Stable opaque id. Generated via crypto.randomUUID() on creation; the
   *  migrated legacy profile uses the literal `DEFAULT_PROFILE_ID`. */
  id: string;
  /** User-facing label (e.g. "baremetal3", "abby-remote"). */
  name: string;
  /** `remote` talks to a Caddy-fronted gateway; `local` uses the sidecar. */
  mode: ConnectionMode;
  /** Base URL for the remote IronClaw gateway. */
  remoteBaseUrl: string;
  /** Base URL for the local sidecar gateway (auto-discovered port wins). */
  localBaseUrl: string;
  /** Local-mode LLM backend (defaults to NEAR.AI Cloud). */
  llmBackend: LlmBackend;
}

export interface AppSettings {
  /** Id of the currently-selected profile. Must always reference a real
   *  entry in `profiles` (the loader + helpers enforce this invariant). */
  activeProfileId: string;
  /** All configured profiles. Always at least one entry. */
  profiles: ProfileConfig[];
  /**
   * First-run wizard sentinel. False on a fresh install (or when the field
   * is missing from an older settings.json), which redirects the user to
   * `/onboarding` on layout mount. Flipped to true once the user completes
   * (or explicitly skips) the wizard, so they never see it again unless
   * they hit "Re-run onboarding" from /settings.
   */
  onboardingComplete: boolean;
  /**
   * App-level "show admin surfaces" toggle. App-level, NOT per-profile —
   * if the user wants the Admin sidebar item and `/admin` route mounted
   * they almost certainly want it across every profile they switch into.
   *
   * Defaults to `false` (the loader's `migrateLoaded` always materializes
   * the field, so consumers can treat it as effectively required). Marked
   * optional on the type so older callers that construct an `AppSettings`
   * draft inline (e.g. the onboarding initializer) don't have to be
   * updated everywhere — anything reading the field still gets a boolean
   * when the value comes off disk. Toggling on in /settings unhides the
   * sidebar entry + Cmd+7 shortcut + the route guard; toggling off
   * redirects out of `/admin` to `/settings` if currently there.
   */
  adminMode?: boolean;
  /**
   * App-level "Show in menu bar" toggle. App-level, NOT per-profile —
   * the tray icon is global chrome, not per-gateway state.
   *
   * Defaults to `true` (the loader materializes the field, so consumers
   * can treat it as effectively required). Marked optional on the type
   * for the same reason `adminMode` is — older code constructing draft
   * settings inline shouldn't have to be updated everywhere.
   *
   * Rust honours this on app start (via `tauri::Builder::setup` reading
   * `settings.json`); the JS connection store pushes the value to the
   * `set_tray_visible` IPC whenever the user toggles it from /settings.
   */
  trayEnabled?: boolean;
}

/** Id used for the migrated default profile. Must stay in sync with the
 *  Rust constant `DEFAULT_PROFILE_ID` in `keychain.rs`. */
export const DEFAULT_PROFILE_ID = 'default';

function newProfileId(): string {
  // crypto.randomUUID() is available in modern webviews (Tauri 2 ships
  // WebKit ≥ 16.4 on macOS) — no extra dep needed.
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultProfile(overrides?: Partial<ProfileConfig>): ProfileConfig {
  return {
    id: overrides?.id ?? newProfileId(),
    name: overrides?.name ?? 'Default',
    mode: overrides?.mode ?? 'remote',
    remoteBaseUrl: overrides?.remoteBaseUrl ?? 'http://127.0.0.1:3100',
    localBaseUrl: overrides?.localBaseUrl ?? 'http://127.0.0.1:3100',
    llmBackend: overrides?.llmBackend ?? 'nearai'
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  activeProfileId: DEFAULT_PROFILE_ID,
  profiles: [defaultProfile({ id: DEFAULT_PROFILE_ID, name: 'Default' })],
  onboardingComplete: false,
  adminMode: false,
  trayEnabled: true
};

/**
 * Detect whether we're running inside the Tauri webview. During `vite build`
 * or `npm run dev` outside Tauri, IPC isn't available — we fall back to
 * defaults so the UI still renders for design/debug work.
 */
function inTauri(): boolean {
  // Tauri 2 exposes window.__TAURI_INTERNALS__ in the runtime webview.
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Shape of the legacy (pre-Profiles) settings file. Kept narrow on
 *  purpose — anything else is just preserved into the migrated profile. */
interface LegacyAppSettings {
  mode?: ConnectionMode;
  remoteBaseUrl?: string;
  localBaseUrl?: string;
  llmBackend?: LlmBackend;
  onboardingComplete?: boolean;
  trayEnabled?: boolean;
}

/**
 * Take whatever's on disk and produce a valid `AppSettings`. Pure — no IPC.
 *
 * Handles three cases:
 *   1. Empty / missing file → fresh defaults (one Default profile).
 *   2. Legacy flat shape (no `profiles` array) → wrap into a single
 *      profile with id `DEFAULT_PROFILE_ID`. The Rust keychain layer
 *      will promote the suffix-less Keychain entries to `:default` on
 *      first read.
 *   3. Profile-aware shape → trust it, but defensively re-anchor
 *      `activeProfileId` to the first profile if it points nowhere.
 */
function migrateLoaded(
  raw: Partial<AppSettings> & LegacyAppSettings
): AppSettings {
  // Case 3 + 2 share the same input — `profiles` being a non-empty array
  // is the discriminator.
  if (Array.isArray(raw.profiles) && raw.profiles.length > 0) {
    const profiles = raw.profiles.map((p) => ({
      id: p.id || newProfileId(),
      name: p.name || 'Untitled',
      mode: (p.mode === 'local' ? 'local' : 'remote') as ConnectionMode,
      remoteBaseUrl: p.remoteBaseUrl || 'http://127.0.0.1:3100',
      localBaseUrl: p.localBaseUrl || 'http://127.0.0.1:3100',
      llmBackend: (p.llmBackend === 'openrouter' ? 'openrouter' : 'nearai') as LlmBackend
    }));
    const activeId =
      raw.activeProfileId && profiles.some((p) => p.id === raw.activeProfileId)
        ? raw.activeProfileId
        : profiles[0].id;
    return {
      activeProfileId: activeId,
      profiles,
      onboardingComplete: raw.onboardingComplete === true,
      // adminMode is opt-in — only true when explicitly stored as boolean
      // true. Older settings files that don't carry the field round-trip
      // as `false`, which matches the "do not surface admin routes by
      // default" intent.
      adminMode: raw.adminMode === true,
      // trayEnabled is opt-OUT — defaults to true so a fresh install
      // gets the tray icon by default. Only an explicit `false` on disk
      // hides it.
      trayEnabled: raw.trayEnabled !== false
    };
  }

  // Legacy flat → single profile. Keep the same id so Keychain promotion
  // lines up. If even the legacy fields are empty (fresh install via
  // get_settings's `{}` first-run response), we still produce one default
  // profile so the rest of the app has something to render.
  const profile = defaultProfile({
    id: DEFAULT_PROFILE_ID,
    name: 'Default',
    mode: raw.mode ?? 'remote',
    remoteBaseUrl: raw.remoteBaseUrl ?? 'http://127.0.0.1:3100',
    localBaseUrl: raw.localBaseUrl ?? 'http://127.0.0.1:3100',
    llmBackend: raw.llmBackend ?? 'nearai'
  });
  return {
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [profile],
    onboardingComplete: raw.onboardingComplete === true,
    adminMode: raw.adminMode === true,
    trayEnabled: raw.trayEnabled !== false
  };
}

// ---- Live in-memory cache -------------------------------------------------
//
// All the helpers below mutate this and immediately persist via
// `saveSettings`. The `connection` store also keeps its own copy in a
// Svelte 5 `$state` field — it pulls from here in `refresh()`.

let cached: AppSettings | null = null;

export async function loadSettings(): Promise<AppSettings> {
  if (!inTauri()) {
    cached = structuredClone(DEFAULT_SETTINGS);
    return cached;
  }
  try {
    const raw = await invoke<Partial<AppSettings> & LegacyAppSettings>('get_settings');
    cached = migrateLoaded(raw ?? {});
    return cached;
  } catch (err) {
    console.warn('loadSettings failed; returning defaults', err);
    cached = structuredClone(DEFAULT_SETTINGS);
    return cached;
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  // Always update the in-memory cache before persisting so subsequent
  // helper calls see the same view of the world even if the IPC write
  // is in-flight.
  cached = structuredClone(s);
  if (!inTauri()) {
    console.warn('saveSettings called outside Tauri; no-op');
    return;
  }
  await invoke('save_settings', { settings: s });
}

// ---- Profile helpers ------------------------------------------------------
//
// All helpers operate on the in-memory cache + persist immediately.
// `loadSettings()` MUST have been called once before these are used — the
// app's mount path (connection.init → loadSettings) takes care of that.

function requireCache(): AppSettings {
  if (!cached) {
    throw new Error(
      'settings: cache not initialized — call loadSettings() before mutating'
    );
  }
  return cached;
}

/** The currently active profile. Throws if settings haven't been loaded. */
export function getActiveProfile(): ProfileConfig {
  const s = requireCache();
  const p =
    s.profiles.find((x) => x.id === s.activeProfileId) ?? s.profiles[0];
  if (!p) throw new Error('settings: no profiles configured');
  return p;
}

/** Read-only snapshot of all profiles, in stored order. */
export function listProfiles(): ProfileConfig[] {
  return [...requireCache().profiles];
}

/** Persist a new active profile. Throws if the id doesn't exist. */
export async function setActiveProfile(id: string): Promise<void> {
  const s = requireCache();
  if (!s.profiles.some((p) => p.id === id)) {
    throw new Error(`setActiveProfile: unknown profile id ${id}`);
  }
  if (s.activeProfileId === id) return;
  const next: AppSettings = { ...s, activeProfileId: id };
  await saveSettings(next);
}

/**
 * Append a fresh profile and persist. Returns the new profile so callers
 * can chain (e.g. `setActiveProfile(addProfile(name).id)`).
 */
export async function addProfile(
  name: string,
  base?: Partial<ProfileConfig>
): Promise<ProfileConfig> {
  const s = requireCache();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('addProfile: name required');
  if (trimmed.length >= 64) throw new Error('addProfile: name too long');
  const profile = defaultProfile({ ...base, id: newProfileId(), name: trimmed });
  const next: AppSettings = { ...s, profiles: [...s.profiles, profile] };
  await saveSettings(next);
  return profile;
}

/**
 * Apply a partial update to a single profile + persist. Silently no-ops if
 * the id doesn't exist (caller is expected to validate first).
 */
export async function updateProfile(
  id: string,
  patch: Partial<ProfileConfig>
): Promise<void> {
  const s = requireCache();
  const idx = s.profiles.findIndex((p) => p.id === id);
  if (idx === -1) return;
  // Forbid id mutation — that would orphan Keychain entries.
  const { id: _ignored, ...safePatch } = patch;
  const merged: ProfileConfig = { ...s.profiles[idx], ...safePatch };
  const next: AppSettings = {
    ...s,
    profiles: s.profiles.map((p, i) => (i === idx ? merged : p))
  };
  await saveSettings(next);
}

/**
 * Remove a profile. Refuses if it's the last remaining profile (we always
 * keep at least one), and refuses to delete the active profile when it's
 * the only one — callers should switch active first.
 */
export async function deleteProfile(id: string): Promise<void> {
  const s = requireCache();
  if (s.profiles.length <= 1) {
    throw new Error('deleteProfile: cannot remove the last profile');
  }
  const target = s.profiles.find((p) => p.id === id);
  if (!target) return;
  if (id === s.activeProfileId && s.profiles.length === 1) {
    // Defensive — the length check above covers this, but make the
    // intent explicit.
    throw new Error('deleteProfile: cannot remove the active-and-only profile');
  }
  // Drop the entry. If we just removed the active one, pivot to the first
  // remaining profile so the connection store always has a target.
  const profiles = s.profiles.filter((p) => p.id !== id);
  const activeProfileId =
    s.activeProfileId === id ? profiles[0].id : s.activeProfileId;
  const next: AppSettings = { ...s, profiles, activeProfileId };
  await saveSettings(next);
  // Best-effort credential cleanup — never throws (delete is no-op when
  // the entry doesn't exist).
  try {
    await deleteToken(id);
  } catch (err) {
    console.warn('deleteProfile: deleteToken failed', err);
  }
  try {
    await deleteOpenRouterKey(id);
  } catch (err) {
    console.warn('deleteProfile: deleteOpenRouterKey failed', err);
  }
}

// ---- Gateway-token Keychain (per-profile) --------------------------------

export async function getToken(profileId: string): Promise<string | null> {
  if (!inTauri()) return null;
  try {
    const t = await invoke<string | null>('get_token', { profileId });
    return t ?? null;
  } catch (err) {
    console.warn('getToken failed', err);
    return null;
  }
}

export async function setToken(profileId: string, token: string): Promise<void> {
  if (!inTauri()) {
    console.warn('setToken called outside Tauri; no-op');
    return;
  }
  await invoke('set_token', { profileId, token });
}

export async function deleteToken(profileId: string): Promise<void> {
  if (!inTauri()) {
    console.warn('deleteToken called outside Tauri; no-op');
    return;
  }
  await invoke('delete_token', { profileId });
}

// ---- OpenRouter key (Keychain, per-profile) ------------------------------

export async function getOpenRouterKey(profileId: string): Promise<string | null> {
  if (!inTauri()) return null;
  try {
    const k = await invoke<string | null>('get_openrouter_key', { profileId });
    return k ?? null;
  } catch (err) {
    console.warn('getOpenRouterKey failed', err);
    return null;
  }
}

export async function setOpenRouterKey(profileId: string, key: string): Promise<void> {
  if (!inTauri()) {
    console.warn('setOpenRouterKey called outside Tauri; no-op');
    return;
  }
  await invoke('set_openrouter_key', { profileId, key });
}

export async function deleteOpenRouterKey(profileId: string): Promise<void> {
  if (!inTauri()) {
    console.warn('deleteOpenRouterKey called outside Tauri; no-op');
    return;
  }
  await invoke('delete_openrouter_key', { profileId });
}

// ---- Local gateway token (auto-generated UUID for sidecar auth) ----------

export async function getOrCreateLocalToken(): Promise<string | null> {
  if (!inTauri()) return null;
  try {
    return await invoke<string>('get_or_create_local_token');
  } catch (err) {
    console.warn('getOrCreateLocalToken failed', err);
    return null;
  }
}

// ---- Data directory (for "reveal in Finder" UX) --------------------------

export async function localDataDir(): Promise<string | null> {
  if (!inTauri()) return null;
  try {
    return await invoke<string>('local_data_dir');
  } catch (err) {
    console.warn('localDataDir failed', err);
    return null;
  }
}

export async function revealInFinder(path: string): Promise<void> {
  if (!inTauri()) {
    console.warn('revealInFinder called outside Tauri; no-op');
    return;
  }
  await invoke('reveal_in_finder', { path });
}

// ---- Sidecar lifecycle ---------------------------------------------------

export interface SidecarStatusPayload {
  running: boolean;
  port: number | null;
}

export async function startSidecar(
  profileId: string,
  backend?: LlmBackend
): Promise<number> {
  if (!inTauri()) throw new Error('startSidecar requires the Tauri runtime');
  // Forward the chosen backend; the Rust side defaults to NEAR.AI if
  // omitted. Passing it explicitly keeps the spawn deterministic across
  // tabs/processes. The profileId scopes the OpenRouter-key lookup.
  return invoke<number>('start_sidecar', {
    backend: backend ?? 'nearai',
    profileId
  });
}

export async function stopSidecar(): Promise<void> {
  if (!inTauri()) return;
  await invoke('stop_sidecar');
}

export async function sidecarStatus(): Promise<SidecarStatusPayload> {
  if (!inTauri()) return { running: false, port: null };
  return invoke<SidecarStatusPayload>('sidecar_status');
}
