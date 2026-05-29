<script lang="ts">
  // First-run onboarding — collapsed to a single decision: where does your
  // agent run?
  //
  //   • Local  → one click. Spawns the bundled sidecar (NEAR.AI Cloud
  //              default, no key needed) and drops you into chat.
  //   • Hosted → prefilled gateway URL + paste your access token. We
  //              health-check BEFORE marking setup complete, so "done"
  //              can never mean "silently broken".
  //
  // Everything optional (custom server URL, API version) lives behind an
  // "Advanced" disclosure so the critical path stays sign-in-simple.
  // Local always uses NEAR.AI Cloud inference — no competing-provider option
  // in first-run (NEAR.AI's model is inference margin). Accent/theme + any
  // backend switching live in Settings.
  //
  // Invariants carried over from the old three-step wizard:
  //   - finishing ALWAYS writes `onboardingComplete: true` so the user is
  //     never trapped here;
  //   - on a save failure we arm the `ironclaw-onboarding-bypass`
  //     localStorage escape hatch the layout honours, so a broken
  //     settings write can't wedge the user on /onboarding forever;
  //   - the draft hydrates from disk in onMount but never clobbers a
  //     choice the user already made (settingsTouched guard).

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { IronClawClient } from '$lib/api/ironclaw';
  import { connection } from '$lib/stores/connection.svelte';
  import {
    DEFAULT_PROFILE_ID,
    HOSTED_DEFAULT_URL,
    loadSettings,
    saveSettings,
    setToken,
    type ApiVersion,
    type AppSettings,
    type ProfileConfig
  } from '$lib/stores/settings.svelte';
  import { toasts } from '$lib/stores/toasts.svelte';

  const LOCAL_DEFAULT_URL = 'http://127.0.0.1:3100';

  let view = $state<'choose' | 'hosted'>('choose');

  let settings = $state<AppSettings>({
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [],
    onboardingComplete: false
  });
  let settingsTouched = $state(false);

  const activeProfile = $derived<ProfileConfig | null>(
    settings.profiles.find((p) => p.id === settings.activeProfileId) ?? null
  );

  let hostedUrl = $state(HOSTED_DEFAULT_URL);
  let tokenInput = $state('');
  let connecting = $state(false);
  let busyLocal = $state(false);
  let errorMsg = $state<string | null>(null);

  // Advanced disclosure.
  let showAdvanced = $state(false);
  let apiVersionChoice = $state<ApiVersion>('v2');

  /** Host shown on the "sign in" link so we don't render a full URL. */
  const signInHost = $derived(hostOf(hostedUrl) ?? hostedUrl);

  function hostOf(url: string): string | null {
    try {
      return new URL(url).host;
    } catch {
      return null;
    }
  }

  onMount(async () => {
    const loaded = await loadSettings();
    if (!settingsTouched) settings = loaded;
    const active = loaded.profiles.find((p) => p.id === loaded.activeProfileId);
    if (active) {
      if (active.remoteBaseUrl && active.remoteBaseUrl !== LOCAL_DEFAULT_URL) {
        hostedUrl = active.remoteBaseUrl;
      }
      apiVersionChoice = active.apiVersion ?? 'v2';
    }
  });

  function patchActiveProfile(patch: Partial<ProfileConfig>) {
    if (!activeProfile) return;
    settingsTouched = true;
    settings = {
      ...settings,
      profiles: settings.profiles.map((p) => (p.id === activeProfile.id ? { ...p, ...patch } : p))
    };
  }

  function clearBypass() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('ironclaw-onboarding-bypass');
      }
    } catch {
      /* non-fatal */
    }
  }

  function armBypass() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('ironclaw-onboarding-bypass', '1');
      }
    } catch {
      /* non-fatal */
    }
  }

  /** One-click Local: save mode=local + onboarded, let the connection store
   *  spawn the sidecar (autostart is unblocked once onboardingComplete is
   *  true), then go to chat. The sign-in chip guides NEAR.AI sign-in. */
  async function chooseLocal() {
    if (busyLocal || !activeProfile) return;
    busyLocal = true;
    errorMsg = null;
    try {
      // Local always runs on NEAR.AI Cloud inference — that's the product's
      // model (NEAR.AI monetizes inference margin), so onboarding never
      // surfaces a competing provider. Power users can still switch backends
      // later in Settings.
      patchActiveProfile({
        mode: 'local',
        llmBackend: 'nearai',
        llmProviderId: 'nearai',
        apiVersion: apiVersionChoice
      });
      const next: AppSettings = { ...$state.snapshot(settings), onboardingComplete: true };
      await saveSettings(next);
      clearBypass();
      await connection.refresh();
      toasts.show('Running locally on this Mac', 'success');
      await goto('/');
    } catch (err) {
      errorMsg = (err as Error).message;
      armBypass();
      busyLocal = false;
    }
  }

  /** Hosted: health-check the gateway with the pasted token BEFORE marking
   *  onboarding complete, so we never finish into a broken connection. */
  async function connectHosted() {
    if (connecting || !activeProfile) return;
    const token = tokenInput.trim();
    const url = (hostedUrl.trim() || HOSTED_DEFAULT_URL).replace(/\/+$/, '');
    if (!token) {
      errorMsg = 'Paste your access token to connect.';
      return;
    }
    connecting = true;
    errorMsg = null;
    try {
      const probe = new IronClawClient({ baseUrl: url, token });
      const h = await probe.health();
      if (!h.ok) {
        errorMsg = `Gateway reachable but not healthy (status="${h.status ?? 'unknown'}"). Check the token.`;
        connecting = false;
        return;
      }
      await setToken(activeProfile.id, token);
      patchActiveProfile({ mode: 'remote', remoteBaseUrl: url, apiVersion: apiVersionChoice });
      const next: AppSettings = { ...$state.snapshot(settings), onboardingComplete: true };
      await saveSettings(next);
      clearBypass();
      await connection.refresh();
      toasts.show('Connected to hosted IronClaw', 'success');
      await goto('/');
    } catch (err) {
      errorMsg =
        (err as Error).message || 'Could not reach the gateway. Check the URL and your network.';
      connecting = false;
    }
  }

  /** Single, explicit escape hatch. Reads settings off disk (never the
   *  draft), flips only `onboardingComplete`, and leaves. */
  async function setupLater() {
    errorMsg = null;
    try {
      const onDisk = await loadSettings();
      await saveSettings({ ...onDisk, onboardingComplete: true });
      clearBypass();
      await connection.refresh();
      toasts.show('You can finish setup anytime in Settings', 'info');
      await goto('/');
    } catch (err) {
      armBypass();
      toasts.show(`Couldn't save settings: ${(err as Error).message}`, 'error');
      await goto('/');
    }
  }

  /** Open the gateway in the browser so the user can sign in to NEAR.AI and
   *  copy their access token. Uses the Tauri shell opener with a web
   *  fallback for dev/preview. */
  async function openSignIn() {
    const url = hostedUrl.trim() || HOSTED_DEFAULT_URL;
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } catch {
      try {
        window.open(url, '_blank', 'noopener');
      } catch {
        /* nothing else we can do */
      }
    }
  }
