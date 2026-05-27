<script lang="ts">
  // First-run onboarding wizard. Three steps:
  //   1. Pick connection mode (local sidecar vs. remote gateway)
  //   2. Enter credentials (OpenRouter key OR remote URL + bearer)
  //   3. Test the connection and finish (or skip)
  //
  // The wizard is reachable any time via "Re-run onboarding" in Settings,
  // but is also auto-redirected from `+layout.svelte` on first run when
  // `settings.onboardingComplete === false`.
  //
  // Finishing (or skipping) always writes `onboardingComplete: true` so
  // the user is never trapped here. Credentials saved during the wizard
  // mirror what the Settings page does (Keychain for tokens/keys; JSON
  // for mode + URL).

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { IronClawClient } from '$lib/api/ironclaw';
  import { connection } from '$lib/stores/connection.svelte';
  import {
    DEFAULT_PROFILE_ID,
    getOpenRouterKey,
    getOrCreateLocalToken,
    getToken,
    loadSettings,
    saveSettings,
    setOpenRouterKey,
    setToken,
    type AppSettings,
    type ConnectionMode,
    type ProfileConfig
  } from '$lib/stores/settings.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';

  // ---- state ---------------------------------------------------------------

  let step = $state<1 | 2 | 3>(1);

  // Editable settings draft — committed to disk via saveSettings() at the
  // end of the flow (or on Skip). We hydrate from disk in onMount so an
  // in-progress user landing back here keeps any prior URL they entered.
  //
  // Profile-aware: writes target whichever profile is currently active.
  // First-run users land here with a single migrated "Default" profile,
  // so the wizard fills that out; returning users who hit "Re-run
  // onboarding" can also use the wizard against their active profile.
  let settings = $state<AppSettings>({
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [],
    onboardingComplete: false
  });

  /** Active profile inside the editable draft. Everything the wizard
   *  writes (mode, URL, LLM backend, Keychain entries) goes through this. */
  const activeProfile = $derived<ProfileConfig | null>(
    settings.profiles.find((p) => p.id === settings.activeProfileId) ?? null
  );

  function patchActiveProfile(patch: Partial<ProfileConfig>) {
    if (!activeProfile) return;
    settings = {
      ...settings,
      profiles: settings.profiles.map((p) =>
        p.id === activeProfile.id ? { ...p, ...patch } : p
      )
    };
  }

  let openRouterInput = $state('');
  let openRouterStored = $state(false);
  /** Toggle the OpenRouter-key input inside the local-mode step. Default
   *  flow is NEAR.AI Cloud — no key required. */
  let showOpenRouterAdvanced = $state(false);
  let tokenInput = $state('');
  let tokenStored = $state(false);

  let testStatus = $state<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  let testMessage = $state<string | null>(null);
  let testVersion = $state<string | null>(null);

  let finishing = $state(false);

  onMount(async () => {
    settings = await loadSettings();
    const id = settings.activeProfileId;
    if (id) {
      const t = await getToken(id);
      tokenStored = !!t;
      const or = await getOpenRouterKey(id);
      openRouterStored = !!or;
    }
  });

  // ---- navigation helpers --------------------------------------------------

  function chooseMode(mode: ConnectionMode) {
    // Default the local-mode backend to NEAR.AI Cloud unless the user
    // already picked OpenRouter in a previous session.
    patchActiveProfile({
      mode,
      llmBackend: activeProfile?.llmBackend ?? 'nearai'
    });
    step = 2;
  }

  function backToStep(target: 1 | 2 | 3) {
    // Clear stale test state when backing up so step 3 starts fresh.
    if (target < 3) {
      testStatus = 'idle';
      testMessage = null;
      testVersion = null;
    }
    step = target;
  }

  /** Open an external URL in the user's default browser. Tauri's webview
   *  intercepts `_blank` anchors when the security policy is permissive;
   *  if it isn't, the call silently fails — the user can still see the URL
   *  printed next to the link.  We avoid adding a Rust permission for this
   *  per the "don't touch the backend" constraint. */
  function openExternal(url: string) {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // best-effort; the URL is also visible in the UI
    }
  }

  // ---- step 2 → step 3 -----------------------------------------------------

  async function saveStep2AndAdvance() {
    // Persist whatever the user entered. Empty inputs are a no-op so a
    // partial wizard doesn't clobber an existing stored credential.
    if (!activeProfile) {
      toasts.show('No active profile — restart onboarding', 'error');
      return;
    }
    try {
      if (activeProfile.mode === 'local') {
        // Resolve the chosen backend: if the user opened the "advanced"
        // OpenRouter input, treat that as their selection; otherwise keep
        // the NEAR.AI default.
        const nextBackend = showOpenRouterAdvanced ? 'openrouter' : 'nearai';
        patchActiveProfile({ llmBackend: nextBackend });

        if (nextBackend === 'openrouter') {
          const k = openRouterInput.trim();
          if (k) {
            await setOpenRouterKey(activeProfile.id, k);
            openRouterStored = true;
            openRouterInput = '';
            toasts.show('OpenRouter key stored', 'success');
          }
        }
        // Persist the backend choice so step 3's startSidecar picks it up.
        await saveSettings($state.snapshot(settings));
        // Pre-warm the local gateway token so the sidecar can boot cleanly
        // in step 3 without an extra round-trip.
        await getOrCreateLocalToken();
      } else {
        // remote
        const t = tokenInput.trim();
        if (t) {
          await setToken(activeProfile.id, t);
          tokenStored = true;
          tokenInput = '';
          toasts.show('Token stored', 'success');
        }
        // Persist the URL the user typed so step 3 tests the right place.
        await saveSettings($state.snapshot(settings));
        // Refresh the live connection so the test-button path picks up the
        // new URL/token without the user revisiting Settings.
        await connection.refresh();
      }
    } catch (err) {
      toasts.show(`Save failed: ${(err as Error).message}`, 'error');
      return;
    }
    step = 3;
  }

  // ---- step 3 — test connection -------------------------------------------

  async function runTest() {
    testStatus = 'testing';
    testMessage = null;
    testVersion = null;
    if (!activeProfile) {
      testStatus = 'fail';
      testMessage = 'No active profile — restart onboarding';
      return;
    }
    try {
      if (activeProfile.mode === 'local') {
        // Spawn (or reuse) the bundled sidecar.
        const ok = await connection.startSidecar();
        if (!ok) {
          testStatus = 'fail';
          testMessage = connection.sidecarError ?? 'Sidecar failed to start';
          return;
        }
        if (!connection.client) {
          testStatus = 'fail';
          testMessage = 'Sidecar started but client is not configured.';
          return;
        }
        const h = await connection.client.health();
        if (!h.ok) {
          testStatus = 'fail';
          testMessage = `Unhealthy — status="${h.status ?? 'unknown'}"`;
          return;
        }
        try {
          const s = await connection.client.gatewayStatus();
          testVersion = s.version ?? null;
        } catch {
          // gateway status is best-effort; health is the real signal
        }
        testStatus = 'ok';
        testMessage = testVersion
          ? `Connected to IronClaw ${testVersion}`
          : 'Connected to IronClaw';
        return;
      }

      // remote mode — build a one-off client from the values the user typed
      const token = await getToken(activeProfile.id);
      if (!token) {
        testStatus = 'fail';
        testMessage = 'No token saved. Go back and enter your gateway token.';
        return;
      }
      const client = new IronClawClient({
        baseUrl: activeProfile.remoteBaseUrl,
        token
      });
      const h = await client.health();
      if (!h.ok) {
        testStatus = 'fail';
        testMessage = `Unhealthy — status="${h.status ?? 'unknown'}"`;
        return;
      }
      try {
        const s = await client.gatewayStatus();
        testVersion = s.version ?? null;
      } catch {
        // ignore — health passed, that's enough to call this OK
      }
      testStatus = 'ok';
      testMessage = testVersion
        ? `Connected to IronClaw ${testVersion}`
        : 'Connected to IronClaw';
    } catch (err) {
      testStatus = 'fail';
      testMessage = (err as Error).message;
    }
  }

  // ---- finish / skip -------------------------------------------------------

  async function finish() {
    finishing = true;
    try {
      const next = { ...settings, onboardingComplete: true };
      await saveSettings(next);
      // Reflect the new mode/url + onboarded flag into the live store so the
      // chat surface picks it up without a full reload.
      await connection.refresh();
      toasts.show('Setup complete', 'success');
      await goto('/');
    } catch (err) {
      toasts.show(`Finish failed: ${(err as Error).message}`, 'error');
      finishing = false;
    }
  }

  /** Skip from any step. Persists whatever the user has so far (with
   *  onboardingComplete=true) so they aren't redirected here again. */
  async function skip() {
    finishing = true;
    try {
      const next = { ...settings, onboardingComplete: true };
      await saveSettings(next);
      await connection.refresh();
      toasts.show('Skipped — you can finish setup in Settings', 'info');
      await goto('/');
    } catch (err) {
      toasts.show(`Skip failed: ${(err as Error).message}`, 'error');
      finishing = false;
    }
  }
