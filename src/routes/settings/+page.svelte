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
  import { open as shellOpen } from '@tauri-apps/plugin-shell';
  import { IronClawClient } from '$lib/api/ironclaw';
  import {
    buildThreadJsonShape,
    saveTextDialog,
    todayStamp,
    type BulkExportShape
  } from '$lib/api/files';
  import {
    addProfile,
    deleteOpenRouterKey,
    deleteProfile,
    deleteToken,
    getOpenRouterKey,
    getOrCreateLocalToken,
    getToken,
    loadSettings,
    localDataDir,
    revealInFinder,
    saveSettings,
    setOpenRouterKey,
    setToken,
    updateProfile,
    type AppSettings,
    type ConnectionMode,
    type LlmBackend,
    type ProfileConfig
  } from '$lib/stores/settings.svelte';
  import { connection, type SidecarStatus } from '$lib/stores/connection.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import { updater } from '$lib/stores/updater.svelte';
  import { notifications } from '$lib/stores/notifications.svelte';

  // ---- Page state -------------------------------------------------------
  //
  // We keep a local mutable copy of AppSettings so the form inputs can
  // edit fields without round-tripping through the connection store on
  // every keystroke. `onSaveSettings` persists; `connection.refresh()`
  // picks the new shape up.

  let settings = $state<AppSettings>({
    activeProfileId: '',
    profiles: [],
    onboardingComplete: true
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

  let openRouterInput = $state('');
  let openRouterStored = $state(false);
  let openRouterStatus = $state<'idle' | 'saving' | 'saved' | 'cleared' | 'error'>('idle');
  let openRouterMessage = $state<string | null>(null);

  let dataDir = $state<string | null>(null);

  // Test-notification button state.
  let testNotifyStatus = $state<'idle' | 'sending' | 'sent' | 'denied' | 'error'>('idle');
  let testNotifyMessage = $state<string | null>(null);

  // ---- Profile-list inline-rename state --------------------------------

  let renamingProfileId = $state<string | null>(null);
  let renameDraft = $state('');

  onMount(async () => {
    settings = await loadSettings();
    await refreshProfileCredentials();
    dataDir = await localDataDir();
    // Re-hydrate notification prefs in case the user opened /settings
    // before the layout's onMount ran (rare; usually a no-op).
    notifications.hydrate();
    void notifications.ensurePermission();
    void refreshAbout();

    // If the page was opened with #profiles in the URL, scroll there.
    if (page.url.hash === '#profiles') {
      await tick();
      const el = document.getElementById('profiles');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

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
    openRouterInput = '';
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
        sound: 'default'
      });
      testNotifyStatus = 'sent';
      testNotifyMessage = 'Sent — check Notification Center.';
    } catch (err) {
      testNotifyStatus = 'error';
      testNotifyMessage = (err as Error).message;
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

  async function onSaveOpenRouterKey() {
    if (!activeProfile) return;
    const k = openRouterInput.trim();
    if (!k) {
      openRouterStatus = 'error';
      openRouterMessage = 'Key is empty.';
      toasts.show('OpenRouter key is empty', 'error');
      return;
    }
    openRouterStatus = 'saving';
    openRouterMessage = null;
    try {
      await setOpenRouterKey(activeProfile.id, k);
      openRouterStored = true;
      openRouterInput = '';
      openRouterStatus = 'saved';
      openRouterMessage = 'Stored in Keychain.';
      toasts.show('OpenRouter key stored', 'success');
      // Make sure the local-gateway token also exists, so the sidecar can
      // be started cleanly on the next "Start" click.
      await getOrCreateLocalToken();
    } catch (err) {
      openRouterStatus = 'error';
      openRouterMessage = (err as Error).message;
      toasts.show(`OpenRouter key save failed: ${openRouterMessage}`, 'error');
    }
  }

  async function onClearOpenRouterKey() {
    if (!activeProfile) return;
    openRouterStatus = 'saving';
    openRouterMessage = null;
    try {
      await deleteOpenRouterKey(activeProfile.id);
      openRouterStored = false;
      openRouterInput = '';
      if (connection.sidecarStatus === 'running') {
        await connection.stopSidecar();
      }
      openRouterStatus = 'cleared';
      openRouterMessage = 'Cleared.';
      toasts.show('OpenRouter key cleared', 'success');
    } catch (err) {
      openRouterStatus = 'error';
      openRouterMessage = (err as Error).message;
      toasts.show(`OpenRouter key clear failed: ${openRouterMessage}`, 'error');
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

  /** Swap the local-mode LLM backend on the active profile. Persists
   *  immediately + restarts the sidecar if it's currently running, so the
   *  new env block takes effect without the user hitting Save explicitly. */
  async function onBackendChange(b: LlmBackend) {
    if (!activeProfile || activeProfile.llmBackend === b) return;
    patchActiveProfile({ llmBackend: b });
    try {
      await saveSettings($state.snapshot(settings));
      toasts.show(
        b === 'nearai'
          ? 'Switched provider to NEAR.AI Cloud'
          : 'Switched provider to OpenRouter',
        'info'
      );
      if (connection.sidecarStatus === 'running') {
        await connection.stopSidecar();
        if (b === 'nearai' || openRouterStored) {
          await connection.startSidecar();
        }
      }
    } catch (err) {
      toasts.show(`Save failed: ${(err as Error).message}`, 'error');
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
        </div>
      {:else}
        <!-- Local mode: LLM provider picker + (provider-specific creds) + data dir + sidecar control -->
        <div class="surface p-5 space-y-4">
          <h2 class="text-sm font-semibold text-text-primary">LLM provider</h2>
          <p class="text-xs text-text-muted">
            Pick which inference backend the local sidecar talks to.
          </p>

          <div class="space-y-2">
            <!-- NEAR.AI Cloud (default, recommended) -->
            <label class="flex items-start gap-3 cursor-pointer min-h-[44px]">
              <input
                type="radio"
                name="llmBackend"
                value="nearai"
                checked={activeProfile.llmBackend === 'nearai'}
                onchange={() => void onBackendChange('nearai')}
                class="mt-1 accent-accent-cyan"
              />
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-text-primary">NEAR.AI Cloud</span>
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30"
                  >
                    Recommended
                  </span>
                </div>
                <div class="text-xs text-text-muted mt-0.5">
                  Free during private preview. Authenticate with your NEAR account on first connect.
                </div>
              </div>
            </label>

            <!-- OpenRouter (advanced) -->
            <label class="flex items-start gap-3 cursor-pointer min-h-[44px]">
              <input
                type="radio"
                name="llmBackend"
                value="openrouter"
                checked={activeProfile.llmBackend === 'openrouter'}
                onchange={() => void onBackendChange('openrouter')}
                class="mt-1 accent-accent-cyan"
              />
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-text-primary">OpenRouter</span>
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent-gold/10 text-accent-gold border border-accent-gold/30"
                  >
                    Advanced
                  </span>
                </div>
                <div class="text-xs text-text-muted mt-0.5">
                  Use your own OpenRouter API key. Pay per token directly.
                </div>
              </div>
            </label>
          </div>
        </div>

        {#if activeProfile.llmBackend === 'nearai'}
          <!-- NEAR.AI auth status + sign-in handoff -->
          <div class="surface p-5 space-y-4">
            <h2 class="text-sm font-semibold text-text-primary">NEAR.AI authentication</h2>
            <p class="text-xs text-text-muted">
              IronClaw handles NEAR sign-in in its own web UI. No API key is stored on this side —
              credentials live inside the sidecar's data directory.
            </p>

            <div class="flex items-center gap-2 text-xs">
              <span
                class="w-2 h-2 rounded-full"
                class:bg-green-500={connection.sidecarStatus === 'running' &&
                  connection.status === 'connected'}
                class:bg-accent-gold={connection.sidecarStatus === 'starting'}
                class:bg-red-500={connection.sidecarStatus === 'error'}
                class:bg-text-muted={connection.sidecarStatus !== 'running' &&
                  connection.sidecarStatus !== 'starting' &&
                  connection.sidecarStatus !== 'error'}
              ></span>
              <span class="text-text-primary">
                {#if connection.sidecarStatus !== 'running'}
                  Auth: sidecar not running
                {:else if connection.status === 'connected'}
                  Auth: sidecar reachable — sign in via the IronClaw web UI
                {:else}
                  Auth: pending — open the sidecar UI to complete sign-in
                {/if}
              </span>
            </div>

            <div class="flex items-center gap-3">
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
            </div>
          </div>
        {:else}
          <!-- OpenRouter API key -->
          <div class="surface p-5 space-y-4">
            <h2 class="text-sm font-semibold text-text-primary">OpenRouter API key</h2>
            <p class="text-xs text-text-muted">
              Used by the local sidecar to reach DeepSeek v3 (or any compatible model)
              via OpenRouter. Stored per-profile in the macOS Keychain.
            </p>

            <div>
              <label for="orkey" class="block text-xs text-text-muted mb-1">Key</label>
              <input
                id="orkey"
                type="password"
                bind:value={openRouterInput}
                placeholder={openRouterStored ? '•••• stored in macOS Keychain' : 'sk-or-...'}
                class="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-cyan transition-colors min-h-[44px]"
              />
            </div>

            <div class="flex items-center gap-3">
              <button
                onclick={onSaveOpenRouterKey}
                disabled={openRouterStatus === 'saving'}
                class="px-4 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition disabled:opacity-50 min-h-[44px]"
              >
                Save
              </button>
              <button
                onclick={onClearOpenRouterKey}
                disabled={!openRouterStored || openRouterStatus === 'saving'}
                class="px-4 py-2 rounded-md border border-border-subtle text-sm text-text-primary hover:border-accent-gold hover:text-accent-gold transition disabled:opacity-30 min-h-[44px]"
              >
                Clear
              </button>
              {#if openRouterStatus === 'saved' || openRouterStatus === 'cleared'}
                <span class="text-xs text-accent-cyan flex items-center gap-1">
                  <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {openRouterMessage}
                </span>
              {:else if openRouterStatus === 'error'}
                <span class="text-xs text-red-400 flex items-center gap-1">
                  <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  {openRouterMessage}
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
              {@const canStart =
                activeProfile.llmBackend === 'nearai' || openRouterStored}
              <button
                onclick={onStartSidecar}
                disabled={!canStart}
                class="px-4 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition disabled:opacity-50 min-h-[44px]"
                title={canStart ? '' : 'Save an OpenRouter API key first'}
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
          <li
            class="flex items-center gap-3 bg-bg-deep border rounded-md px-3 py-2 min-h-[48px]"
            class:border-accent-cyan={isActiveRow}
            class:border-border-subtle={!isActiveRow}
          >
            <!-- Active indicator (or switch button on inactive rows) -->
            {#if isActiveRow}
              <span
                class="w-2 h-2 rounded-full bg-accent-cyan shrink-0"
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
                    ? 'local · ' + (profile.llmBackend === 'nearai' ? 'NEAR.AI' : 'OpenRouter')
                    : 'remote · ' + profile.remoteBaseUrl}
                </div>
              {/if}
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
              {activeProfile.llmBackend === 'nearai'
                ? 'NEAR.AI Cloud'
                : 'OpenRouter (DeepSeek)'}
            </dd>
          </div>
        {/if}
      </dl>

      <!-- Manual updater check. Lives inside About so version + check
           sit together. The store's status drives the inline label so
           the user gets feedback without leaving the page. -->
      <div class="mt-4 pt-4 border-t border-border-subtle flex items-center gap-3">
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
            No check yet this session.
          {:else if updater.status === 'checking'}
            Contacting update server…
          {:else if updater.status === 'up-to-date'}
            Up to date.
          {:else if updater.status === 'available' && updater.update}
            v{updater.update.version} available — see banner above.
          {:else if updater.status === 'downloading'}
            Downloading {updater.progress ?? 0}%…
          {:else if updater.status === 'installing'}
            Installed — restart to apply.
          {:else if updater.status === 'error'}
            <span class="text-red-400">{updater.error ?? 'Update check failed'}</span>
          {/if}
        </span>
      </div>
    </div>

    <!-- Notifications. Lives below About because the test button is a
         one-shot UX check, not a daily-driver setting. -->
    <div class="surface p-5 space-y-3">
      <h2 class="text-sm font-semibold text-text-primary">Notifications</h2>
      <p class="text-xs text-text-muted">
        Desktop alerts for chat replies (while you're focused elsewhere),
        completed routines, and sidecar exits. Toggles persist locally;
        the OS-level permission is granted on first send.
      </p>
      <div class="flex items-center gap-3 flex-wrap">
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
