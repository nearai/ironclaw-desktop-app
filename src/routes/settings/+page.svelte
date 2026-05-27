<script lang="ts">
  // Settings page — profile-aware.
  //
  // Layout (top → bottom):
  //   1. Active-profile header (just the name + "manage profiles" link).
  //   2. Connection mode + URLs + token + OpenRouter key for the active
  //      profile. All credentials are scoped per profile so editing here
  //      never touches another profile's state.
  //   3. Test connection — runs a health check against the active profile.
  //   4. Sidecar controls / data dir (only when active profile is local).
  //   5. All profiles (#profiles anchor) — list with quick switch, rename,
  //      delete. The Sidebar's "Manage profiles" link scrolls here.
  //   6. About + manual update check + bulk export + notifications +
  //      re-run onboarding.

  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { invoke } from '@tauri-apps/api/core';
  import { open as shellOpen } from '@tauri-apps/plugin-shell';
  import { IronClawClient } from '$lib/api/ironclaw';
  import type { UserToken } from '$lib/api/types';
  import {
    buildThreadJsonShape,
    exportSettings,
    importSettings,
    saveTextDialog,
    todayStamp,
    type BulkExportShape
  } from '$lib/api/files';
  import {
    addProfile,
    deleteProfile,
    deleteToken,
    getOpenRouterKey,
    getOrCreateLocalToken,
    getToken,
    importSettingsFromString,
    loadSettings,
    localDataDir,
    PROFILE_TINT_ORDER,
    PROFILE_TINTS,
    resolveTint,
    revealInFinder,
    saveSettings,
    setToken,
    updateProfile,
    type AppSettings,
    type ConnectionMode,
    type ProfileConfig,
    type ProfileTint
  } from '$lib/stores/settings.svelte';
  import { connection, type SidecarStatus } from '$lib/stores/connection.svelte';
  import { signIn } from '$lib/stores/sign-in.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import { relativeTime, updater, type UpdaterCadence } from '$lib/stores/updater.svelte';
  import {
    notifications,
    SOUND_CHOICES,
    type SoundChoice
  } from '$lib/stores/notifications.svelte';
  import { aboutStore } from '$lib/stores/about.svelte';
  import MaskedValue from '$lib/components/MaskedValue.svelte';
  import { redactJsonObject } from '$lib/utils/redact';
  import LlmProviderPicker from './LlmProviderPicker.svelte';

  // ---- Page state -------------------------------------------------------
  //
  // We keep a local mutable copy of AppSettings so the form inputs can
  // edit fields without round-tripping through the connection store on
  // every keystroke. `onSaveSettings` persists; `connection.refresh()`
  // picks the new shape up.

  let settings = $state<AppSettings>({
    activeProfileId: '',
    profiles: [],
    onboardingComplete: true,
    adminMode: false,
    trayEnabled: true,
    useResponsesApi: true,
    engineV2Enabled: false
  });

  /** Derived shorthand for the currently-selected profile inside the local
   *  draft. All "active profile" form inputs read/write through this. */
  const activeProfile = $derived<ProfileConfig | null>(
    settings.profiles.find((p) => p.id === settings.activeProfileId) ?? null
  );

  let tokenInput = $state('');
  let tokenStored = $state(false);

  let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  let saveMessage = $state<string | null>(null);

  let tokenStatus = $state<'idle' | 'saving' | 'saved' | 'cleared' | 'error'>('idle');
  let tokenMessage = $state<string | null>(null);

  let testStatus = $state<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  let testMessage = $state<string | null>(null);

  let appVersion = $state<string>('0.1.0');
  let apiInfo = $state<string>('—');

  // ---- Local-mode state -------------------------------------------------
  //
  // The legacy NEAR.AI / OpenRouter radio + its dedicated key input was
  // replaced by <LlmProviderPicker />; the picker owns its own form
  // state. `openRouterStored` is still tracked here so the sidecar
  // "Start" button can disable when no OpenRouter key is on disk yet
  // (one of the two backward-compat paths in the Rust sidecar layer).

  let openRouterStored = $state(false);

  let dataDir = $state<string | null>(null);

  // Test-notification button state.
  let testNotifyStatus = $state<'idle' | 'sending' | 'sent' | 'denied' | 'error'>('idle');
  let testNotifyMessage = $state<string | null>(null);

  // ---- Profile-list inline-rename state --------------------------------

  let renamingProfileId = $state<string | null>(null);
  let renameDraft = $state('');

  // ---- Updater "last checked" ticker -----------------------------------
  //
  // relativeTime() reads Date.now() so it won't re-render on its own when
  // a minute rolls past. We tick `nowTick` once a minute while mounted so
  // the "Checked N minutes ago" label stays honest without paying for a
  // higher-resolution interval. The derived label below depends on this
  // and on `updater.lastCheckedAt`.
  let nowTick = $state(0);
  const lastCheckedLabel = $derived.by(() => {
    void nowTick;
    return relativeTime(updater.lastCheckedAt);
  });

  onMount(async () => {
    settings = await loadSettings();
    await refreshProfileCredentials();
    dataDir = await localDataDir();
    // Re-hydrate notification prefs in case the user opened /settings
    // before the layout's onMount ran (rare; usually a no-op).
    notifications.hydrate();
    void notifications.ensurePermission();
    void refreshAbout();

    // Hydrate updater store (cadence, last-checked, skipped version) in
    // case the user landed on /settings before the layout ran (deep link
    // on first launch). hydrate() is idempotent.
    updater.hydrate();

    // If the page was opened with #profiles in the URL, scroll there.
    if (page.url.hash === '#profiles') {
      await tick();
      const el = document.getElementById('profiles');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // Tick the "Checked N minutes ago" label once a minute. Lives as a
  // top-level $effect so the cleanup is registered synchronously
  // (onMount above is async and would lose the cleanup return value).
  // Higher resolution isn't worth the wake-ups for a relative-time string.
  $effect(() => {
    const tickId = setInterval(() => {
      nowTick++;
    }, 60_000);
    return () => clearInterval(tickId);
  });

  /** Cadence dropdown handler — delegates to the store so the timer is
   *  re-armed (or cleared on "never") consistently. */
  function onCadenceChange(e: Event) {
    const target = e.currentTarget as HTMLSelectElement;
    updater.setCadence(target.value as UpdaterCadence);
  }

  /** Re-read the Keychain entries for the currently-active profile. Called
   *  on mount and on every profile switch so the "(stored)" placeholders
   *  reflect the right slot. */
  async function refreshProfileCredentials() {
    const id = settings.activeProfileId;
    if (!id) {
      tokenStored = false;
      openRouterStored = false;
      return;
    }
    tokenInput = '';
    const t = await getToken(id);
    tokenStored = !!t;
    const or = await getOpenRouterKey(id);
    openRouterStored = !!or;
  }

  async function onTestNotification() {
    testNotifyStatus = 'sending';
    testNotifyMessage = null;
    const granted = await notifications.ensurePermission();
    if (!granted) {
      testNotifyStatus = 'denied';
      testNotifyMessage =
        'OS denied notifications. Enable IronClaw in System Settings → Notifications.';
      toasts.show('Notifications denied by macOS', 'error');
      return;
    }
    try {
      await notifications.notify({
        title: 'IronClaw test notification',
        body: 'If you can see this, notifications are wired up.',
        soundOverride: 'default'
      });
      testNotifyStatus = 'sent';
      testNotifyMessage = 'Sent — check Notification Center.';
    } catch (err) {
      testNotifyStatus = 'error';
      testNotifyMessage = (err as Error).message;
    }
  }

  /**
   * Audition a sound by firing a one-shot test notification with the
   * given symbolic choice. Bypasses the per-category preference and
   * quiet-hours muting (via `soundOverride`) so the user always hears
   * what they picked. Surfaces denial via a toast — silent failure
   * would make the "Preview" button feel broken.
   */
  async function onPreviewSound(category: 'chat' | 'routine' | 'sidecar', sound: SoundChoice) {
    const granted = await notifications.ensurePermission();
    if (!granted) {
      toasts.show('Notifications denied by macOS', 'error');
      return;
    }
    const label =
      category === 'chat' ? 'Chat reply' : category === 'routine' ? 'Routine' : 'Sidecar';
    try {
      await notifications.notify({
        title: `${label} sound preview`,
        body: SOUND_CHOICES.find((c) => c.value === sound)?.label ?? sound,
        soundOverride: sound
      });
    } catch (err) {
      toasts.show(`Preview failed: ${(err as Error).message}`, 'error');
    }
  }

  async function refreshAbout() {
    if (!connection.client) {
      apiInfo = 'Not connected';
      return;
    }
    try {
      const s = await connection.client.gatewayStatus();
      apiInfo = `connections: ${s.total_connections} (ws ${s.ws_connections})`;
    } catch (err) {
      apiInfo = `error: ${(err as Error).message}`;
    }
  }

  // ---- Active-profile field handlers -----------------------------------

  function patchActiveProfile(patch: Partial<ProfileConfig>) {
    if (!activeProfile) return;
    settings = {
      ...settings,
      profiles: settings.profiles.map((p) =>
        p.id === activeProfile.id ? { ...p, ...patch } : p
      )
    };
  }

  function onModeChange(m: ConnectionMode) {
    patchActiveProfile({ mode: m });
  }

  async function onSaveSettings() {
    saveStatus = 'saving';
    saveMessage = null;
    try {
      await saveSettings($state.snapshot(settings));
      await connection.refresh();
      saveStatus = 'saved';
      saveMessage = 'Saved.';
      toasts.show('Settings saved', 'success');
    } catch (err) {
      saveStatus = 'error';
      saveMessage = (err as Error).message;
      toasts.show(`Save failed: ${saveMessage}`, 'error');
    }
  }

  async function onSaveToken() {
    if (!activeProfile) return;
    const t = tokenInput.trim();
    if (!t) {
      tokenStatus = 'error';
      tokenMessage = 'Token is empty.';
      toasts.show('Token is empty', 'error');
      return;
    }
    tokenStatus = 'saving';
    tokenMessage = null;
    try {
      await setToken(activeProfile.id, t);
      tokenStored = true;
      tokenInput = '';
      await connection.refresh();
      tokenStatus = 'saved';
      tokenMessage = 'Stored in Keychain.';
      toasts.show('Token stored', 'success');
    } catch (err) {
      tokenStatus = 'error';
      tokenMessage = (err as Error).message;
      toasts.show(`Token save failed: ${tokenMessage}`, 'error');
    }
  }

  async function onClearToken() {
    if (!activeProfile) return;
    tokenStatus = 'saving';
    tokenMessage = null;
    try {
      await deleteToken(activeProfile.id);
      tokenStored = false;
      tokenInput = '';
      await connection.refresh();
      tokenStatus = 'cleared';
      tokenMessage = 'Cleared.';
      toasts.show('Token cleared', 'success');
    } catch (err) {
      tokenStatus = 'error';
      tokenMessage = (err as Error).message;
      toasts.show(`Token clear failed: ${tokenMessage}`, 'error');
    }
  }

  async function onTestConnection() {
    if (!activeProfile) return;
    testStatus = 'testing';
    testMessage = null;
    try {
      const token =
        activeProfile.mode === 'local'
          ? await getOrCreateLocalToken()
          : await getToken(activeProfile.id);
      if (!token) {
        testStatus = 'fail';
        testMessage =
          activeProfile.mode === 'local'
            ? 'Local gateway token not initialized.'
            : 'No token saved.';
        toasts.show(`Test connection failed: ${testMessage}`, 'error');
        return;
      }
      const baseUrl =
        activeProfile.mode === 'local'
          ? connection.sidecarPort
            ? `http://127.0.0.1:${connection.sidecarPort}`
            : activeProfile.localBaseUrl
          : activeProfile.remoteBaseUrl;
      const client = new IronClawClient({ baseUrl, token });
      const h = await client.health();
      if (h.ok) {
        testStatus = 'ok';
        testMessage = `Healthy — status="${h.status}"`;
        toasts.show('Test connection OK', 'info');
        void refreshAbout();
      } else {
        testStatus = 'fail';
        testMessage = `Unhealthy — status="${h.status ?? 'unknown'}"`;
        toasts.show(`Test connection failed: ${testMessage}`, 'error');
      }
    } catch (err) {
      testStatus = 'fail';
      testMessage = (err as Error).message;
      toasts.show(`Test connection failed: ${testMessage}`, 'error');
    }
  }

  async function onSignInToNearAi() {
    if (connection.sidecarStatus !== 'running') {
      const ok = await connection.startSidecar();
      if (!ok) {
        toasts.show(
          `Could not start sidecar: ${connection.sidecarError ?? 'unknown'}`,
          'error'
        );
        return;
      }
    }
    const port = connection.sidecarPort;
    if (!port) {
      toasts.show('Sidecar started but no port resolved', 'error');
      return;
    }
    try {
      await shellOpen(`http://127.0.0.1:${port}/`);
      toasts.show('Opened IronClaw — complete NEAR sign-in there', 'info');
    } catch (err) {
      toasts.show(`Could not open browser: ${(err as Error).message}`, 'error');
    }
  }

  /** Re-probe /api/profile on demand. Used by the Retry button and the
   *  inline "Refresh" affordance next to the sign-in dot. */
  async function onRefreshSignIn() {
    await signIn.refresh();
  }

  /**
   * Sign out of NEAR.AI. TODO: the gateway does not yet expose a
   * `DELETE /api/profile` / `POST /api/auth/signout` endpoint (verified
   * against IronClaw 0.28.2). For now we just nudge the user to the web UI
   * to complete the sign-out flow there; once the server lands the endpoint
   * this handler should call `connection.client.signOut()` directly.
   */
  async function onSignOutFromNearAi() {
    if (connection.sidecarStatus !== 'running' || !connection.sidecarPort) {
      toasts.show('Sidecar not running — nothing to sign out of', 'info');
      return;
    }
    try {
      await shellOpen(`http://127.0.0.1:${connection.sidecarPort}/`);
      toasts.show(
        'Opened IronClaw — sign out from the web UI, then click Refresh',
        'info'
      );
    } catch (err) {
      toasts.show(`Could not open browser: ${(err as Error).message}`, 'error');
    }
  }

  /**
   * Derived label for the sign-in row. Local mode talks about "NEAR.AI",
   * remote mode talks about generic "gateway auth" since the remote
   * profile may or may not be NEAR-cloud-backed.
   */
  const signInIdentityLabel = $derived.by<string>(() => {
    const p = signIn.profile;
    if (!p) return '';
    if (p.near_account) return `@${p.near_account}`;
    if (p.display_name) return p.display_name;
    if (p.email) return p.email;
    if (p.user_id) return p.user_id;
    return 'Signed in';
  });

  /** True when the local sidecar is fully up. Drives the auth panel's
   *  branch — when false we show "start the sidecar first" rather than
   *  a misleading "Not signed in" (the /api/profile probe would just
   *  hang against a dead sidecar). */
  const sidecarUp = $derived(connection.sidecarStatus === 'running');

  /**
   * Flip the app-level "show admin surfaces" toggle. App-level, NOT
   * per-profile — see the comment on AppSettings.adminMode. We persist
   * immediately so the sidebar visibility + the layout's redirect guard
   * pick the change up without a save-button round-trip.
   */
  async function onToggleAdminMode(next: boolean) {
    try {
      const draft = { ...$state.snapshot(settings), adminMode: next };
      await saveSettings(draft);
      settings = draft;
      // connection.settings is the source-of-truth for cross-route reads
      // (sidebar item, +layout shortcut + redirect). Refresh so the field
      // there matches what we just wrote.
      await connection.refresh();
      toasts.show(
        next ? 'Admin surfaces enabled' : 'Admin surfaces hidden',
        'info'
      );
    } catch (err) {
      toasts.show(`Save failed: ${(err as Error).message}`, 'error');
    }
  }

  /**
   * Flip the app-level "Show in menu bar" toggle. App-level, NOT
   * per-profile — the tray icon is global chrome. We persist first so
   * the next launch honours the choice, then push the live visibility
   * change to the Rust tray module so the icon appears/disappears
   * without a relaunch.
   */
  async function onToggleTrayEnabled(next: boolean) {
    try {
      const draft = { ...$state.snapshot(settings), trayEnabled: next };
      await saveSettings(draft);
      settings = draft;
      // Live visibility flip. Errors here are not fatal — the persisted
      // value still wins on the next launch.
      try {
        await invoke('set_tray_visible', { visible: next });
      } catch (err) {
        console.warn('set_tray_visible failed', err);
      }
      await connection.refresh();
      toasts.show(
        next ? 'Menu-bar icon shown' : 'Menu-bar icon hidden',
        'info'
      );
    } catch (err) {
      toasts.show(`Save failed: ${(err as Error).message}`, 'error');
    }
  }

  /**
   * Flip the app-level "Use Responses API streaming" toggle. The chat
   * surface re-reads the setting on every send (cheap — loadSettings()
   * hits the in-memory cache after the first call), so the change applies
   * to the very next message without a relaunch. Pinning OFF forces the
   * legacy /api/chat/send + /api/chat/events pipeline even on a gateway
   * that supports /api/v1/responses.
   */
  async function onToggleResponsesApi(next: boolean) {
    try {
      const draft = { ...$state.snapshot(settings), useResponsesApi: next };
      await saveSettings(draft);
      settings = draft;
      toasts.show(
        next
          ? 'Responses API streaming enabled'
          : 'Pinned to legacy /api/chat streaming',
        'info'
      );
    } catch (err) {
      toasts.show(`Save failed: ${(err as Error).message}`, 'error');
    }
  }

  /**
   * Flip the app-level "Show Engine v2 surface" toggle. App-level, NOT
   * per-profile — Engine v2 is a chrome preference like `adminMode`. We
   * persist immediately and refresh `connection.settings` so the sidebar
   * entry, the Cmd+9 chord, and the route guard pick the change up
   * without a save-button round-trip. The layout's $effect bounces the
   * user off `/missions` if they were sitting on it when the toggle
   * flips off.
   */
  async function onToggleEngineV2(next: boolean) {
    try {
      const draft = { ...$state.snapshot(settings), engineV2Enabled: next };
      await saveSettings(draft);
      settings = draft;
      await connection.refresh();
      toasts.show(
        next ? 'Engine v2 surface enabled' : 'Engine v2 surface hidden',
        'info'
      );
    } catch (err) {
      toasts.show(`Save failed: ${(err as Error).message}`, 'error');
    }
  }

  async function onRerunOnboarding() {
    try {
      const next = { ...$state.snapshot(settings), onboardingComplete: false };
      await saveSettings(next);
      settings = next;
      await goto('/onboarding');
    } catch (err) {
      toasts.show(`Could not start onboarding: ${(err as Error).message}`, 'error');
    }
  }

  // ---- Settings backup (export / import) -------------------------------
  // Tokens / OpenRouter keys are NOT included — they live in the macOS
  // Keychain, not settings.json. After importing on a new machine the
  // user has to open each profile and re-enter credentials. We toast a
  // reminder once the new settings hit disk.

  let settingsExportBusy = $state(false);
  let settingsImportBusy = $state(false);

  async function onExportSettings() {
    if (settingsExportBusy) return;
    settingsExportBusy = true;
    try {
      const saved = await exportSettings();
      if (saved === null) {
        toasts.show('Settings export cancelled', 'info');
      } else {
        toasts.show(`Settings exported to ${saved}`, 'success');
      }
    } catch (err) {
      toasts.show(`Settings export failed: ${(err as Error).message}`, 'error');
    } finally {
      settingsExportBusy = false;
    }
  }

  async function onImportSettings() {
    if (settingsImportBusy) return;
    settingsImportBusy = true;
    try {
      const raw = await importSettings();
      if (raw === null) {
        toasts.show('Settings import cancelled', 'info');
        return;
      }
      // validateImportedSettings runs inside importSettingsFromString and
      // throws with a specific reason on failure.
      const imported = await importSettingsFromString(raw);
      // Refresh the in-memory copy + the connection store so the new
      // shape is live without a relaunch. Keychain entries on the new
      // machine won't match the imported profile ids — connection layer
      // already treats missing tokens as "needs setup", so the UI will
      // surface that on its own.
      settings = imported;
      await refreshProfileCredentials();
      await connection.refresh();
      toasts.show(
        `Imported ${imported.profiles.length} profile${imported.profiles.length === 1 ? '' : 's'}. Re-enter tokens per profile below.`,
        'success'
      );
    } catch (err) {
      toasts.show(`Settings import failed: ${(err as Error).message}`, 'error');
    } finally {
      settingsImportBusy = false;
    }
  }

  // ---- Bulk export ------------------------------------------------------
  // "Export all conversations" pulls /api/chat/threads then walks each
  // thread's history (limit=10000) and bakes everything into one JSON
  // blob. Concurrency is capped at 3 in flight so a chatty gateway
  // doesn't get pummeled, while a user with hundreds of threads still
  // finishes in a reasonable time.
  let bulkExportRunning = $state(false);
  let bulkExportProgress = $state<{ done: number; total: number } | null>(null);
  const BULK_EXPORT_CONCURRENCY = 3;

  async function onExportAllConversations() {
    if (!connection.client || bulkExportRunning) return;
    bulkExportRunning = true;
    bulkExportProgress = { done: 0, total: 0 };
    let progressToastId: number | null = null;
    try {
      const client = connection.client;
      const allThreads = await client.listThreads();
      if (allThreads.length === 0) {
        toasts.show('No conversations to export', 'info');
        return;
      }
      bulkExportProgress = { done: 0, total: allThreads.length };
      progressToastId = toasts.show(
        `Exporting 0 of ${allThreads.length}…`,
        'info'
      );

      const out: BulkExportShape['threads'] = new Array(allThreads.length);
      let cursor = 0;
      let done = 0;
      const worker = async () => {
        while (true) {
          const i = cursor++;
          if (i >= allThreads.length) return;
          const t = allThreads[i];
          try {
            const msgs = await client.getHistory(t.id, 10000);
            out[i] = buildThreadJsonShape(t, msgs);
          } catch (err) {
            console.warn('bulk export: history failed', t.id, err);
            out[i] = buildThreadJsonShape(
              { ...t, title: `${t.title} [history fetch failed]` },
              []
            );
          }
          done += 1;
          bulkExportProgress = { done, total: allThreads.length };
          if (progressToastId !== null) {
            toasts.dismiss(progressToastId);
            progressToastId = toasts.show(
              `Exporting ${done} of ${allThreads.length}…`,
              'info'
            );
          }
        }
      };
      const workers = Array.from(
        { length: Math.min(BULK_EXPORT_CONCURRENCY, allThreads.length) },
        () => worker()
      );
      await Promise.all(workers);

      const blob: BulkExportShape = {
        exported_at: new Date().toISOString(),
        version: 1,
        threads: out
      };
      const filename = `ironclaw-conversations-${todayStamp()}.json`;
      const text = JSON.stringify(blob, null, 2);
      const saved = await saveTextDialog(filename, text);
      if (progressToastId !== null) {
        toasts.dismiss(progressToastId);
        progressToastId = null;
      }
      if (saved === null) {
        toasts.show('Export cancelled', 'info');
      } else {
        toasts.show(
          `Exported ${allThreads.length} conversation${allThreads.length === 1 ? '' : 's'} to ${saved}`,
          'success'
        );
      }
    } catch (err) {
      if (progressToastId !== null) {
        toasts.dismiss(progressToastId);
        progressToastId = null;
      }
      toasts.show(`Bulk export failed: ${(err as Error).message}`, 'error');
    } finally {
      bulkExportRunning = false;
      bulkExportProgress = null;
    }
  }

  // ---- Server-side settings (admin-only) -------------------------------
  // The gateway's /api/settings endpoint exposes the live server config
  // (mcp_servers, llm.*, feature flags, etc.) — useful for diagnosing
  // "why is the server doing X" without SSH'ing in. The payload can embed
  // raw bearer tokens (Round 7e smoke test confirmed this against
  // baremetal3), so every primitive value goes through MaskedValue with
  // tap-to-reveal and structured values are pretty-printed through
  // redactJsonObject. We gate the surface on adminMode + a connected
  // client so non-admin users never see the section at all.
  let serverSettings = $state<Record<string, unknown> | null>(null);
  let serverSettingsStatus = $state<'idle' | 'loading' | 'ok' | 'error'>('idle');
  let serverSettingsError = $state<string | null>(null);
  /** Per-key local toggle for "View raw (unmasked)" on structured values. */
  let serverSettingsRawKeys = $state<Record<string, boolean>>({});

  async function fetchServerSettings() {
    const client = connection.client;
    if (!client) {
      serverSettingsStatus = 'error';
      serverSettingsError = 'Not connected to a gateway.';
      return;
    }
    serverSettingsStatus = 'loading';
    serverSettingsError = null;
    try {
      // Use the RAW variant — this page implements its own per-row
      // reveal toggle (`serverSettingsRawKeys[key]`) that swaps between
      // `JSON.stringify(value)` and `JSON.stringify(redactJsonObject(value))`.
      // Calling the redacted `getSettings()` here would defeat the toggle:
      // the user would see masked bullets even when "View raw" is on,
      // since the API-layer redaction is irreversible at the call site.
      // The default `getSettings()` redact is a defense-in-depth for OTHER
      // consumers that don't implement the per-row toggle.
      const s = await client.getSettingsRaw();
      serverSettings = s;
      serverSettingsStatus = 'ok';
    } catch (err) {
      const status = (err as { status?: number }).status;
      serverSettings = null;
      serverSettingsStatus = 'error';
      if (status === 401 || status === 403) {
        serverSettingsError =
          "This profile's token doesn't have admin role. Switch profile or use an admin token.";
      } else if (status === 404) {
        serverSettingsError =
          'Server-side settings endpoint is not available on this gateway.';
      } else {
        serverSettingsError = (err as Error).message;
      }
    }
  }

  async function onRefreshServerSettings() {
    await fetchServerSettings();
    if (serverSettingsStatus === 'ok') {
      toasts.show('Server-side settings refreshed', 'info');
    } else if (serverSettingsStatus === 'error') {
      toasts.show(
        `Refresh failed: ${serverSettingsError ?? 'unknown error'}`,
        'error'
      );
    }
  }

  function toggleServerSettingsRaw(key: string) {
    serverSettingsRawKeys = {
      ...serverSettingsRawKeys,
      [key]: !serverSettingsRawKeys[key]
    };
  }

  /** True when a value should be rendered through MaskedValue (primitives)
   *  rather than the JSON-block branch (objects/arrays). null → primitive
   *  too, rendered as the literal "null". */
  function isPrimitiveLeaf(v: unknown): boolean {
    return (
      v === null ||
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean'
    );
  }

  /** Stable list view derived from the raw object so the template can
   *  iterate without re-running Object.entries on every render. Sorted
   *  alphabetically for predictable scanning. */
  const serverSettingsRows = $derived.by(() => {
    if (!serverSettings) return [] as Array<{ key: string; value: unknown }>;
    return Object.entries(serverSettings)
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => a.key.localeCompare(b.key));
  });

  /**
   * Auto-fetch on mount when adminMode + a live client are both present.
   * Re-fires if the connection store flips to a new client (profile
   * switch) so the panel reflects the active gateway. The `$effect`
   * captures `connection.client` and `connection.settings.adminMode` —
   * both reactive — so Svelte re-runs us when either changes.
   */
  $effect(() => {
    const client = connection.client;
    const admin = connection.settings.adminMode === true;
    if (!admin) {
      // adminMode flipped off — drop the snapshot so re-enabling re-fetches
      // rather than showing a stale view from a different profile.
      serverSettings = null;
      serverSettingsStatus = 'idle';
      serverSettingsError = null;
      return;
    }
    if (!client) return;
    void fetchServerSettings();
  });

  async function onStartSidecar() {
    await connection.startSidecar();
  }

  async function onStopSidecar() {
    await connection.stopSidecar();
  }

  async function onRestartSidecar() {
    await connection.stopSidecar();
    await connection.startSidecar();
  }

  async function onRevealDataDir() {
    if (!dataDir) return;
    try {
      await revealInFinder(dataDir);
    } catch (err) {
      console.warn('reveal failed', err);
    }
  }

  function sidecarLabel(s: SidecarStatus): string {
    switch (s) {
      case 'running':
        return connection.sidecarPort
          ? `running on :${connection.sidecarPort}`
          : 'running';
      case 'starting':
        return 'starting…';
      case 'exited':
        return 'exited';
      case 'error':
        return 'error';
      case 'idle':
      default:
        return 'idle';
    }
  }

  // ---- Profile-list actions --------------------------------------------

  async function onSwitchProfile(id: string) {
    if (id === settings.activeProfileId) return;
    try {
      await connection.switchProfile(id);
      // Reload local snapshot so the page reflects the new active profile
      // + fresh Keychain reads.
      settings = await loadSettings();
      await refreshProfileCredentials();
      toasts.show('Profile switched', 'info');
    } catch (err) {
      toasts.show(`Switch failed: ${(err as Error).message}`, 'error');
    }
  }

  async function onAddProfileInline() {
    try {
      const profile = await addProfile(`Profile ${settings.profiles.length + 1}`);
      settings = await loadSettings();
      renamingProfileId = profile.id;
      renameDraft = profile.name;
      toasts.show('Profile added — rename and edit below', 'success');
    } catch (err) {
      toasts.show(`Add failed: ${(err as Error).message}`, 'error');
    }
  }

  function startRename(profile: ProfileConfig) {
    renamingProfileId = profile.id;
    renameDraft = profile.name;
  }

  function cancelRename() {
    renamingProfileId = null;
    renameDraft = '';
  }

  async function commitRename() {
    const id = renamingProfileId;
    if (!id) return;
    const trimmed = renameDraft.trim();
    if (!trimmed) {
      cancelRename();
      return;
    }
    if (trimmed.length >= 64) {
      toasts.show('Name must be under 64 characters', 'error');
      return;
    }
    try {
      await updateProfile(id, { name: trimmed });
      settings = await loadSettings();
      toasts.show('Profile renamed', 'success');
    } catch (err) {
      toasts.show(`Rename failed: ${(err as Error).message}`, 'error');
    } finally {
      renamingProfileId = null;
      renameDraft = '';
    }
  }

  /**
   * Persist a tint pick from the profile-row color picker. The change is
   * immediate (no save-button round-trip) so the live accent updates
   * across windows without an extra click — same UX as the admin/tray
   * toggles further down the page.
   *
   * `connection.refresh()` is what surfaces the change to the connection
   * store's `activeProfile` and (via the $effect there) repaints the
   * `--v2-accent*` variables on the document root. We call it on every
   * tint change so the live preview happens instantly, even when the
   * tinted profile is the active one in this window.
   */
  async function onChangeTint(profile: ProfileConfig, tint: ProfileTint) {
    try {
      await updateProfile(profile.id, { tint });
      settings = await loadSettings();
      // `reloadSettings` (vs the heavier `refresh`) updates the
      // connection store's `settings` without re-pinging the gateway or
      // cycling the sidecar — tint changes are purely cosmetic and a
      // full reconnect would feel laggy on every swatch click.
      await connection.reloadSettings();
    } catch (err) {
      toasts.show(`Tint update failed: ${(err as Error).message}`, 'error');
    }
  }

  /**
   * Open a profile in a fresh window scoped to that profile. The new
   * window picks up the profile id via a `?profile=<id>` query param on
   * its initial URL; the connection store there reads it and pins the
   * window without writing back to settings.json (see
   * `connection.windowProfileOverride`). Calling this again for the
   * same profile focuses the existing window instead of duplicating.
   */
  async function onOpenProfileWindow(profile: ProfileConfig) {
    try {
      await invoke('open_profile_window', { profileId: profile.id });
      toasts.show(`Opened "${profile.name}" in a new window`, 'info');
    } catch (err) {
      toasts.show(`Open window failed: ${(err as Error).message}`, 'error');
    }
  }

  async function onDeleteProfile(profile: ProfileConfig) {
    if (settings.profiles.length <= 1) {
      toasts.show('Cannot delete the last profile', 'error');
      return;
    }
    const ok = confirm(
      `Delete profile "${profile.name}"? This also removes its stored token and OpenRouter key.`
    );
    if (!ok) return;
    try {
      const wasActive = profile.id === settings.activeProfileId;
      await deleteProfile(profile.id);
      settings = await loadSettings();
      if (wasActive) {
        await connection.refresh();
        await refreshProfileCredentials();
      }
      toasts.show('Profile deleted', 'success');
    } catch (err) {
      toasts.show(`Delete failed: ${(err as Error).message}`, 'error');
    }
  }

  // ---- API tokens ------------------------------------------------------
  //
  // User-scoped API tokens for granting external apps access to this
  // IronClaw instance without sharing the sign-in. Wire is GET/POST
  // /api/tokens and DELETE /api/tokens/{id}; the client maps the wire's
  // `token_prefix` onto `preview`. Raw token value is returned ONCE on
  // create, so the create flow has a dedicated "save this now" view that
  // displays the plaintext + Copy button before swapping back to the list.
  //
  // Refresh strategy: fetch once on mount when a client is live, refetch
  // on profile switch via the $effect below (mirrors how serverSettings
  // re-fetches), and refetch after every create/revoke.

  type TokensStatus = 'idle' | 'loading' | 'ok' | 'error';

  /** Common scope chips for the create modal. Empty selection lets the
   *  gateway apply its server-side defaults. */
  const TOKEN_SCOPES = ['chat', 'memory', 'skills', 'routines', 'admin'] as const;

  let tokens = $state<UserToken[]>([]);
  let tokensStatus = $state<TokensStatus>('idle');
  let tokensError = $state<string | null>(null);

  // Create-modal state.
  let createOpen = $state(false);
  let createName = $state('');
  let createScopes = $state<Record<string, boolean>>({});
  let creating = $state(false);
  /** Raw plaintext token shown once after create. While non-null the modal
   *  swaps to the "Your new token" view. */
  let createdToken = $state<string | null>(null);
  let createNameInputRef: HTMLInputElement | undefined = $state();
  let copyBusy = $state(false);

  // Revoke-confirm state.
  let revokeTarget = $state<UserToken | null>(null);
  let revoking = $state(false);

  const createNameTrimmed = $derived(createName.trim());
  const createNameTooLong = $derived(createNameTrimmed.length > 64);
  const canCreate = $derived(
    createNameTrimmed.length > 0 && !createNameTooLong && !creating
  );

  /** Stable derived list — newest first, courtesy of the client's sort. */
  const tokensRows = $derived(tokens);

  /**
   * Auto-fetch tokens when a live client is present. Mirrors the
   * server-side settings $effect so the panel refreshes on profile
   * switch without forcing a full page reload.
   */
  $effect(() => {
    const client = connection.client;
    if (!client) {
      tokens = [];
      tokensStatus = 'idle';
      tokensError = null;
      return;
    }
    void loadTokens();
  });

  async function loadTokens() {
    const client = connection.client;
    if (!client) {
      tokensStatus = 'error';
      tokensError = 'Not connected to a gateway.';
      return;
    }
    tokensStatus = 'loading';
    tokensError = null;
    try {
      const rows = await client.listUserTokens();
      tokens = rows;
      tokensStatus = 'ok';
    } catch (err) {
      const status = (err as { status?: number }).status;
      tokens = [];
      tokensStatus = 'error';
      if (status === 404) {
        tokensError =
          'This gateway does not expose /api/tokens. Upgrade IronClaw to manage user tokens.';
      } else if (status === 401 || status === 403) {
        tokensError =
          'Not authorised to list tokens. Check the active profile is signed in.';
      } else {
        tokensError = (err as Error).message;
      }
    }
  }

  function openCreateModal() {
    createName = '';
    createScopes = {};
    createdToken = null;
    creating = false;
    createOpen = true;
    // Defer focus a frame so the input is mounted.
    queueMicrotask(() => createNameInputRef?.focus());
  }

  function closeCreateModal() {
    if (creating) return; // don't drop the in-flight request
    createOpen = false;
    createName = '';
    createScopes = {};
    createdToken = null;
  }

  function toggleScope(scope: string) {
    createScopes = { ...createScopes, [scope]: !createScopes[scope] };
  }

  async function onSubmitCreate(e?: SubmitEvent) {
    if (e) e.preventDefault();
    if (!canCreate) return;
    const client = connection.client;
    if (!client) {
      toasts.show('Not connected to a gateway.', 'error');
      return;
    }
    creating = true;
    try {
      const selectedScopes = TOKEN_SCOPES.filter((s) => createScopes[s]);
      const res = await client.createUserToken(
        createNameTrimmed,
        selectedScopes.length > 0 ? selectedScopes : undefined
      );
      if (!res.token) {
        throw new Error('Gateway did not return a token value.');
      }
      // Swap to the "save this once" view; the list refresh happens on
      // close so the new row is in place when the modal goes away.
      createdToken = res.token;
      toasts.show('Token created', 'success');
    } catch (err) {
      toasts.show(`Create failed: ${(err as Error).message}`, 'error');
    } finally {
      creating = false;
    }
  }

  async function onCopyCreatedToken() {
    if (!createdToken) return;
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== 'function'
    ) {
      toasts.show('Clipboard unavailable in this environment.', 'error');
      return;
    }
    copyBusy = true;
    try {
      await navigator.clipboard.writeText(createdToken);
      toasts.show(
        'Token copied — treat as a secret; do not paste anywhere public.',
        'info'
      );
    } catch (err) {
      toasts.show(`Copy failed: ${(err as Error).message}`, 'error');
    } finally {
      copyBusy = false;
    }
  }

  async function onDoneCreatedToken() {
    createOpen = false;
    createdToken = null;
    createName = '';
    createScopes = {};
    await loadTokens();
  }

  function openRevokeConfirm(t: UserToken) {
    revokeTarget = t;
  }

  function closeRevokeConfirm() {
    if (revoking) return;
    revokeTarget = null;
  }

  async function onConfirmRevoke() {
    const t = revokeTarget;
    const client = connection.client;
    if (!t || !client) return;
    revoking = true;
    try {
      const res = await client.revokeUserToken(t.id);
      if (!res.ok) {
        throw new Error('Gateway did not confirm revoke.');
      }
      toasts.show(`Revoked "${t.name}"`, 'success');
      revokeTarget = null;
      await loadTokens();
    } catch (err) {
      toasts.show(`Revoke failed: ${(err as Error).message}`, 'error');
    } finally {
      revoking = false;
    }
  }

  function tokenRelative(iso: string | undefined): string {
    if (!iso) return 'Never used';
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return 'Never used';
    return relativeTime(ms);
  }

  function tokenCreatedLabel(iso: string): string {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return iso;
    return relativeTime(ms);
  }

  // Esc closes the active modal (create or revoke confirm). Mirrors the
  // pattern in NewProfileModal.svelte so behaviour is consistent across
  // dialogs on this surface.
  $effect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (revokeTarget) {
        e.preventDefault();
        closeRevokeConfirm();
      } else if (createOpen) {
        e.preventDefault();
        closeCreateModal();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
</script>

<section class="p-8 h-full overflow-auto">
  <header class="mb-6">
    <h1 class="text-2xl font-semibold text-text-primary">Settings</h1>
    <p class="text-text-muted text-sm mt-1">
      Configure your gateway profiles, credentials, and connection mode.
    </p>
  </header>

  <div class="max-w-2xl space-y-6">
    {#if activeProfile}
      <!-- Active profile header -->
      <div class="surface p-5 flex items-center justify-between">
        <div>
          <div class="text-xs uppercase tracking-wider text-text-muted">
            Active profile
          </div>
          <div class="text-base font-semibold text-text-primary mt-0.5">
            {activeProfile.name}
          </div>
        </div>
        <a
          href="#profiles"
          class="text-xs text-accent-cyan hover:underline"
        >
          Manage profiles
        </a>
      </div>

      <!-- Connection mode -->
      <div class="surface p-5">
        <h2 class="text-sm font-semibold text-text-primary mb-3">Connection mode</h2>
        <div class="space-y-2">
          <label class="flex items-start gap-3 cursor-pointer min-h-[44px]">
            <input
              type="radio"
              name="mode"
              value="remote"
              checked={activeProfile.mode === 'remote'}
              onchange={() => onModeChange('remote')}
              class="mt-1 accent-accent-cyan"
            />
            <div>
              <div class="text-sm text-text-primary">Remote</div>
              <div class="text-xs text-text-muted">
                HTTPS to a remote IronClaw gateway.
              </div>
            </div>
          </label>

          <label class="flex items-start gap-3 cursor-pointer min-h-[44px]">
            <input
              type="radio"
              name="mode"
              value="local"
              checked={activeProfile.mode === 'local'}
              onchange={() => onModeChange('local')}
              class="mt-1 accent-accent-cyan"
            />
            <div>
              <div class="text-sm text-text-primary">Local (sidecar)</div>
              <div class="text-xs text-text-muted">
                Run IronClaw as a bundled child process — no remote server required.
              </div>
            </div>
          </label>
        </div>
      </div>

      {#if activeProfile.mode === 'remote'}
        <!-- Remote: base URL + bearer -->
        <div class="surface p-5 space-y-4">
          <h2 class="text-sm font-semibold text-text-primary">Endpoint</h2>

          <div>
            <label for="remoteUrl" class="block text-xs text-text-muted mb-1">
              Remote base URL
            </label>
            <input
              id="remoteUrl"
              type="text"
              value={activeProfile.remoteBaseUrl}
              oninput={(e) =>
                patchActiveProfile({ remoteBaseUrl: e.currentTarget.value })}
              placeholder="http://127.0.0.1:3100"
              class="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-cyan transition-colors min-h-[44px]"
            />
          </div>

          <div class="flex items-center gap-3">
            <button
              onclick={onSaveSettings}
              disabled={saveStatus === 'saving'}
              class="px-4 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition disabled:opacity-50 min-h-[44px]"
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Save'}
            </button>
            {#if saveStatus === 'saved'}
              <span class="text-xs text-accent-cyan flex items-center gap-1">
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {saveMessage}
              </span>
            {:else if saveStatus === 'error'}
              <span class="text-xs text-red-400 flex items-center gap-1">
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                {saveMessage}
              </span>
            {/if}
          </div>
        </div>

        <!-- Gateway bearer (remote only) -->
        <div class="surface p-5 space-y-4">
          <h2 class="text-sm font-semibold text-text-primary">Gateway token</h2>
          <p class="text-xs text-text-muted">
            Stored per-profile in the macOS Keychain — never in plain text on disk.
          </p>

          <div>
            <label for="token" class="block text-xs text-text-muted mb-1">Token</label>
            <input
              id="token"
              type="password"
              bind:value={tokenInput}
              placeholder={tokenStored ? '•••• stored in macOS Keychain' : 'ironclaw-...'}
              class="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-cyan transition-colors min-h-[44px]"
            />
          </div>

          <div class="flex items-center gap-3">
            <button
              onclick={onSaveToken}
              disabled={tokenStatus === 'saving'}
              class="px-4 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition disabled:opacity-50 min-h-[44px]"
            >
              Save
            </button>
            <button
              onclick={onClearToken}
              disabled={!tokenStored || tokenStatus === 'saving'}
              class="px-4 py-2 rounded-md border border-border-subtle text-sm text-text-primary hover:border-accent-gold hover:text-accent-gold transition disabled:opacity-30 min-h-[44px]"
            >
              Clear
            </button>
            {#if tokenStatus === 'saved' || tokenStatus === 'cleared'}
              <span class="text-xs text-accent-cyan flex items-center gap-1">
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {tokenMessage}
              </span>
            {:else if tokenStatus === 'error'}
              <span class="text-xs text-red-400 flex items-center gap-1">
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                {tokenMessage}
              </span>
            {/if}
          </div>

          <!-- Auth status (remote mode). Same /api/profile probe as local
               mode, just labelled in gateway-auth terms since a remote
               gateway may or may not be NEAR-cloud-backed. -->
          <div class="pt-3 border-t border-border-subtle space-y-2">
            <div class="flex items-center gap-2 text-xs">
              {#if signIn.status === 'signed-in'}
                <span class="w-2 h-2 rounded-full bg-green-500"></span>
                <span class="text-text-primary">
                  Signed in as <span class="font-mono">{signInIdentityLabel}</span>
                </span>
              {:else if signIn.status === 'signed-out'}
                <span class="w-2 h-2 rounded-full bg-accent-gold"></span>
                <span class="text-text-primary">Auth required</span>
              {:else if signIn.status === 'error'}
                <span class="w-2 h-2 rounded-full bg-red-500"></span>
                <span class="text-red-400" title={signIn.lastError ?? undefined}>
                  Error: {(signIn.lastError ?? 'unknown').slice(0, 80)}
                </span>
              {:else}
                <span class="w-2 h-2 rounded-full bg-text-muted"></span>
                <span class="text-text-muted">Checking…</span>
              {/if}
              <button
                type="button"
                onclick={() => void onRefreshSignIn()}
                disabled={signIn.inflight}
                class="ml-auto text-xs text-accent-cyan hover:underline disabled:opacity-50"
              >
                {signIn.inflight ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      {:else}
        <!-- Local mode: registry-driven LLM provider picker.
             Replaces the legacy binary NEAR.AI / OpenRouter radio. Pulls
             the full provider catalog from /api/llm/providers and lets
             the user choose any registered backend; credentials are
             stored per-provider in the macOS Keychain. -->
        <LlmProviderPicker />

        <!-- NEAR.AI sign-in status (only relevant when the picker
             landed on NEAR.AI). The signIn store probes /api/profile
             against the running sidecar — kept as a dedicated card here
             because it covers the bilateral status (signed-in/-out) +
             the explicit Sign out affordance that the picker's compact
             "Sign in" button doesn't try to replicate. -->
        {#if activeProfile.llmProviderId === 'nearai' || (!activeProfile.llmProviderId && activeProfile.llmBackend === 'nearai')}
          <div class="surface p-5 space-y-4">
            <h2 class="text-sm font-semibold text-text-primary">NEAR.AI authentication</h2>
            <p class="text-xs text-text-muted">
              IronClaw handles NEAR sign-in in its own web UI. No API key is stored on this side —
              credentials live inside the sidecar's data directory.
            </p>

            <div class="flex items-center gap-2 text-xs">
              {#if !sidecarUp}
                <span class="w-2 h-2 rounded-full bg-text-muted"></span>
                <span class="text-text-muted">
                  Sidecar not running — start it to check sign-in status
                </span>
              {:else if signIn.status === 'signed-in'}
                <span class="w-2 h-2 rounded-full bg-green-500"></span>
                <span class="text-text-primary">
                  Signed in as <span class="font-mono">{signInIdentityLabel}</span>
                </span>
                {#if signIn.profile?.role && signIn.profile.role !== 'user'}
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30"
                  >
                    {signIn.profile.role}
                  </span>
                {/if}
              {:else if signIn.status === 'signed-out'}
                <span class="w-2 h-2 rounded-full bg-accent-gold"></span>
                <span class="text-text-primary">Not signed in</span>
              {:else if signIn.status === 'error'}
                <span class="w-2 h-2 rounded-full bg-red-500"></span>
                <span class="text-red-400" title={signIn.lastError ?? undefined}>
                  Error: {(signIn.lastError ?? 'unknown').slice(0, 80)}
                </span>
              {:else}
                <span class="w-2 h-2 rounded-full bg-text-muted"></span>
                <span class="text-text-muted">Checking…</span>
              {/if}
            </div>

            <div class="flex items-center gap-3 flex-wrap">
              {#if sidecarUp && signIn.status === 'signed-in'}
                <button
                  type="button"
                  onclick={onSignOutFromNearAi}
                  class="px-4 py-2 rounded-md border border-border-subtle text-sm text-text-primary hover:border-accent-gold hover:text-accent-gold transition min-h-[44px]"
                >
                  Sign out
                </button>
                <button
                  type="button"
                  onclick={() => void onRefreshSignIn()}
                  disabled={signIn.inflight}
                  class="text-xs text-accent-cyan hover:underline disabled:opacity-50"
                >
                  {signIn.inflight ? 'Refreshing…' : 'Refresh'}
                </button>
              {:else if sidecarUp && signIn.status === 'error'}
                <button
                  type="button"
                  onclick={() => void onRefreshSignIn()}
                  disabled={signIn.inflight}
                  class="px-4 py-2 rounded-md border border-accent-cyan text-accent-cyan text-sm font-semibold hover:bg-accent-cyan hover:text-bg-deep transition disabled:opacity-50 min-h-[44px]"
                >
                  {signIn.inflight ? 'Retrying…' : 'Retry'}
                </button>
              {:else}
                <button
                  type="button"
                  onclick={onSignInToNearAi}
                  class="px-4 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition min-h-[44px]"
                >
                  Sign in to NEAR.AI
                </button>
                <span class="text-xs text-text-muted">
                  Opens
                  <code class="font-mono text-text-primary"
                    >http://127.0.0.1:{connection.sidecarPort ?? '<port>'}/</code
                  >
                  in your browser.
                </span>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Data directory -->
        <div class="surface p-5 space-y-3">
          <h2 class="text-sm font-semibold text-text-primary">Data directory</h2>
          <p class="text-xs text-text-muted">
            The sidecar stores its libSQL database, memory, skills, and routine state here.
          </p>
          <div class="flex items-center gap-3">
            <code class="flex-1 text-xs font-mono text-text-primary bg-bg-deep border border-border-subtle rounded-md px-3 py-2 min-h-[44px] flex items-center break-all">
              {dataDir ?? '—'}
            </code>
            <button
              onclick={onRevealDataDir}
              disabled={!dataDir}
              class="px-4 py-2 rounded-md border border-border-subtle text-sm text-text-primary hover:border-accent-cyan hover:text-accent-cyan transition disabled:opacity-30 min-h-[44px] whitespace-nowrap"
            >
              Reveal in Finder
            </button>
          </div>
        </div>

        <!-- Sidecar status + controls -->
        <div class="surface p-5 space-y-3">
          <h2 class="text-sm font-semibold text-text-primary">Sidecar</h2>
          <div class="flex items-center gap-2 text-xs">
            <span
              class="w-2 h-2 rounded-full"
              class:bg-green-500={connection.sidecarStatus === 'running'}
              class:bg-accent-gold={connection.sidecarStatus === 'starting'}
              class:bg-red-500={connection.sidecarStatus === 'error' ||
                connection.sidecarStatus === 'exited'}
              class:bg-text-muted={connection.sidecarStatus === 'idle'}
            ></span>
            <span class="font-mono text-text-primary">{sidecarLabel(connection.sidecarStatus)}</span>
            {#if connection.sidecarError && connection.sidecarStatus === 'error'}
              <span class="text-red-400" title={connection.sidecarError}>
                — {connection.sidecarError.slice(0, 80)}
              </span>
            {/if}
          </div>

          <div class="flex items-center gap-3">
            {#if connection.sidecarStatus === 'running'}
              <button
                onclick={onRestartSidecar}
                class="px-4 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition min-h-[44px]"
              >
                Restart
              </button>
              <button
                onclick={onStopSidecar}
                class="px-4 py-2 rounded-md border border-border-subtle text-sm text-text-primary hover:border-accent-gold hover:text-accent-gold transition min-h-[44px]"
              >
                Stop
              </button>
            {:else if connection.sidecarStatus === 'starting'}
              <button
                disabled
                class="px-4 py-2 rounded-md bg-accent-cyan/50 text-bg-deep text-sm font-semibold min-h-[44px] disabled:opacity-50"
              >
                Starting…
              </button>
            {:else}
              {@const providerId =
                activeProfile.llmProviderId ?? activeProfile.llmBackend}
              {@const canStart =
                providerId === 'nearai' ||
                (providerId === 'openrouter' && openRouterStored) ||
                // For other providers the picker stores creds in its own
                // slot; we can't cheaply check them here without an IPC
                // round-trip, so let the Rust side gate with a clean
                // error if the slot is empty.
                (providerId !== 'openrouter' && providerId !== 'nearai')}
              <button
                onclick={onStartSidecar}
                disabled={!canStart}
                class="px-4 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition disabled:opacity-50 min-h-[44px]"
                title={canStart
                  ? ''
                  : 'Save the provider credential in the picker above first'}
              >
                Start
              </button>
            {/if}
          </div>
        </div>

        <!-- Save settings (mode persistence) -->
        <div class="surface p-5">
          <div class="flex items-center gap-3">
            <button
              onclick={onSaveSettings}
              disabled={saveStatus === 'saving'}
              class="px-4 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition disabled:opacity-50 min-h-[44px]"
            >
              {saveStatus === 'saving' ? 'Saving…' : 'Save mode + apply'}
            </button>
            {#if saveStatus === 'saved'}
              <span class="text-xs text-accent-cyan flex items-center gap-1">
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {saveMessage}
              </span>
            {:else if saveStatus === 'error'}
              <span class="text-xs text-red-400 flex items-center gap-1">
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                {saveMessage}
              </span>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Test connection (always shown) -->
      <div class="surface p-5 space-y-3">
        <h2 class="text-sm font-semibold text-text-primary">Test connection</h2>
        <div class="flex items-center gap-3">
          <button
            onclick={onTestConnection}
            disabled={testStatus === 'testing'}
            class="px-4 py-2 rounded-md border border-accent-cyan text-accent-cyan text-sm font-semibold hover:bg-accent-cyan hover:text-bg-deep transition disabled:opacity-50 min-h-[44px]"
          >
            {testStatus === 'testing' ? 'Testing…' : 'Run health check'}
          </button>
          {#if testStatus === 'ok'}
            <span class="text-xs text-accent-cyan flex items-center gap-1">
              <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {testMessage}
            </span>
          {:else if testStatus === 'fail'}
            <span class="text-xs text-red-400 flex items-center gap-1">
              <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              {testMessage}
            </span>
          {/if}
        </div>
      </div>
    {/if}

    <!-- All profiles. Anchored as #profiles so the Sidebar "Manage profiles"
         link scrolls here. Renders the full list with switch / rename /
         delete affordances. The active profile is highlighted with the
         accent-cyan border, matching the sidebar's active-row treatment. -->
    <div id="profiles" class="surface p-5 space-y-3 scroll-mt-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-semibold text-text-primary">All profiles</h2>
          <p class="text-xs text-text-muted mt-0.5">
            Each profile keeps its own URL, token, and OpenRouter key.
          </p>
        </div>
        <button
          type="button"
          onclick={() => void onAddProfileInline()}
          class="px-3 py-1.5 rounded-md border border-accent-cyan text-accent-cyan text-xs font-semibold hover:bg-accent-cyan hover:text-bg-deep transition min-h-[32px]"
        >
          + Add profile
        </button>
      </div>

      <ul class="space-y-2">
        {#each settings.profiles as profile (profile.id)}
          {@const isActiveRow = profile.id === settings.activeProfileId}
          {@const rowTint = resolveTint(profile.tint)}
          {@const currentTintKey = (profile.tint ?? 'signal') as ProfileTint}
          <li
            class="flex items-center gap-3 bg-bg-deep border rounded-md px-3 py-2 min-h-[48px]"
            class:border-accent-cyan={isActiveRow}
            class:border-border-subtle={!isActiveRow}
          >
            <!-- Active indicator (or switch button on inactive rows).
                 The active dot picks up the profile's tint so the
                 row's visual identity stays consistent with the sidebar
                 popover + brand glyph. -->
            {#if isActiveRow}
              <span
                class="w-2 h-2 rounded-full shrink-0"
                style="background-color: {rowTint.accent};"
                aria-label="Active profile"
              ></span>
            {:else}
              <button
                type="button"
                onclick={() => void onSwitchProfile(profile.id)}
                title="Switch to this profile"
                class="w-3.5 h-3.5 rounded-full border border-border-subtle hover:border-accent-cyan transition-colors shrink-0"
                aria-label="Switch to {profile.name}"
              ></button>
            {/if}

            <!-- Name (inline-rename when editing) -->
            <div class="flex-1 min-w-0">
              {#if renamingProfileId === profile.id}
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  type="text"
                  bind:value={renameDraft}
                  maxlength="63"
                  autofocus
                  onkeydown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void commitRename();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  onblur={() => void commitRename()}
                  class="w-full bg-bg-base border border-accent-cyan rounded px-2 py-1 text-sm font-mono text-text-primary focus:outline-none"
                  aria-label="Rename profile"
                />
              {:else}
                <button
                  type="button"
                  onclick={() => startRename(profile)}
                  class="w-full text-left text-sm text-text-primary font-mono truncate hover:text-accent-cyan transition-colors"
                  title="Click to rename"
                >
                  {profile.name}
                </button>
                <div class="text-[10px] text-text-muted font-mono mt-0.5 truncate">
                  {profile.mode === 'local'
                    ? 'local · ' +
                      (profile.llmProviderId ?? profile.llmBackend ?? 'nearai')
                    : 'remote · ' + profile.remoteBaseUrl}
                </div>
              {/if}
            </div>

            <!-- Tint picker. Six small swatches in a row — click to set,
                 saves immediately, repaints the live `--v2-accent` via the
                 connection store's $effect. The active swatch is ringed
                 (not enlarged) so the row height stays stable. Targets are
                 18px which is below the 44pt touch minimum, but this surface
                 is desktop-only chrome — the row stays inside an already
                 cramped per-profile control cluster. -->
            <div
              class="flex items-center gap-1 shrink-0"
              role="radiogroup"
              aria-label="Profile color"
            >
              {#each PROFILE_TINT_ORDER as tintKey (tintKey)}
                {@const swatch = PROFILE_TINTS[tintKey]}
                {@const isSelected = currentTintKey === tintKey}
                <button
                  type="button"
                  onclick={() => void onChangeTint(profile, tintKey)}
                  title={swatch.label}
                  aria-label="Set color to {swatch.label}"
                  aria-checked={isSelected}
                  role="radio"
                  class="w-4 h-4 rounded-full border transition-all"
                  class:border-text-primary={isSelected}
                  class:border-border-subtle={!isSelected}
                  class:scale-110={isSelected}
                  style="background-color: {swatch.accent};"
                ></button>
              {/each}
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 shrink-0">
              {#if !isActiveRow}
                <button
                  type="button"
                  onclick={() => void onSwitchProfile(profile.id)}
                  class="text-xs text-accent-cyan hover:underline px-1"
                >
                  Switch
                </button>
              {/if}
              <button
                type="button"
                onclick={() => void onDeleteProfile(profile)}
                disabled={settings.profiles.length <= 1}
                class="text-xs text-text-muted hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed px-1"
                title={settings.profiles.length <= 1
                  ? 'Cannot delete the only profile'
                  : 'Delete this profile'}
              >
                Delete
              </button>
            </div>
          </li>
        {/each}
      </ul>
    </div>

    <!-- About -->
    <div class="surface p-5">
      <h2 class="text-sm font-semibold text-text-primary mb-3">About</h2>
      <dl class="space-y-2 text-xs">
        <div class="flex justify-between">
          <dt class="text-text-muted">App version</dt>
          <dd class="text-text-primary font-mono">{appVersion}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-text-muted">Gateway</dt>
          <dd class="text-text-primary font-mono">{apiInfo}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-text-muted">Active base URL</dt>
          <dd class="text-text-primary font-mono break-all">{connection.baseUrl}</dd>
        </div>
        {#if activeProfile && activeProfile.mode === 'local'}
          <div class="flex justify-between">
            <dt class="text-text-muted">Provider</dt>
            <dd class="text-text-primary font-mono">
              {activeProfile.llmProviderId ??
                activeProfile.llmBackend ??
                'nearai'}
            </dd>
          </div>
        {/if}
      </dl>

      <!-- Open the full About modal. The condensed dl above gives the
           one-line version + gateway summary; the modal carries the
           polished surface with system info, links, and credits. Lives
           directly under the dl so it reads as a "go deeper" affordance
           rather than a footer button. -->
      <div class="mt-3">
        <button
          type="button"
          onclick={() => aboutStore.show()}
          class="text-xs text-accent-cyan hover:brightness-110 underline underline-offset-2"
        >
          Show full About dialog
        </button>
      </div>

      <!-- Manual updater check. Lives inside About so version + check
           sit together. The store's status drives the inline label so
           the user gets feedback without leaving the page. Error state
           gets its own row with a Retry button so the user can drive the
           recovery without scrolling away. -->
      <div class="mt-4 pt-4 border-t border-border-subtle space-y-3">
        <div class="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onclick={() => void updater.check()}
            disabled={updater.status === 'checking' ||
              updater.status === 'downloading' ||
              updater.status === 'installing'}
            class="px-3 py-1.5 rounded-md border border-accent-cyan text-accent-cyan text-xs font-semibold hover:bg-accent-cyan hover:text-bg-deep transition disabled:opacity-50 min-h-[32px]"
          >
            {updater.status === 'checking' ? 'Checking…' : 'Check for updates'}
          </button>
          <span class="text-xs text-text-muted">
            {#if updater.status === 'idle'}
              {#if updater.lastCheckedAt}
                Checked {lastCheckedLabel}.
              {:else}
                No check yet this session.
              {/if}
            {:else if updater.status === 'checking'}
              Contacting update server…
            {:else if updater.status === 'up-to-date'}
              Up to date — checked {lastCheckedLabel}.
            {:else if updater.status === 'available' && updater.update}
              v{updater.update.version} available — see banner above.
            {:else if updater.status === 'downloading'}
              Downloading {updater.progress ?? 0}%…
            {:else if updater.status === 'installing'}
              Installed — restart to apply.
            {:else if updater.status === 'error'}
              <span class="text-red-400">Check failed</span>
              {#if updater.lastCheckedAt}
                · last success {lastCheckedLabel}
              {/if}
            {/if}
          </span>
        </div>

        {#if updater.status === 'error'}
          <!-- Inline error row + Retry. Sits below the main row so a
               long error message wraps without pushing the cadence
               control off-screen. -->
          <div class="flex items-start gap-3 p-2.5 rounded-md bg-red-950/40 border border-red-800/60">
            <p class="text-xs text-red-200 flex-1 break-words">
              {updater.error ?? 'Update check failed'}
            </p>
            <button
              type="button"
              onclick={() => void updater.check()}
              class="shrink-0 px-3 py-1.5 rounded-md border border-red-400 text-red-200 text-xs font-semibold hover:bg-red-900 transition min-h-[32px]"
            >
              Retry
            </button>
          </div>
        {/if}

        <!-- Cadence dropdown. Persists via the store (localStorage) and
             re-arms the recheck timer; "never" clears it. -->
        <div class="flex items-center gap-3 flex-wrap">
          <label for="updater-cadence" class="text-xs text-text-muted">
            Check for updates
          </label>
          <select
            id="updater-cadence"
            value={updater.cadence}
            onchange={onCadenceChange}
            class="px-2 py-1.5 rounded-md bg-bg-deep border border-border-subtle text-text-primary text-xs min-h-[32px] focus:outline-none focus:border-accent-cyan"
          >
            <option value="never">Never</option>
            <option value="launch">On launch only</option>
            <option value="launch+6h">On launch + every 6 hours</option>
            <option value="launch+1h">On launch + every hour</option>
          </select>
          {#if updater.skippedVersion}
            <span class="text-xs text-text-muted">
              Skipping v{updater.skippedVersion}
              <button
                type="button"
                onclick={() => {
                  updater.skippedVersion = null;
                  try {
                    localStorage.removeItem('ironclaw-updater-skip');
                  } catch {
                    // ignore
                  }
                }}
                class="ml-1 underline hover:text-accent-cyan"
              >
                clear
              </button>
            </span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Server-side settings (admin-only, after About).
         Mirrors the gateway's /api/settings payload. Bearer tokens that
         the server embeds inside mcp_servers etc. are auto-masked; per-row
         "View raw" toggles the unredacted JSON behind a warning banner.
         Hidden entirely when adminMode is off so non-admin users never
         see the surface or trigger the fetch. -->
    {#if connection.settings.adminMode === true}
      <div class="surface p-5 space-y-3">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <h2 class="text-sm font-semibold text-text-primary">
            Server-side settings
          </h2>
          <button
            type="button"
            onclick={() => void onRefreshServerSettings()}
            disabled={serverSettingsStatus === 'loading' || !connection.client}
            class="px-3 py-1.5 rounded-md border border-accent-cyan text-accent-cyan text-xs font-semibold hover:bg-accent-cyan hover:text-bg-deep transition disabled:opacity-50 min-h-[32px]"
            title="Re-fetch /api/settings from the gateway"
          >
            {serverSettingsStatus === 'loading' ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <p class="text-xs text-text-muted">
          Server-side configuration. Tokens auto-masked — click eyeball to reveal.
        </p>

        {#if !connection.client}
          <div class="text-xs text-text-muted italic">
            Not connected to a gateway. Configure a profile above and reconnect.
          </div>
        {:else if serverSettingsStatus === 'loading' && !serverSettings}
          <div class="text-xs text-text-muted italic">
            Loading server-side settings…
          </div>
        {:else if serverSettingsStatus === 'error'}
          <div class="px-3 py-2 rounded-md bg-red-950/40 border border-red-800/60">
            <p class="text-xs text-red-200 break-words">
              {serverSettingsError ?? 'Failed to load settings.'}
            </p>
          </div>
        {:else if serverSettingsRows.length === 0 && serverSettingsStatus === 'ok'}
          <div class="text-xs text-text-muted italic">
            Gateway returned no settings.
          </div>
        {:else if serverSettings}
          <!-- Key/value rows. Primitives go through MaskedValue (tap to
               reveal); objects/arrays are pretty-printed JSON with their
               own per-row "View raw" toggle. Both branches mask tokens by
               default; the toggle is the only path to the raw bytes. -->
          <dl class="space-y-3 text-xs">
            {#each serverSettingsRows as { key, value } (key)}
              <div class="border-l-2 border-border-subtle pl-3 space-y-1">
                <dt class="font-mono text-accent-cyan break-all">{key}</dt>
                <dd class="text-text-primary">
                  {#if isPrimitiveLeaf(value)}
                    <MaskedValue
                      value={value === null ? 'null' : String(value)}
                      classes="text-text-primary"
                    />
                  {:else}
                    {@const showRaw = !!serverSettingsRawKeys[key]}
                    <div class="space-y-1">
                      <div class="flex items-center justify-between gap-2 flex-wrap">
                        <span class="text-[10px] uppercase tracking-wider text-text-muted">
                          {Array.isArray(value) ? 'array' : 'object'}
                        </span>
                        <button
                          type="button"
                          onclick={() => toggleServerSettingsRaw(key)}
                          class="text-[11px] font-semibold text-text-muted hover:text-accent-gold transition-colors"
                          aria-pressed={showRaw}
                          title={showRaw
                            ? 'Hide raw value and re-mask tokens'
                            : 'Show unmasked JSON (tokens visible)'}
                        >
                          {showRaw ? 'Hide raw' : 'View raw (unmasked)'}
                        </button>
                      </div>
                      {#if showRaw}
                        <div class="px-2 py-1 rounded-md border border-red-500/60 bg-red-500/10 text-[11px] text-red-300 flex items-start gap-2">
                          <span aria-hidden="true">⚠</span>
                          <span class="flex-1">Tokens visible</span>
                        </div>
                      {/if}
                      <pre
                        class="bg-bg-deep border border-border-subtle rounded-md p-2 overflow-auto font-mono text-[11px] text-text-primary max-h-64 whitespace-pre-wrap break-all"
                      >{showRaw
                          ? JSON.stringify(value, null, 2)
                          : JSON.stringify(redactJsonObject(value), null, 2)}</pre>
                    </div>
                  {/if}
                </dd>
              </div>
            {/each}
          </dl>
        {/if}
      </div>
    {/if}

    <!-- Notifications. Lives below About because the test button is a
         one-shot UX check, not a daily-driver setting. -->
    <div id="notifications" class="surface p-5 space-y-4 scroll-mt-6">
      <h2 class="text-sm font-semibold text-text-primary">Notifications</h2>
      <p class="text-xs text-text-muted">
        Desktop alerts for chat replies (while you're focused elsewhere),
        completed routines, and sidecar exits. Toggles persist locally;
        the OS-level permission is granted on first send.
      </p>

      <!-- Per-category sound dropdowns. Each row maps to one of the
           three callers; the "Preview" button fires a one-shot test
           with the chosen sound (override path so quiet hours can't
           swallow it). -->
      <div class="space-y-3 pt-1">
        <!-- Chat reply sound. -->
        <div class="flex items-center gap-3 flex-wrap">
          <label for="notif-sound-chat" class="text-sm text-text-primary flex-1 min-w-[160px]">
            Chat reply sound
            <div class="text-xs text-text-muted mt-0.5">
              Plays when IronClaw replies while the window isn't focused.
            </div>
          </label>
          <select
            id="notif-sound-chat"
            value={notifications.chatReplySound}
            onchange={(e) =>
              notifications.setChatReplySound(e.currentTarget.value as SoundChoice)}
            class="bg-bg-deep border border-border-subtle rounded-md px-2 py-1.5 text-sm text-text-primary min-h-[40px] min-w-[160px] focus:outline-none focus:border-accent-cyan"
          >
            {#each SOUND_CHOICES as choice}
              <option value={choice.value}>{choice.label}</option>
            {/each}
          </select>
          <button
            type="button"
            onclick={() => void onPreviewSound('chat', notifications.chatReplySound)}
            class="px-3 py-1.5 rounded-md border border-border-subtle text-text-primary text-xs font-semibold hover:border-accent-cyan hover:text-accent-cyan transition min-h-[40px]"
            title="Fire a test notification with the chosen sound"
          >
            Preview
          </button>
        </div>

        <!-- Routine completion sound. -->
        <div class="flex items-center gap-3 flex-wrap">
          <label for="notif-sound-routine" class="text-sm text-text-primary flex-1 min-w-[160px]">
            Routine completion sound
            <div class="text-xs text-text-muted mt-0.5">
              Plays when a routine finishes (success or failure).
            </div>
          </label>
          <select
            id="notif-sound-routine"
            value={notifications.routineSound}
            onchange={(e) =>
              notifications.setRoutineSound(e.currentTarget.value as SoundChoice)}
            class="bg-bg-deep border border-border-subtle rounded-md px-2 py-1.5 text-sm text-text-primary min-h-[40px] min-w-[160px] focus:outline-none focus:border-accent-cyan"
          >
            {#each SOUND_CHOICES as choice}
              <option value={choice.value}>{choice.label}</option>
            {/each}
          </select>
          <button
            type="button"
            onclick={() => void onPreviewSound('routine', notifications.routineSound)}
            class="px-3 py-1.5 rounded-md border border-border-subtle text-text-primary text-xs font-semibold hover:border-accent-cyan hover:text-accent-cyan transition min-h-[40px]"
            title="Fire a test notification with the chosen sound"
          >
            Preview
          </button>
        </div>

        <!-- Sidecar exit sound. -->
        <div class="flex items-center gap-3 flex-wrap">
          <label for="notif-sound-sidecar" class="text-sm text-text-primary flex-1 min-w-[160px]">
            Sidecar exit sound
            <div class="text-xs text-text-muted mt-0.5">
              Plays when the bundled IronClaw sidecar exits unexpectedly.
            </div>
          </label>
          <select
            id="notif-sound-sidecar"
            value={notifications.sidecarSound}
            onchange={(e) =>
              notifications.setSidecarSound(e.currentTarget.value as SoundChoice)}
            class="bg-bg-deep border border-border-subtle rounded-md px-2 py-1.5 text-sm text-text-primary min-h-[40px] min-w-[160px] focus:outline-none focus:border-accent-cyan"
          >
            {#each SOUND_CHOICES as choice}
              <option value={choice.value}>{choice.label}</option>
            {/each}
          </select>
          <button
            type="button"
            onclick={() => void onPreviewSound('sidecar', notifications.sidecarSound)}
            class="px-3 py-1.5 rounded-md border border-border-subtle text-text-primary text-xs font-semibold hover:border-accent-cyan hover:text-accent-cyan transition min-h-[40px]"
            title="Fire a test notification with the chosen sound"
          >
            Preview
          </button>
        </div>
      </div>

      <!-- Menu-bar badge toggle. App-level, NOT per-profile — the tray
           is global chrome. Defaults to on; toggling off pushes a 0 to
           the Rust tray immediately so any stale count clears without a
           relaunch. -->
      <div class="pt-3 border-t border-border-subtle">
        <label class="flex items-start gap-3 cursor-pointer min-h-[44px] select-none">
          <input
            type="checkbox"
            checked={notifications.trayBadgeEnabled}
            onchange={(e) => notifications.setTrayBadgeEnabled(e.currentTarget.checked)}
            class="mt-1 accent-accent-cyan w-4 h-4"
          />
          <div class="flex-1">
            <div class="text-sm text-text-primary">Show unseen count in menu bar</div>
            <div class="text-xs text-text-muted mt-0.5">
              Displays a small number next to the tray icon when there are
              unseen notifications from the last 5 minutes. Clears when you
              focus the window or click the tray icon.
            </div>
          </div>
        </label>
      </div>

      <!-- Quiet hours (DND). During the window we still show banners but
           mute the sound; the window can wrap overnight (e.g. 22 → 7). -->
      <div class="pt-3 border-t border-border-subtle space-y-2">
        <label class="flex items-start gap-3 cursor-pointer min-h-[44px] select-none">
          <input
            type="checkbox"
            checked={notifications.quietHours.enabled}
            onchange={(e) => notifications.setQuietHoursEnabled(e.currentTarget.checked)}
            class="mt-1 accent-accent-cyan w-4 h-4"
          />
          <div class="flex-1">
            <div class="text-sm text-text-primary">Quiet hours</div>
            <div class="text-xs text-text-muted mt-0.5">
              During the window below, notifications still appear but stay
              silent. Overnight ranges work — e.g. 22 → 7 mutes from 22:00
              to 06:59.
            </div>
          </div>
        </label>
        <div class="flex items-center gap-3 flex-wrap pl-7">
          <label class="text-xs text-text-muted flex items-center gap-2">
            From
            <input
              type="number"
              min="0"
              max="23"
              step="1"
              value={notifications.quietHours.startHour}
              onchange={(e) =>
                notifications.setQuietHoursStart(Number(e.currentTarget.value))}
              disabled={!notifications.quietHours.enabled}
              class="bg-bg-deep border border-border-subtle rounded-md px-2 py-1 text-sm text-text-primary w-20 focus:outline-none focus:border-accent-cyan disabled:opacity-50"
            />
            <span class="text-text-muted">:00</span>
          </label>
          <label class="text-xs text-text-muted flex items-center gap-2">
            To
            <input
              type="number"
              min="0"
              max="23"
              step="1"
              value={notifications.quietHours.endHour}
              onchange={(e) =>
                notifications.setQuietHoursEnd(Number(e.currentTarget.value))}
              disabled={!notifications.quietHours.enabled}
              class="bg-bg-deep border border-border-subtle rounded-md px-2 py-1 text-sm text-text-primary w-20 focus:outline-none focus:border-accent-cyan disabled:opacity-50"
            />
            <span class="text-text-muted">:00</span>
          </label>
        </div>
      </div>

      <div class="flex items-center gap-3 flex-wrap pt-3 border-t border-border-subtle">
        <button
          type="button"
          onclick={onTestNotification}
          disabled={testNotifyStatus === 'sending'}
          class="px-4 py-2 rounded-md border border-accent-cyan text-accent-cyan text-sm font-semibold hover:bg-accent-cyan hover:text-bg-deep transition disabled:opacity-50 min-h-[44px]"
        >
          {testNotifyStatus === 'sending' ? 'Sending…' : 'Send test notification'}
        </button>
        {#if testNotifyStatus === 'sent'}
          <span class="text-xs text-accent-cyan flex items-center gap-1">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            {testNotifyMessage}
          </span>
        {:else if testNotifyStatus === 'denied' || testNotifyStatus === 'error'}
          <span class="text-xs text-red-400 flex items-center gap-1">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            {testNotifyMessage}
          </span>
        {/if}
      </div>
    </div>

    <!-- Data (bulk export). Lives near the bottom so the day-to-day
         configuration cards stay first; the destructive / one-shot
         actions sit underneath them. The button is disabled while we're
         still mid-export or the connection isn't healthy — the bulk
         walk needs /api/chat/threads and /api/chat/history both to
         answer cleanly. -->
    <div class="surface p-5 space-y-3">
      <h2 class="text-sm font-semibold text-text-primary">Data</h2>
      <p class="text-xs text-text-muted">
        Export every conversation in this profile as a single JSON file.
        Includes thread metadata and full message history.
      </p>
      <div class="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onclick={onExportAllConversations}
          disabled={bulkExportRunning || connection.status !== 'connected'}
          class="px-4 py-2 rounded-md border border-accent-cyan text-accent-cyan text-sm font-semibold hover:bg-accent-cyan hover:text-bg-deep transition disabled:opacity-50 min-h-[44px]"
          title={connection.status === 'connected'
            ? 'Export every conversation'
            : 'Connect to the IronClaw gateway first'}
        >
          {bulkExportRunning ? 'Exporting…' : 'Export all conversations'}
        </button>
        {#if bulkExportRunning && bulkExportProgress}
          <span class="text-xs text-text-muted">
            {bulkExportProgress.done} of {bulkExportProgress.total}
          </span>
        {/if}
      </div>

      <!-- Settings backup. Lives in the Data card alongside the
           conversation export so backup/restore actions are grouped
           together. Tokens / OpenRouter keys are NOT included — they
           live in the macOS Keychain, not settings.json. -->
      <div class="pt-3 border-t border-border-subtle space-y-2">
        <p class="text-xs text-text-muted">
          Backup or restore your profile list and preferences. Tokens are
          NOT included — re-enter them after importing on a new machine.
        </p>
        <div class="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onclick={onExportSettings}
            disabled={settingsExportBusy}
            class="px-4 py-2 rounded-md border border-accent-cyan text-accent-cyan text-sm font-semibold hover:bg-accent-cyan hover:text-bg-deep transition disabled:opacity-50 min-h-[44px]"
            title="Save your profile list and preferences to a JSON file"
          >
            {settingsExportBusy ? 'Exporting…' : 'Export settings'}
          </button>
          <button
            type="button"
            onclick={onImportSettings}
            disabled={settingsImportBusy}
            class="px-4 py-2 rounded-md border border-border-subtle text-text-primary text-sm font-semibold hover:border-accent-cyan hover:text-accent-cyan transition disabled:opacity-50 min-h-[44px]"
            title="Restore a settings backup from a JSON file"
          >
            {settingsImportBusy ? 'Importing…' : 'Import settings'}
          </button>
        </div>
      </div>
    </div>

    <!-- API tokens. User-scoped tokens for granting external apps access
         to this IronClaw instance without sharing the sign-in. The card is
         visible to all users (each manages only their OWN tokens; the
         gateway scopes the list by the active bearer). Sits after the
         Data card so the destructive / one-shot actions group together —
         the brief asks for "after Data, before About", but About sits
         above the profile list in the layout above so this is the closest
         consistent placement without re-ordering the rest of the page. -->
    <div class="surface p-5 space-y-3">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 class="text-sm font-semibold text-text-primary">API tokens</h2>
          <p class="text-xs text-text-muted mt-0.5">
            Grant external apps access to your IronClaw instance without
            sharing your sign-in. Revoke any time.
          </p>
        </div>
        <button
          type="button"
          onclick={openCreateModal}
          disabled={!connection.client}
          class="px-3 py-1.5 rounded-md bg-accent-cyan text-bg-deep text-xs font-semibold hover:brightness-110 transition disabled:opacity-50 min-h-[32px]"
          title={connection.client
            ? 'Create a new API token'
            : 'Connect to the IronClaw gateway first'}
        >
          + Create new token
        </button>
      </div>

      {#if !connection.client}
        <div class="text-xs text-text-muted italic">
          Not connected to a gateway. Configure a profile above and reconnect.
        </div>
      {:else if tokensStatus === 'loading' && tokens.length === 0}
        <div class="text-xs text-text-muted italic">Loading tokens…</div>
      {:else if tokensStatus === 'error'}
        <div class="px-3 py-2 rounded-md bg-red-950/40 border border-red-800/60 flex items-start gap-3">
          <p class="text-xs text-red-200 flex-1 break-words">
            {tokensError ?? 'Failed to load tokens.'}
          </p>
          <button
            type="button"
            onclick={() => void loadTokens()}
            class="shrink-0 px-3 py-1.5 rounded-md border border-red-400 text-red-200 text-xs font-semibold hover:bg-red-900 transition min-h-[32px]"
          >
            Retry
          </button>
        </div>
      {:else if tokensRows.length === 0}
        <!-- Empty-state copy from the brief. -->
        <div class="px-3 py-4 rounded-md bg-bg-deep border border-border-subtle text-xs text-text-muted">
          You haven't created any API tokens yet. Click "Create new token"
          to make one. Tokens let you grant external apps access to your
          IronClaw instance without sharing your sign-in.
        </div>
      {:else}
        <ul class="space-y-2">
          {#each tokensRows as token (token.id)}
            {@const isRevoked = !!token.revoked_at}
            <li
              class="flex items-start gap-3 bg-bg-deep border rounded-md px-3 py-3 min-h-[64px]"
              class:border-red-800={isRevoked}
              class:border-border-subtle={!isRevoked}
            >
              <div class="flex-1 min-w-0 space-y-1.5">
                <!-- Name + status pill row. Revoked tokens get a strike
                     through the name plus the red pill. -->
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="text-sm font-semibold text-text-primary truncate"
                    class:line-through={isRevoked}
                    class:text-text-muted={isRevoked}
                    title={token.name}
                  >
                    {token.name}
                  </span>
                  {#if isRevoked}
                    <span
                      class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/40"
                    >
                      Revoked
                    </span>
                  {:else}
                    <span
                      class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30"
                    >
                      Active
                    </span>
                  {/if}
                </div>

                <!-- Metadata row: created / last used + token preview. -->
                <div class="text-[11px] text-text-muted flex items-center gap-3 flex-wrap">
                  <span title={token.created_at}>
                    Created {tokenCreatedLabel(token.created_at)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span title={token.last_used_at ?? 'Never used'}>
                    {token.last_used_at
                      ? `Last used ${tokenRelative(token.last_used_at)}`
                      : 'Never used'}
                  </span>
                </div>

                {#if token.preview}
                  <div class="text-[11px] flex items-center gap-2">
                    <span class="text-text-muted">Preview</span>
                    <MaskedValue
                      value={`sk-iro_${token.preview}`}
                      classes="text-text-primary"
                      locked
                    />
                  </div>
                {/if}

                {#if token.scopes && token.scopes.length > 0}
                  <div class="text-[11px] flex items-center gap-1.5 flex-wrap">
                    <span class="text-text-muted">Scopes</span>
                    {#each token.scopes as scope (scope)}
                      <span
                        class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-bg-base border border-border-subtle text-text-primary"
                      >
                        {scope}
                      </span>
                    {/each}
                  </div>
                {/if}
              </div>

              <!-- Revoke is only available on active tokens. Revoked rows
                   stay in the list (the wire keeps them) but show no
                   action affordance. -->
              <div class="shrink-0 self-center">
                {#if !isRevoked}
                  <button
                    type="button"
                    onclick={() => openRevokeConfirm(token)}
                    class="px-3 py-1.5 rounded-md border border-red-500/40 text-red-300 text-xs font-semibold hover:bg-red-500/10 hover:border-red-500 transition min-h-[32px]"
                  >
                    Revoke
                  </button>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <!-- Advanced. Off by default. Toggling on unhides the Admin sidebar
         entry, the Cmd+7 shortcut, and the /admin route content. Toggling
         off retracts all three and (via the layout's $effect) bounces
         the user out of /admin if they happen to be there. App-level, not
         per-profile — it's a chrome preference, not a per-gateway setting. -->
    <div class="surface p-5 space-y-3">
      <h2 class="text-sm font-semibold text-text-primary">Advanced</h2>
      <p class="text-xs text-text-muted">
        Reveal experimental and admin-only surfaces.
      </p>
      <label
        class="flex items-start gap-3 cursor-pointer min-h-[44px] select-none"
      >
        <input
          type="checkbox"
          checked={settings.adminMode}
          onchange={(e) => void onToggleAdminMode(e.currentTarget.checked)}
          class="mt-1 accent-accent-cyan w-4 h-4"
        />
        <div class="flex-1">
          <div class="text-sm text-text-primary">Show admin surfaces</div>
          <div class="text-xs text-text-muted mt-0.5">
            Adds the Admin section to the sidebar (Cmd+7) for editing the
            multi-tenant tool policy and admin SYSTEM.md. Requires a
            bearer token with the admin role on the active profile.
          </div>
        </div>
      </label>

      <!-- Menu-bar tray toggle. App-level, NOT per-profile — the tray
           icon is global chrome. Defaults to on; toggling off hides the
           icon immediately and persists so the next launch starts
           hidden. Toggling back on restores the icon without a relaunch. -->
      <label
        class="flex items-start gap-3 cursor-pointer min-h-[44px] select-none"
      >
        <input
          type="checkbox"
          checked={settings.trayEnabled !== false}
          onchange={(e) => void onToggleTrayEnabled(e.currentTarget.checked)}
          class="mt-1 accent-accent-cyan w-4 h-4"
        />
        <div class="flex-1">
          <div class="text-sm text-text-primary">Show in menu bar</div>
          <div class="text-xs text-text-muted mt-0.5">
            Adds an IronClaw status icon to the macOS menu bar. Click to
            toggle the window; right-click for quick actions (Restart
            sidecar, Settings, Quit).
          </div>
        </div>
      </label>

      <!-- Responses API streaming toggle. App-level, NOT per-profile —
           this is a transport preference, not per-gateway state. Defaults
           to on; if the active gateway doesn't expose /api/v1/responses
           the chat surface silently falls back to the legacy
           /api/chat/send + /api/chat/events pipeline (auto-detected via
           a cheap method-mismatch probe). Pinning OFF forces the legacy
           path on every send, useful for debugging issues that only
           reproduce on one transport. -->
      <label
        class="flex items-start gap-3 cursor-pointer min-h-[44px] select-none"
      >
        <input
          type="checkbox"
          checked={settings.useResponsesApi !== false}
          onchange={(e) => void onToggleResponsesApi(e.currentTarget.checked)}
          class="mt-1 accent-accent-cyan w-4 h-4"
        />
        <div class="flex-1">
          <div class="text-sm text-text-primary">
            Use Responses API streaming (better delta streaming)
          </div>
          <div class="text-xs text-text-muted mt-0.5">
            Streams assistant replies via <code class="text-text-primary">/api/v1/responses</code>
            with real incremental deltas. Older IronClaw gateways without
            this endpoint fall back automatically to <code class="text-text-primary">/api/chat</code>.
            Turn off to pin every send to the legacy pipeline.
          </div>
        </div>
      </label>

      <!-- Engine v2 surface toggle. Off by default. Toggling on unhides
           the Missions sidebar entry, the Cmd+9 shortcut, and the
           /missions route content. Toggling off retracts all three and
           (via the layout's $effect) bounces the user out of /missions
           if they happen to be there. App-level, not per-profile — same
           contract as `adminMode`. Engine v2 is still developer-facing
           and the gateway returns 404 on /api/engine/* against older
           builds, which is why we gate it behind an explicit opt-in. -->
      <label
        class="flex items-start gap-3 cursor-pointer min-h-[44px] select-none"
      >
        <input
          type="checkbox"
          checked={settings.engineV2Enabled === true}
          onchange={(e) => void onToggleEngineV2(e.currentTarget.checked)}
          class="mt-1 accent-accent-cyan w-4 h-4"
        />
        <div class="flex-1">
          <div class="text-sm text-text-primary">
            Show Engine v2 surface (missions, projects)
          </div>
          <div class="text-xs text-text-muted mt-0.5">
            Adds the Missions section to the sidebar (Cmd+9) for browsing
            Engine v2 projects, missions, and their engine threads. Requires
            an IronClaw gateway with <code class="text-text-primary">engine_v2_enabled</code>;
            older builds return 404 on the underlying endpoints.
          </div>
        </div>
      </label>
    </div>

    <!-- Re-run onboarding (discrete footer action). Flips onboardingComplete
         back to false so the first-run wizard takes over again, and then
         navigates there directly so the user doesn't have to relaunch. -->
    <div class="pt-2 pb-4 flex justify-end">
      <button
        type="button"
        onclick={onRerunOnboarding}
        class="text-xs text-text-muted hover:text-accent-cyan transition-colors"
      >
        Re-run onboarding
      </button>
    </div>
  </div>
</section>

<!-- ===========================================================================
     API token modals
     ===========================================================================
     Two modals share the same backdrop pattern as NewProfileModal:
       1. Create modal — name + scope chips → swaps to "Your new token"
          view on success. The raw plaintext is shown ONCE with a Copy
          button and a hard warning ("Save this now. You won't see it
          again."). Closing the modal refreshes the list so the new row
          is in place.
       2. Revoke-confirm modal — single-action confirmation with the
          token name interpolated into the warning so the user can't
          mis-click on the wrong row.
     Modals live outside the main <section> so the backdrop covers the
     full viewport regardless of scroll position. Both honour Escape via
     the keydown $effect in the script block. -->

{#if createOpen}
  <!-- Backdrop. Clicking outside the card closes (when no in-flight
       request is mid-create). -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    onclick={closeCreateModal}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        closeCreateModal();
      }
    }}
    role="button"
    tabindex="-1"
    aria-label="Close create token dialog"
  >
    <div
      class="surface w-[min(480px,calc(100vw-2rem))] p-6 space-y-5 border border-border-subtle max-h-[calc(100vh-2rem)] overflow-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-token-title"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      tabindex="-1"
    >
      {#if createdToken === null}
        <!-- Step 1: name + scopes form. -->
        <header class="space-y-1">
          <h2 id="create-token-title" class="text-lg font-semibold text-text-primary">
            Create new token
          </h2>
          <p class="text-xs text-text-muted">
            Give the token a memorable name (which app, which machine).
            Optionally restrict it to specific scopes.
          </p>
        </header>

        <form onsubmit={onSubmitCreate} class="space-y-4">
          <div>
            <label
              for="new-token-name"
              class="block text-xs text-text-muted mb-1"
            >
              Name
            </label>
            <input
              id="new-token-name"
              type="text"
              bind:value={createName}
              bind:this={createNameInputRef}
              maxlength="64"
              placeholder="laptop-cli, raspberrypi-relay…"
              autocomplete="off"
              class="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-cyan transition-colors min-h-[44px]"
              class:border-red-500={createNameTooLong}
            />
            {#if createNameTooLong}
              <p class="text-xs text-red-400 mt-1">
                Name must be 64 characters or fewer.
              </p>
            {/if}
          </div>

          <div role="group" aria-labelledby="new-token-scopes-legend">
            <div
              id="new-token-scopes-legend"
              class="text-xs text-text-muted mb-2"
            >
              Scopes
              <span class="text-text-muted/70">(optional — leave empty for server defaults)</span>
            </div>
            <div class="flex flex-wrap gap-2">
              {#each TOKEN_SCOPES as scope (scope)}
                {@const checked = !!createScopes[scope]}
                <label
                  class="inline-flex items-center gap-2 cursor-pointer select-none px-2.5 py-1.5 rounded-md border text-xs font-mono transition-colors min-h-[32px] hover:border-accent-cyan"
                  class:border-accent-cyan={checked}
                  class:text-accent-cyan={checked}
                  class:border-border-subtle={!checked}
                  class:text-text-primary={!checked}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onchange={() => toggleScope(scope)}
                    class="accent-accent-cyan w-3.5 h-3.5"
                  />
                  {scope}
                </label>
              {/each}
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onclick={closeCreateModal}
              disabled={creating}
              class="text-sm text-text-muted hover:text-text-primary transition-colors disabled:opacity-50 min-h-[44px] px-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canCreate}
              class="px-4 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition disabled:opacity-50 min-h-[44px]"
            >
              {creating ? 'Creating…' : 'Create token'}
            </button>
          </div>
        </form>
      {:else}
        <!-- Step 2: post-create reveal. Token shown ONCE; subsequent
             reads from the gateway only carry the 8-char prefix. -->
        <header class="space-y-1">
          <h2 id="create-token-title" class="text-lg font-semibold text-text-primary">
            Your new token
          </h2>
          <p class="text-xs text-text-muted">
            Copy this value now and store it somewhere safe (password
            manager, 1Password, etc.).
          </p>
        </header>

        <!-- Hard warning. Loud red banner so the user can't miss it. -->
        <div
          class="px-3 py-2.5 rounded-md bg-red-950/60 border border-red-500/60 flex items-start gap-2"
        >
          <svg
            viewBox="0 0 24 24"
            class="w-4 h-4 mt-0.5 shrink-0 text-red-300"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p class="text-xs text-red-200 font-semibold">
            Save this now. You won't see it again.
          </p>
        </div>

        <!-- Token plaintext. BIG mono with break-all so the user can
             eyeball the full string before copying. -->
        <div>
          <label
            for="created-token-value"
            class="block text-xs text-text-muted mb-1"
          >
            Token
          </label>
          <pre
            id="created-token-value"
            class="bg-bg-deep border border-accent-cyan rounded-md p-3 text-base font-mono text-accent-gold break-all whitespace-pre-wrap select-all"
            >{createdToken}</pre>
        </div>

        <div class="flex items-center justify-between gap-3">
          <button
            type="button"
            onclick={() => void onCopyCreatedToken()}
            disabled={copyBusy}
            class="px-4 py-2 rounded-md border border-accent-cyan text-accent-cyan text-sm font-semibold hover:bg-accent-cyan hover:text-bg-deep transition disabled:opacity-50 min-h-[44px]"
          >
            {copyBusy ? 'Copying…' : 'Copy'}
          </button>
          <button
            type="button"
            onclick={() => void onDoneCreatedToken()}
            class="px-4 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition min-h-[44px]"
          >
            Done
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if revokeTarget}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    onclick={closeRevokeConfirm}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        closeRevokeConfirm();
      }
    }}
    role="button"
    tabindex="-1"
    aria-label="Close revoke token dialog"
  >
    <div
      class="surface w-[min(420px,calc(100vw-2rem))] p-6 space-y-5 border border-red-500/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoke-token-title"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      tabindex="-1"
    >
      <header class="space-y-1">
        <h2 id="revoke-token-title" class="text-lg font-semibold text-text-primary">
          Revoke
          <span class="font-mono text-accent-gold break-all">{revokeTarget.name}</span>?
        </h2>
        <p class="text-xs text-text-muted">
          This cannot be undone. Apps using this token will lose access
          immediately.
        </p>
      </header>

      <div class="flex items-center justify-end gap-3">
        <button
          type="button"
          onclick={closeRevokeConfirm}
          disabled={revoking}
          class="text-sm text-text-muted hover:text-text-primary transition-colors disabled:opacity-50 min-h-[44px] px-3"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={() => void onConfirmRevoke()}
          disabled={revoking}
          class="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition disabled:opacity-50 min-h-[44px]"
        >
          {revoking ? 'Revoking…' : 'Revoke token'}
        </button>
      </div>
    </div>
  </div>
{/if}