</script>

<div class="ob">
  <div class="ob__panel">
    <header class="ob__head">
      <h1 class="ob__title">Welcome to IronClaw</h1>
      <p class="ob__sub">Choose where your agent runs. You can change this anytime in Settings.</p>
    </header>

    {#if view === 'choose'}
      <div class="ob__choices">
        <button
          type="button"
          class="ob__choice"
          aria-label="Run locally on this Mac"
          disabled={busyLocal}
          onclick={chooseLocal}
        >
          <span class="ob__choice-title">Run on this Mac</span>
          <span class="ob__choice-desc">
            Starts a private IronClaw on your machine — no setup, no token. Defaults to NEAR.AI
            Cloud for the model.
          </span>
          <span class="ob__choice-cta">{busyLocal ? 'Starting…' : 'Local →'}</span>
        </button>

        <button
          type="button"
          class="ob__choice"
          aria-label="Connect to a hosted gateway"
          onclick={() => {
            errorMsg = null;
            view = 'hosted';
          }}
        >
          <span class="ob__choice-title">Connect to hosted</span>
          <span class="ob__choice-desc">
            Use a NEAR.AI-hosted IronClaw gateway. Sign in and paste your access token.
          </span>
          <span class="ob__choice-cta">Hosted →</span>
        </button>
      </div>
    {:else}
      <div class="ob__hosted">
        <button type="button" class="ob__back" onclick={() => (view = 'choose')}>← Back</button>
        <label class="ob__label" for="ob-token">Access token</label>
        <p class="ob__hint">
          Sign in at
          <button type="button" class="ob__link" onclick={openSignIn}>{signInHost}</button>
          and paste your access token below.
        </p>
        <input
          id="ob-token"
          class="ob__input"
          type="password"
          autocomplete="off"
          spellcheck="false"
          placeholder="Paste your IronClaw access token"
          bind:value={tokenInput}
        />
        <button
          type="button"
          class="ob__connect"
          disabled={connecting || tokenInput.trim().length === 0}
          onclick={connectHosted}
        >
          {connecting ? 'Connecting…' : 'Connect'}
        </button>
      </div>
    {/if}

    {#if errorMsg}
      <p class="ob__error" role="alert">{errorMsg}</p>
    {/if}

    <details class="ob__adv" bind:open={showAdvanced}>
      <summary class="ob__adv-summary">Advanced</summary>
      <div class="ob__adv-body">
        <label class="ob__label" for="ob-url">Custom server URL</label>
        <input
          id="ob-url"
          class="ob__input"
          type="url"
          autocomplete="off"
          spellcheck="false"
          placeholder="https://your-gateway.example"
          bind:value={hostedUrl}
        />

        <span class="ob__label">API version</span>
        <div class="ob__seg" role="group" aria-label="API version">
          <button
            type="button"
            class="ob__seg-btn"
            class:on={apiVersionChoice === 'v2'}
            onclick={() => (apiVersionChoice = 'v2')}
          >
            v2 (recommended)
          </button>
          <button
            type="button"
            class="ob__seg-btn"
            class:on={apiVersionChoice === 'v1'}
            onclick={() => (apiVersionChoice = 'v1')}
          >
            v1 (legacy)
          </button>
        </div>
      </div>
    </details>

    <button type="button" class="ob__later" onclick={setupLater}>Set up later</button>
  </div>
</div>

<style>
  .ob {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    background: var(--v2-canvas);
  }
  .ob__panel {
    width: 100%;
    max-width: 30rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .ob__head {
    text-align: center;
  }
  .ob__title {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 600;
    color: var(--v2-text-strong);
  }
  .ob__sub {
    margin: 0.4rem 0 0;
    font-size: 0.9rem;
    color: var(--v2-text-muted);
  }
  .ob__choices {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .ob__choice {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    text-align: left;
    padding: 1rem 1.1rem;
    border: 1px solid var(--v2-border);
    border-radius: 0.75rem;
    background: var(--v2-surface);
    color: var(--v2-text);
    cursor: pointer;
    transition:
      border-color var(--v2-dur-fast) var(--v2-ease-out),
      background var(--v2-dur-fast) var(--v2-ease-out),
      transform var(--v2-dur-fast) var(--v2-ease-out);
  }
  .ob__choice:hover:not(:disabled) {
    border-color: var(--v2-accent);
    background: var(--v2-surface-2);
  }
  .ob__choice:active:not(:disabled) {
    transform: translateY(1px);
  }
  .ob__choice:disabled {
    opacity: 0.6;
    cursor: progress;
  }
  .ob__choice-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--v2-text-strong);
  }
  .ob__choice-desc {
    font-size: 0.83rem;
    line-height: 1.45;
    color: var(--v2-text-muted);
  }
  .ob__choice-cta {
    margin-top: 0.15rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--v2-accent-text);
  }
  .ob__hosted {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.1rem;
    border: 1px solid var(--v2-border);
    border-radius: 0.75rem;
    background: var(--v2-surface);
  }
  .ob__back {
    align-self: flex-start;
    margin-bottom: 0.25rem;
    padding: 0.2rem 0;
    border: none;
    background: transparent;
    color: var(--v2-text-muted);
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
  }
  .ob__label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--v2-text);
  }
  .ob__hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--v2-text-muted);
  }
  .ob__link {
    padding: 0;
    border: none;
    background: transparent;
    color: var(--v2-accent-text);
    font: inherit;
    font-size: 0.8rem;
    text-decoration: underline;
    cursor: pointer;
  }
  .ob__input {
    padding: 0.6rem 0.7rem;
    border: 1px solid var(--v2-border);
    border-radius: 0.5rem;
    background: var(--v2-input-bg);
    color: var(--v2-text);
    font: inherit;
    font-size: 0.9rem;
  }
  .ob__input:focus {
    outline: none;
    border-color: var(--v2-accent);
  }
  .ob__connect {
    margin-top: 0.35rem;
    padding: 0.6rem 0.9rem;
    border: 1px solid var(--v2-accent);
    border-radius: 0.5rem;
    background: var(--v2-accent);
    color: #fff;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition:
      opacity var(--v2-dur-fast) var(--v2-ease-out),
      transform var(--v2-dur-fast) var(--v2-ease-out);
  }
  .ob__connect:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .ob__connect:active:not(:disabled) {
    transform: translateY(1px);
  }
  .ob__error {
    margin: 0;
    padding: 0.55rem 0.7rem;
    border-radius: 0.5rem;
    background: var(--v2-danger-soft);
    color: var(--v2-danger-text);
    font-size: 0.82rem;
  }
  .ob__adv {
    border-top: 1px solid var(--v2-border);
    padding-top: 0.75rem;
  }
  .ob__adv-summary {
    font-size: 0.82rem;
    color: var(--v2-text-muted);
    cursor: pointer;
  }
  .ob__adv-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .ob__seg {
    display: flex;
    gap: 0.4rem;
  }
  .ob__seg-btn {
    flex: 1 1 auto;
    padding: 0.45rem 0.5rem;
    border: 1px solid var(--v2-border);
    border-radius: 0.5rem;
    background: var(--v2-surface);
    color: var(--v2-text-muted);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    transition:
      border-color var(--v2-dur-fast) var(--v2-ease-out),
      color var(--v2-dur-fast) var(--v2-ease-out);
  }
  .ob__seg-btn.on {
    border-color: var(--v2-accent);
    color: var(--v2-accent-text);
    background: var(--v2-accent-soft);
  }
  .ob__later {
    align-self: center;
    margin-top: 0.25rem;
    padding: 0.35rem 0.5rem;
    border: none;
    background: transparent;
    color: var(--v2-text-faint);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .ob__later:hover {
    color: var(--v2-text-muted);
  }
</style>