</script>

<!-- Full-screen takeover. Sidebar is hidden in +layout.svelte when the
     route starts with /onboarding, so this owns the whole viewport. -->
<section class="min-h-screen w-full flex flex-col">
  <!-- Top bar: logo + stepper -->
  <header class="shrink-0 px-8 pt-6 pb-2 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <svg
        viewBox="0 0 24 24"
        class="w-6 h-6 text-accent-cyan"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M4 7l8-4 8 4-8 4-8-4z" stroke-linejoin="round" />
        <path d="M4 12l8 4 8-4" stroke-linejoin="round" />
        <path d="M4 17l8 4 8-4" stroke-linejoin="round" />
      </svg>
      <span class="text-lg font-semibold tracking-tight text-accent-cyan">IronClaw</span>
    </div>

    <!-- Stepper -->
    <div class="flex items-center gap-2" aria-label="Progress">
      {#each [1, 2, 3] as n (n)}
        {@const isActive = step === n}
        {@const isDone = step > n}
        <div class="flex items-center gap-2">
          <span
            class="w-2.5 h-2.5 rounded-full transition-all"
            class:bg-accent-cyan={isActive}
            class:border={isDone || (!isActive && !isDone)}
            class:border-accent-cyan={isDone}
            class:border-border-subtle={!isActive && !isDone}
            aria-current={isActive ? 'step' : undefined}
          ></span>
          {#if n < 3}
            <span
              class="w-8 h-px"
              class:bg-accent-cyan={isDone}
              class:bg-border-subtle={!isDone}
            ></span>
          {/if}
        </div>
      {/each}
      <span class="ml-3 text-xs text-text-muted font-mono">{step}/3</span>
    </div>
  </header>

  <!-- Body. Smooth fade between steps via keyed wrapper + opacity transition.
       Each step block is sized to flex into the remaining viewport. -->
  <div class="flex-1 flex items-center justify-center px-8 py-6">
    <div class="max-w-3xl w-full">
      {#if step === 1}
        <div class="space-y-8 animate-step">
          <div class="text-center space-y-2">
            <h1 class="text-3xl font-semibold text-text-primary">
              Welcome to IronClaw
            </h1>
            <p class="text-text-muted text-sm">
              Let's get you connected. Pick how you'd like to run it.
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <!-- Local card -->
            <button
              type="button"
              onclick={() => chooseMode('local')}
              class="group surface p-6 text-left border-2 border-border-subtle hover:border-accent-cyan hover:-translate-y-1 transition-all duration-200 min-h-[200px] flex flex-col"
            >
              <div class="flex items-center gap-3 mb-3">
                <div
                  class="w-9 h-9 rounded-md bg-accent-cyan/10 flex items-center justify-center group-hover:bg-accent-cyan/20 transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="w-5 h-5 text-accent-cyan"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <h2 class="text-base font-semibold text-text-primary">Local</h2>
              </div>
              <p class="text-sm text-text-muted leading-relaxed flex-1">
                Run IronClaw on this Mac. Best for privacy — your data never
                leaves the machine. The ~150MB binary is already bundled.
              </p>
              <div
                class="mt-4 text-xs text-accent-cyan opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
              >
                Choose local
                <svg
                  viewBox="0 0 24 24"
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </button>

            <!-- Remote card -->
            <button
              type="button"
              onclick={() => chooseMode('remote')}
              class="group surface p-6 text-left border-2 border-border-subtle hover:border-accent-gold hover:-translate-y-1 transition-all duration-200 min-h-[200px] flex flex-col"
            >
              <div class="flex items-center gap-3 mb-3">
                <div
                  class="w-9 h-9 rounded-md bg-accent-gold/10 flex items-center justify-center group-hover:bg-accent-gold/20 transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="w-5 h-5 text-accent-gold"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path
                      d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
                    />
                  </svg>
                </div>
                <h2 class="text-base font-semibold text-text-primary">Remote</h2>
              </div>
              <p class="text-sm text-text-muted leading-relaxed flex-1">
                Connect to an existing IronClaw server. Use this if you've
                deployed IronClaw elsewhere (e.g. behind Caddy on a VPS).
              </p>
              <div
                class="mt-4 text-xs text-accent-gold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
              >
                Choose remote
                <svg
                  viewBox="0 0 24 24"
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      {:else if step === 2}
        <div class="space-y-6 animate-step">
          {#if activeProfile?.mode === 'local'}
            <div class="space-y-2">
              <h1 class="text-2xl font-semibold text-text-primary">
                Set up NEAR.AI Cloud
              </h1>
              <p class="text-text-muted text-sm">
                We'll set up NEAR.AI Cloud — IronClaw's built-in inference.
                You'll sign in with your NEAR account after we start the
                sidecar.
              </p>
            </div>

            <div class="surface p-5 space-y-4">
              <div class="flex items-start gap-3">
                <div
                  class="w-9 h-9 shrink-0 rounded-md bg-accent-cyan/10 flex items-center justify-center"
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="w-5 h-5 text-accent-cyan"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 1l3 6 6 1-4.5 4.5L18 19l-6-3-6 3 1.5-6.5L3 8l6-1 3-6z" />
                  </svg>
                </div>
                <div class="flex-1 space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-text-primary"
                      >NEAR.AI Cloud</span
                    >
                    <span
                      class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30"
                    >
                      Recommended
                    </span>
                  </div>
                  <p class="text-xs text-text-muted">
                    Free during private preview. No API key required — sign in
                    with your NEAR account when the sidecar starts.
                  </p>
                </div>
              </div>

              {#if !showOpenRouterAdvanced}
                <button
                  type="button"
                  onclick={() => (showOpenRouterAdvanced = true)}
                  class="text-xs text-text-muted hover:text-accent-cyan transition-colors"
                >
                  Use OpenRouter instead
                </button>
              {:else}
                <div class="pt-3 mt-1 border-t border-border-subtle space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-text-muted">Advanced: OpenRouter</span>
                    <button
                      type="button"
                      onclick={() => {
                        showOpenRouterAdvanced = false;
                        openRouterInput = '';
                      }}
                      class="text-xs text-text-muted hover:text-text-primary transition-colors"
                    >
                      Use NEAR.AI Cloud instead
                    </button>
                  </div>
                  <div>
                    <label
                      for="onb-orkey"
                      class="block text-xs text-text-muted mb-1"
                    >
                      OpenRouter key
                    </label>
                    <input
                      id="onb-orkey"
                      type="password"
                      bind:value={openRouterInput}
                      placeholder={openRouterStored
                        ? '•••• stored in macOS Keychain'
                        : 'sk-or-...'}
                      class="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-cyan transition-colors min-h-[44px]"
                    />
                  </div>
                  <p class="text-xs text-text-muted">
                    Need a key?
                    <button
                      type="button"
                      onclick={() => openExternal('https://openrouter.ai/keys')}
                      class="text-accent-cyan hover:underline inline-flex items-center gap-1"
                    >
                      Get one at openrouter.ai
                      <svg
                        viewBox="0 0 24 24"
                        class="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </button>
                  </p>
                </div>
              {/if}
            </div>
          {:else}
            <div class="space-y-2">
              <h1 class="text-2xl font-semibold text-text-primary">
                Where is your IronClaw server?
              </h1>
              <p class="text-text-muted text-sm">
                Enter the URL and gateway token. The token is stored in your
                macOS Keychain — never in plain text on disk.
              </p>
            </div>

            <div class="surface p-5 space-y-5">
              <div>
                <label
                  for="onb-url"
                  class="block text-xs text-text-muted mb-1"
                >
                  Base URL
                </label>
                <input
                  id="onb-url"
                  type="text"
                  value={activeProfile?.remoteBaseUrl ?? 'http://127.0.0.1:3100'}
                  oninput={(e) =>
                    patchActiveProfile({ remoteBaseUrl: e.currentTarget.value })}
                  placeholder="http://127.0.0.1:3100"
                  class="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-cyan transition-colors min-h-[44px]"
                />
                <p class="text-xs text-text-muted mt-1.5">
                  Tip: tunnel a private server over SSH first, e.g.
                  <code class="font-mono text-text-primary"
                    >ssh -L 3100:127.0.0.1:3100 user@host</code
                  >, then use <code class="font-mono text-text-primary"
                    >http://127.0.0.1:3100</code
                  >.
                </p>
              </div>

              <div>
                <label
                  for="onb-token"
                  class="block text-xs text-text-muted mb-1"
                >
                  Gateway token
                </label>
                <input
                  id="onb-token"
                  type="password"
                  bind:value={tokenInput}
                  placeholder={tokenStored
                    ? '•••• stored in macOS Keychain'
                    : 'ironclaw-...'}
                  class="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-cyan transition-colors min-h-[44px]"
                />
              </div>
            </div>
          {/if}

          <div class="flex items-center justify-between">
            <button
              type="button"
              onclick={() => backToStep(1)}
              class="text-sm text-text-muted hover:text-text-primary transition-colors flex items-center gap-1 min-h-[44px]"
            >
              <svg
                viewBox="0 0 24 24"
                class="w-3 h-3"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back
            </button>

            <div class="flex items-center gap-4">
              <button
                type="button"
                onclick={() => (step = 3)}
                class="text-sm text-text-muted hover:text-text-primary transition-colors min-h-[44px]"
              >
                Skip for now
              </button>
              <button
                type="button"
                onclick={saveStep2AndAdvance}
                class="px-5 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition min-h-[44px]"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      {:else}
        <div class="space-y-6 animate-step">
          <div class="space-y-2 text-center">
            <h1 class="text-2xl font-semibold text-text-primary">
              Let's confirm it works
            </h1>
            <p class="text-text-muted text-sm">
              {#if activeProfile?.mode === 'local'}
                We'll spawn the bundled sidecar and ping its health endpoint.
              {:else}
                We'll send a health check to
                <code class="font-mono text-text-primary"
                  >{activeProfile?.remoteBaseUrl ?? ''}</code
                >.
              {/if}
            </p>
          </div>

          <div class="surface p-6 flex flex-col items-center gap-4">
            <!-- Status pane -->
            <div
              class="w-full min-h-[120px] flex flex-col items-center justify-center text-center"
            >
              {#if testStatus === 'idle'}
                <p class="text-sm text-text-muted">
                  Click below to test your connection.
                </p>
              {:else if testStatus === 'testing'}
                <div class="flex flex-col items-center gap-3">
                  <svg
                    viewBox="0 0 24 24"
                    class="w-8 h-8 text-accent-cyan animate-spin"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <p class="text-sm text-text-muted">
                    {activeProfile?.mode === 'local'
                      ? 'Starting sidecar and pinging…'
                      : 'Pinging gateway…'}
                  </p>
                </div>
              {:else if testStatus === 'ok'}
                <div class="flex flex-col items-center gap-3">
                  <div
                    class="w-12 h-12 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      class="w-6 h-6 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p class="text-sm text-text-primary font-medium">
                    {testMessage}
                  </p>
                </div>
              {:else}
                <div class="flex flex-col items-center gap-3">
                  <div
                    class="w-12 h-12 rounded-full bg-red-500/10 border-2 border-red-500 flex items-center justify-center"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      class="w-6 h-6 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                  <p
                    class="text-sm text-red-300 font-medium max-w-md break-words"
                  >
                    {testMessage ?? 'Connection failed'}
                  </p>
                </div>
              {/if}
            </div>

            <!-- Action row -->
            {#if testStatus === 'idle'}
              <button
                type="button"
                onclick={runTest}
                class="px-5 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition min-h-[44px]"
              >
                Test connection
              </button>
            {:else if testStatus === 'fail'}
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  onclick={runTest}
                  class="px-5 py-2 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition min-h-[44px]"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onclick={() => backToStep(2)}
                  class="text-sm text-text-muted hover:text-text-primary transition-colors min-h-[44px]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onclick={finish}
                  disabled={finishing}
                  class="text-sm text-accent-gold hover:underline transition disabled:opacity-50 min-h-[44px]"
                >
                  Finish anyway
                </button>
              </div>
            {:else if testStatus === 'ok'}
              <button
                type="button"
                onclick={finish}
                disabled={finishing}
                class="px-6 py-2.5 rounded-md bg-accent-cyan text-bg-deep text-sm font-semibold hover:brightness-110 transition disabled:opacity-50 min-h-[44px] flex items-center gap-2"
              >
                {finishing ? 'Finishing…' : 'Finish'}
                <svg
                  viewBox="0 0 24 24"
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            {/if}
          </div>

          {#if testStatus !== 'ok'}
            <div class="flex items-center justify-between">
              <button
                type="button"
                onclick={() => backToStep(2)}
                class="text-sm text-text-muted hover:text-text-primary transition-colors flex items-center gap-1 min-h-[44px]"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Back
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Persistent Skip link, bottom-right. Non-blocking by design — the
       user is never trapped in the wizard. -->
  <footer class="shrink-0 px-8 py-4 flex justify-end">
    <button
      type="button"
      onclick={skip}
      disabled={finishing}
      class="text-xs text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
    >
      Skip onboarding
    </button>
  </footer>
</section>

<style>
  /* Subtle fade-in on step change. CSS only — no JS animation library. */
  :global(.animate-step) {
    animation: stepFadeIn 220ms ease-out;
  }

  @keyframes stepFadeIn {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
