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
    PROFILE_TINT_ORDER,
    PROFILE_TINTS,
    resolveTint,
    saveSettings,
    setOpenRouterKey,
    setToken,
    type AppSettings,
    type ConnectionMode,
    type ProfileConfig,
    type ProfileTint
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
  /** True once the user has interacted with the draft (picked a mode,
   *  typed a URL, etc). Gates the onMount settings hydrate so a slow
   *  `loadSettings()` resolving AFTER the user already clicked Local
   *  on step 1 does NOT silently revert their choice by overwriting
   *  the entire `settings` rune with the on-disk shape. Real bug from
   *  the v0.2.0 .app dogfood — see CHANGELOG. */
  let settingsTouched = $state(false);

  /** Active profile inside the editable draft. Everything the wizard
   *  writes (mode, URL, LLM backend, Keychain entries) goes through this. */
  const activeProfile = $derived<ProfileConfig | null>(
    settings.profiles.find((p) => p.id === settings.activeProfileId) ?? null
  );

  function patchActiveProfile(patch: Partial<ProfileConfig>) {
    if (!activeProfile) return;
    settingsTouched = true;
    settings = {
      ...settings,
      profiles: settings.profiles.map((p) => (p.id === activeProfile.id ? { ...p, ...patch } : p))
    };
  }

  // ---- step 1: tint picker -------------------------------------------------
  //
  // Per-profile accent override (R16d). The wizard previews the chosen tint
  // by painting the same four `--v2-accent*` CSS variables that the
  // connection store paints from `activeProfile.tint` — so the active mode
  // card border, Next button, stepper dot, etc. all flip instantly. Persisted
  // to the active profile only on Finish (or Skip-after-pick — see below).
  //
  // Survives Back/Next inside the wizard because the rune lives at the
  // component root, not inside a step block. On mount we hydrate from the
  // active profile so a returning user (Re-run onboarding) sees their
  // existing choice pre-selected, and back-nav within a single wizard run
  // never resets a fresh pick.
  let chosenTint = $state<ProfileTint>('signal');
  /** True once the user clicks any swatch in this wizard run. Used to gate
   *  the live-preview $effect — without this, the effect would overwrite
   *  the connection-store's initial paint on mount before the user has
   *  expressed any preference. */
  let tintTouched = $state(false);

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
  /** Live-chat probe state. Populated after `health()` succeeds; orthogonal to
   *  the gateway-reachability result so a failed chat probe never demotes a
   *  healthy gateway back to "fail". */
  let chatStatus = $state<'idle' | 'probing' | 'ok' | 'timeout' | 'error' | 'skipped'>('idle');
  let chatPreview = $state<string | null>(null);
  let chatHint = $state<string | null>(null);
  /** User-opt-out for the live-chat probe. Set via the "Skip LLM test" link
   *  in step 3; persists across re-tests within the same wizard run so a
   *  Try-again click after a transient network blip doesn't re-run the
   *  chat probe the user already dismissed. */
  let skipLlmTest = $state(false);

  let finishing = $state(false);

  // ---- step 2: auto-detect existing local IronClaw servers ----------------
  //
  // Best-effort probe of common dev ports. Runs once when the user lands on
  // step 2 in remote mode. A hit pre-populates a suggestion above the URL
  // field with a one-click apply; a miss is silent. Each candidate is a raw
  // `fetch` with a 2-second AbortController timeout so the worst case is
  // ~2 seconds, not 30+ on a stalled socket. All candidates run concurrently
  // via Promise.allSettled() so a stalled port doesn't block faster hits.
  /** Candidate ports for `127.0.0.1` auto-detect. Ordered: IronClaw default
   *  (3100), the SSH-tunnel convention (18789 from CLAUDE.md), legacy 3334,
   *  other common dev ports (8080, 22821 alt SSH tunnel, 3000 Node default). */
  const DETECT_PORTS = [3100, 18789, 3334, 8080, 22821, 3000] as const;
  /** Per-port probe timeout in milliseconds. */
  const DETECT_PORT_TIMEOUT_MS = 2000;
  /** Detected URL if any of the candidates above answered with a healthy
   *  payload. Persists across Back/Next inside the wizard run so the banner
   *  reappears when the user revisits step 2 — re-scanning is gated on
   *  `detectionRan`. Cleared only via the dismiss button. */
  let detectedUrl = $state<string | null>(null);
  /** Tracks whether we've kicked the detection at least once so we don't
   *  re-probe on every step change (re-running back-and-forth via "Back"
   *  shouldn't spam the user's localhost). */
  let detectionRan = $state(false);
  /** True while the parallel port scan is in flight. Drives the
   *  "Scanning…" indicator above the URL field. */
  let detectionScanning = $state(false);
  /** Best-effort fingerprint of the detected server. Populated by a
   *  follow-up GET /api/gateway/status after a hit. Fields are nullable so
   *  partial info still renders ("IronClaw at <url>" without a version
   *  string is still useful). */
  let detectedVersion = $state<string | null>(null);
  let detectedLlmBackend = $state<string | null>(null);
  /** True once the user clicks "Use" on the detect banner — drives the
   *  "✓ Detected and saved" confirmation state. */
  let detectedSaved = $state(false);

  onMount(async () => {
    const loaded = await loadSettings();
    // Hydrate the draft from disk. If the user has already interacted with
    // the wizard (picked Local on step 1 before this slow load resolved),
    // we MERGE rather than replace: take the disk shape as a baseline but
    // overlay the user's mode pick (and any other patched fields) so the
    // late-arriving load can't silently revert their choice. Without the
    // overlay, the v0.2.0 .app dogfood showed step 2 silently flipping
    // back to REMOTE after the user clicked Local — Next/Skip would then
    // appear to "do nothing visible" because the wrong body re-rendered.
    if (!settingsTouched) {
      settings = loaded;
    } else if (pendingChosenMode !== null) {
      // Slow-load path: user already picked a mode. Take the disk profiles
      // and apply the pending mode to the active profile so step 2 renders
      // the user's intended body.
      const activeId = loaded.activeProfileId;
      settings = {
        ...loaded,
        profiles: loaded.profiles.map((p) =>
          p.id === activeId
            ? {
                ...p,
                mode: pendingChosenMode!,
                llmBackend: p.llmBackend ?? 'nearai'
              }
            : p
        )
      };
    }
    const id = loaded.activeProfileId;
    if (id) {
      const t = await getToken(id);
      tokenStored = !!t;
      const or = await getOpenRouterKey(id);
      openRouterStored = !!or;
    }
    // Hydrate the tint picker from the active profile so a Re-run-onboarding
    // user sees their existing accent pre-selected. New installs land with
    // `tint: undefined` which resolves to 'signal' (the default). We use the
    // freshly-loaded snapshot rather than the live draft so a touched draft
    // (Local picked early) still seeds the picker correctly.
    const active = loaded.profiles.find((p) => p.id === loaded.activeProfileId);
    if (active?.tint && !tintTouched) chosenTint = active.tint;
  });

  /** Live preview: paint the four `--v2-accent*` CSS variables on
   *  documentElement whenever `chosenTint` changes AFTER the user clicks a
   *  swatch. Mirrors the connection store's painter so any surface bound to
   *  `var(--v2-accent*)` (active mode-card border, stepper dot, Next button)
   *  flips instantly. NOT persisted — Finish writes the chosen tint to the
   *  profile via the existing `saveSettings` path, which then triggers the
   *  connection-store effect for the real, lasting paint. */
  $effect(() => {
    // Read BOTH runes up-front so Svelte 5's signal tracker subscribes to
    // each — early-returning after `tintTouched` alone would make the
    // effect re-fire only on the touched→true transition and miss
    // subsequent swatch clicks (chosenTint changes wouldn't re-run). The
    // gate then short-circuits before the DOM write.
    const t = chosenTint;
    const touched = tintTouched;
    if (!touched) return;
    if (typeof document === 'undefined') return;
    const palette = resolveTint(t);
    const root = document.documentElement;
    root.style.setProperty('--v2-accent', palette.accent);
    root.style.setProperty('--v2-accent-strong', palette.strong);
    root.style.setProperty('--v2-accent-soft', palette.soft);
    root.style.setProperty('--v2-accent-text', palette.text);
  });

  /** Pick a tint. Wrapped so the picker UI stays declarative and any future
   *  cross-cutting concern (analytics, toast, etc.) has one entry point. */
  function pickTint(tint: ProfileTint) {
    tintTouched = true;
    chosenTint = tint;
  }

  /**
   * Probe a single candidate `http://127.0.0.1:<port>/api/health` with a
   * 2-second timeout. Returns the candidate URL on healthy response, null
   * otherwise. No auth header — the gateway returns a friendly 200 on
   * `/api/health` even without a bearer.
   */
  async function probeCandidate(port: number): Promise<string | null> {
    const base = `http://127.0.0.1:${port}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), DETECT_PORT_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/api/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: ctrl.signal
      });
      if (!res.ok) return null;
      const text = await res.text();
      if (!text) return null;
      const data = JSON.parse(text) as { status?: string };
      if (data?.status === 'healthy' || data?.status === 'ok') return base;
      return null;
    } catch {
      // Any network/abort/parse error → not a match. Silent on purpose.
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Best-effort fingerprint of a detected gateway. Hits `/api/gateway/status`
   * unauthenticated — most builds gate this behind a bearer, so failure is
   * common and silent. On success we pluck `version` and `llm_backend` to
   * upgrade the banner from "Detected IronClaw at <url>" to
   * "Detected IronClaw v0.29.0 (NEAR.AI Cloud) at <url>".
   *
   * Why a raw fetch instead of `IronClawClient.gatewayStatus()`: the API
   * client wires its own non-throwing error semantics and an Authorization
   * header. Per the task constraints we don't touch the client; a single
   * fetch with the same 2-second budget is sufficient and keeps the wizard
   * change self-contained.
   */
  async function fetchFingerprint(
    base: string
  ): Promise<{ version: string | null; llmBackend: string | null }> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), DETECT_PORT_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/api/gateway/status`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: ctrl.signal
      });
      if (!res.ok) return { version: null, llmBackend: null };
      const data = (await res.json()) as {
        version?: string;
        llm_backend?: string;
      };
      return {
        version: data?.version ?? null,
        llmBackend: data?.llm_backend ?? null
      };
    } catch {
      // Auth-gated, network drop, malformed JSON — all fine, we just skip
      // the fingerprint and keep the bare detect banner.
      return { version: null, llmBackend: null };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Human label for a `llm_backend` wire value. Falls back to the raw
   *  identifier when we don't have a friendlier name. */
  function llmBackendLabel(raw: string | null): string | null {
    if (!raw) return null;
    const k = raw.toLowerCase();
    if (k === 'nearai' || k === 'near-ai' || k === 'near_ai') return 'NEAR.AI Cloud';
    if (k === 'openrouter') return 'OpenRouter';
    return raw;
  }

  /** Race all candidates in parallel via Promise.allSettled() so a stalled
   *  port doesn't block faster hits. Skips probe if the user already typed
   *  a non-default URL (don't overwrite their input). Idempotent — gated on
   *  `detectionRan` so back-and-forth between wizard steps never re-scans. */
  async function detectLocalServers() {
    if (detectionRan) return;
    detectionRan = true;
    // If the user already entered something custom, respect it — don't
    // pre-populate over it.
    const current = activeProfile?.remoteBaseUrl ?? '';
    if (current && current !== 'http://127.0.0.1:3100') return;
    detectionScanning = true;
    try {
      const settled = await Promise.allSettled(DETECT_PORTS.map((p) => probeCandidate(p)));
      const hit = settled
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .find((u): u is string => !!u);
      if (hit) {
        detectedUrl = hit;
        // Fingerprint fetch is best-effort and runs after the banner is
        // already visible, so the user sees the URL immediately and the
        // version "fills in" once the call returns.
        const fp = await fetchFingerprint(hit);
        detectedVersion = fp.version;
        detectedLlmBackend = fp.llmBackend;
      }
    } finally {
      detectionScanning = false;
    }
  }

  /** Apply the detected URL to the active profile AND persist immediately.
   *  Banner stays visible in the "saved" state so the user has confirmation
   *  and can re-apply if they revisit step 2 via the Back button. */
  async function applyDetectedUrl() {
    if (!detectedUrl || !activeProfile) return;
    const url = detectedUrl;
    patchActiveProfile({ remoteBaseUrl: url });
    try {
      // Snapshot AFTER the patch so the saved file reflects the new URL.
      // `patchActiveProfile` mutated `settings`, so the snapshot reads the
      // updated profile entry.
      await saveSettings($state.snapshot(settings));
      detectedSaved = true;
      toasts.show('Detected URL saved to profile', 'success');
    } catch (err) {
      toasts.show(`Save failed: ${(err as Error).message}`, 'error');
    }
  }

  function dismissDetectedUrl() {
    detectedUrl = null;
    detectedVersion = null;
    detectedLlmBackend = null;
    detectedSaved = false;
  }

  /** Fire detection whenever step 2 is visited in remote mode. The effect
   *  short-circuits via `detectionRan` so we only ever probe once per
   *  wizard run. */
  $effect(() => {
    if (step === 2 && activeProfile?.mode === 'remote') {
      void detectLocalServers();
    }
  });

  /** Auto-run the connection test on first arrival at step 3 so the user
   *  doesn't have to click a manual button. Gated on `testStatus === 'idle'`
   *  so a Back→Next round trip after a failed test doesn't auto-retry — the
   *  user has to explicitly hit "Try again", which is the existing failure
   *  recovery path. The Skip-LLM affordance still works because runTest()
   *  clears `chatStatus` before kicking the probe. */
  let autoTestFired = $state(false);
  $effect(() => {
    if (step === 3 && testStatus === 'idle' && !autoTestFired) {
      autoTestFired = true;
      void runTest();
    }
  });

  // ---- navigation helpers --------------------------------------------------

  /** Mode the user clicked on step 1. Tracked separately from the active
   *  profile so a click that lands BEFORE the slow `loadSettings()`
   *  resolves (empty profiles array → `patchActiveProfile` no-op) still
   *  records the intent. A follow-up $effect re-applies the pick once
   *  the profile materializes, keeping step 2's body in sync with the
   *  user's choice. Real bug from v0.2.0 .app dogfood. */
  let pendingChosenMode = $state<ConnectionMode | null>(null);

  function chooseMode(mode: ConnectionMode) {
    // Record the user's intent up-front so a later loadSettings resolve
    // (or the $effect below) can re-apply it even if the draft was empty
    // at click time.
    pendingChosenMode = mode;
    settingsTouched = true;
    // Default the local-mode backend to NEAR.AI Cloud unless the user
    // already picked OpenRouter in a previous session.
    patchActiveProfile({
      mode,
      llmBackend: activeProfile?.llmBackend ?? 'nearai'
    });
    step = 2;
  }

  /** Re-apply the user's mode pick from step 1 if `loadSettings` finishes
   *  after `chooseMode` ran. Pure no-op when:
   *   - the user hasn't picked a mode yet (pendingChosenMode === null), or
   *   - there's no active profile to patch yet, or
   *   - the active profile already matches the pick. */
  $effect(() => {
    if (pendingChosenMode === null) return;
    if (!activeProfile) return;
    if (activeProfile.mode === pendingChosenMode) return;
    patchActiveProfile({
      mode: pendingChosenMode,
      llmBackend: activeProfile.llmBackend ?? 'nearai'
    });
  });

  function backToStep(target: 1 | 2 | 3) {
    // Clear stale test state when backing up so step 3 starts fresh.
    if (target < 3) {
      testStatus = 'idle';
      testMessage = null;
      testVersion = null;
      chatStatus = 'idle';
      chatPreview = null;
      chatHint = null;
      // Allow the step-3 effect to auto-run again next time the user
      // arrives there. Without this reset, the auto-test would fire only
      // on the first visit to step 3 and a Back→Next round trip would
      // strand the user on an empty status pane.
      autoTestFired = false;
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
          // Sanity check the token shape before storing. R48 P1: a user
          // pasted the literal SSH command (`ssh -p ... agent@host`) into
          // the token field and the app stored it without complaint, then
          // 401'd every gateway request and showed "Disconnected" forever
          // with no UX hint that the token was malformed. Tokens are
          // opaque bearer strings — refuse anything that obviously isn't.
          const looksLikeSshCmd = /^ssh(\s|$)/i.test(t);
          const hasWhitespace = /\s/.test(t);
          const hasAtSign = t.includes('@');
          if (looksLikeSshCmd || hasWhitespace || hasAtSign) {
            toasts.show(
              'That looks like an SSH command, not a token. Paste the gateway bearer (no spaces, no @-host).',
              'error'
            );
            return;
          }
          if (t.length < 16) {
            toasts.show('Token is too short — gateway bearers are at least 16 chars.', 'error');
            return;
          }
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
    chatStatus = 'idle';
    chatPreview = null;
    chatHint = null;
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
        // Live-chat probe: in local mode we run it whenever the sidecar
        // is actually `running` (it was just started above). Pre-flight
        // through `getProfile()` still gates on NEAR.AI sign-in so we
        // don't fire a chat that would fail with a confusing 401 when
        // the user hasn't signed in yet.
        if (connection.sidecarStatus === 'running' && !skipLlmTest) {
          await runChatProbe(connection.client, { requireSignIn: true });
        } else if (skipLlmTest) {
          chatStatus = 'skipped';
          chatHint = 'Skipped by user';
        }
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
      testMessage = testVersion ? `Connected to IronClaw ${testVersion}` : 'Connected to IronClaw';
      // Remote gateways are pre-authenticated via the bearer token, so the
      // chat probe is unconditional here. A 401 from the chat probe still
      // demotes to `chatStatus='error'` (without flipping the gateway state).
      // Honor an explicit skip toggle for users in a hurry.
      if (!skipLlmTest) {
        await runChatProbe(client, { requireSignIn: false });
      } else {
        chatStatus = 'skipped';
        chatHint = 'Skipped by user';
      }
    } catch (err) {
      testStatus = 'fail';
      testMessage = (err as Error).message;
    }
  }

  /**
   * Send a one-shot "Hello, are you there?" to the gateway and collect the
   * streamed response. Updates `chatStatus`, `chatPreview`, `chatHint` in
   * place; never throws. Designed to never block the wizard for longer
   * than 15 seconds — a hard AbortController timeout fires regardless of
   * stream state.
   *
   * Failure modes are split into:
   *   - `skipped`  : pre-flight failed (e.g. local mode but signed-out)
   *   - `ok`       : at least one content_delta arrived
   *   - `timeout`  : 15s elapsed without any content
   *   - `error`    : thread create / send / stream open threw
   *
   * In all non-`ok` cases the existing `testStatus='ok'` is left untouched so
   * the wizard's "Finish" button stays enabled. A flaky LLM should not
   * trap the user on step 3.
   */
  async function runChatProbe(
    client: IronClawClient,
    opts: { requireSignIn: boolean }
  ): Promise<void> {
    chatStatus = 'probing';
    chatPreview = null;
    chatHint = null;

    // Pre-flight: in local mode, refuse to call /api/chat/send if the
    // sidecar isn't signed in. /api/profile is the cheapest way to read
    // sign-in state (it returns null on 401/403, doesn't throw).
    if (opts.requireSignIn) {
      try {
        const profile = await client.getProfile();
        if (profile === null) {
          chatStatus = 'skipped';
          chatHint = 'Sign in to NEAR.AI to test the LLM';
          return;
        }
      } catch {
        // If the profile endpoint itself fails, we can't know sign-in state.
        // Better to skip the chat probe than to fire a request that will
        // confuse the user with an auth error.
        chatStatus = 'skipped';
        chatHint = 'LLM check skipped (sign-in unknown)';
        return;
      }
    }

    let threadId: string | null = null;
    try {
      // Note: failures here (network drop, 5xx, malformed response) catch
      // below and surface as `chatStatus='error'`. The gateway is still
      // considered healthy because /api/health passed; the chat probe is
      // a separate, best-effort signal.
      const thread = await client.newThread('Onboarding test');
      threadId = thread.id;
      if (!threadId) {
        chatStatus = 'error';
        chatHint = 'Could not create test thread';
        return;
      }
    } catch (err) {
      chatStatus = 'error';
      chatHint = (err as Error).message ?? 'Thread creation failed';
      return;
    }

    // Open SSE stream BEFORE sending, so the server's response events
    // (which the gateway emits as soon as the LLM yields its first token)
    // don't race past us. EventSource subscribes synchronously inside
    // streamEvents().
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    let accumulated = '';
    let sawEnd = false;
    let streamError: string | null = null;

    // Kick off iteration in parallel with the send. The async iterator
    // returned by streamEvents() needs an `await for` to drive it.
    const consume = (async () => {
      try {
        for await (const ev of client.streamEvents(threadId!, ctrl.signal)) {
          if (ev.type === 'content_delta') {
            accumulated += ev.delta;
          } else if (ev.type === 'message_end') {
            sawEnd = true;
            break;
          } else if (ev.type === 'error') {
            streamError = ev.message;
            break;
          }
          // Other event types (tool_call, tool_result, message_start) are
          // ignored — we only care about text content for this probe.
        }
      } catch (err) {
        // Abort-driven termination throws an AbortError; treat that as a
        // clean shutdown (timeout handler distinguishes). Other errors
        // surface to the caller via streamError.
        const name = (err as Error)?.name;
        if (name !== 'AbortError') {
          streamError = (err as Error).message ?? String(err);
        }
      }
    })();

    try {
      await client.sendMessage(threadId, 'Hello, are you there?');
    } catch (err) {
      // Send failed — abort the stream, surface the error.
      clearTimeout(timer);
      ctrl.abort();
      await consume.catch(() => {});
      chatStatus = 'error';
      chatHint = (err as Error).message ?? 'Send failed';
      return;
    }

    // Wait for the stream consumer to finish (either via message_end,
    // explicit error event, or the 15-second abort).
    await consume;
    clearTimeout(timer);

    // Classify the outcome. Any accumulated content counts as success,
    // even if the stream timed out before `message_end` — the LLM clearly
    // replied. Empty + sawEnd is a strange but technically-valid response;
    // we treat it as a soft failure so the user sees "LLM not tested".
    if (accumulated.trim().length > 0) {
      chatStatus = 'ok';
      const preview = accumulated.trim().replace(/\s+/g, ' ');
      chatPreview = preview.length > 100 ? `${preview.slice(0, 100)}…` : preview;
      chatHint = null;
    } else if (streamError) {
      chatStatus = 'error';
      chatHint = streamError;
    } else if (sawEnd) {
      // Server closed cleanly with no content — unusual but not a hard
      // failure; the gateway is still healthy.
      chatStatus = 'timeout';
      chatHint = 'Healthy (LLM not tested — empty reply)';
    } else {
      // 15s elapsed, no message_end, no content. Most likely cause: cold
      // model load or signed-out gateway in remote mode.
      chatStatus = 'timeout';
      chatHint = 'Healthy (LLM not tested — timed out after 15s)';
    }
  }

  /** "Skip LLM test" affordance — flips the persistent flag and short-circuits
   *  the chat probe if it's currently running. Leaves the gateway test result
   *  intact so the user can still click "Finish". */
  function skipLlmProbe() {
    skipLlmTest = true;
    if (chatStatus === 'probing' || chatStatus === 'idle') {
      chatStatus = 'skipped';
      chatPreview = null;
      chatHint = 'Skipped by user';
    }
  }

  // ---- finish / skip -------------------------------------------------------

  /**
   * Merge the picked tint into the active profile entry of an `AppSettings`
   * snapshot. Pure — returns a new object, never mutates. Used by both
   * `finish()` and `skip()` so the user's previewed accent persists either
   * way: if we only persisted on Finish, a Skip-after-pick would leave the
   * live `--v2-accent*` overrides stranded (the connection store caches its
   * last-applied tint, so a reload-from-disk that produces an unchanged
   * profile tint won't re-paint to clear the preview).
   *
   * `tintTouched` gates the merge — an untouched picker writes nothing, so
   * a first-run user who never opened step 1's Personalize section keeps
   * the existing `tint: undefined` value (and thus the design-system
   * default at resolve time).
   */
  function withChosenTint(s: AppSettings): AppSettings {
    if (!tintTouched) return s;
    return {
      ...s,
      profiles: s.profiles.map((p) => (p.id === s.activeProfileId ? { ...p, tint: chosenTint } : p))
    };
  }

  async function finish() {
    finishing = true;
    try {
      const next = withChosenTint({ ...settings, onboardingComplete: true });
      await saveSettings(next);
      // Clear any prior bypass flag — the user just completed onboarding
      // successfully, so the layout's redirect-in is no longer something
      // to suppress on next launch.
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('ironclaw-onboarding-bypass');
        }
      } catch {
        // non-fatal
      }
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

  /**
   * Skip from any step. Bulletproof contract (R34d):
   *   1. Read CURRENT settings off disk via `loadSettings()` — NOT this
   *      component's draft, which may have been mutated by
   *      `chooseMode('local')` mid-flow. The wizard never gets to write
   *      `mode: local` to disk on Skip just because the user clicked
   *      through step 1.
   *   2. Flip ONLY `onboardingComplete: true`, leaving every other field
   *      (mode, URLs, llmBackend, profiles, etc.) exactly as it was on
   *      disk.
   *   3. Apply a touched-tint pick to whichever profile is active on
   *      disk — the user made an explicit cosmetic choice, so it's safe
   *      to carry through Skip.
   *   4. Persist via the JSON-roundtrip `saveSettings` path (the JUST
   *      patched cloneable fix at settings.svelte.ts:saveSettings — do
   *      NOT bypass it).
   *   5. Refresh the live connection so the chat surface picks up the
   *      mode that was already on disk (NOT the wizard's local draft).
   *   6. Navigate to `/`.
   *
   * On error: surface a toast AND set the `ironclaw-onboarding-bypass`
   * localStorage key so the user is not trapped on /onboarding on next
   * launch even if `saveSettings` keeps failing. The escape hatch in
   * +layout.svelte honours this flag and short-circuits the redirect-in.
   */
  async function skip() {
    finishing = true;
    try {
      // Always read from disk — never trust the in-component draft.
      const onDisk = await loadSettings();
      let next: AppSettings = { ...onDisk, onboardingComplete: true };
      // Apply the touched tint to whichever profile is currently active
      // on disk (not the draft's active profile, in case those diverged).
      if (tintTouched) {
        next = {
          ...next,
          profiles: next.profiles.map((p) =>
            p.id === next.activeProfileId ? { ...p, tint: chosenTint } : p
          )
        };
      }
      await saveSettings(next);
      // Clear any prior bypass flag so a successful Skip doesn't leave
      // the escape hatch armed forever.
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('ironclaw-onboarding-bypass');
        }
      } catch {
        // non-fatal
      }
      await connection.refresh();
      toasts.show('Skipped — you can finish setup in Settings', 'info');
      await goto('/');
    } catch (err) {
      // Belt-and-suspenders escape: flip the localStorage bypass so the
      // layout's redirect-in is suppressed on next launch even if
      // settings.json save is still broken.
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('ironclaw-onboarding-bypass', '1');
        }
      } catch {
        // If we can't even write to localStorage, the user is going to
        // have a bad time anyway — the toast is the only signal we can
        // surface.
      }
      toasts.show(`Skip failed (escape armed): ${(err as Error).message}`, 'error');
      // Best-effort: still try to navigate out so the user gets to /;
      // the bypass flag will carry them past the layout redirect.
      try {
        await goto('/');
      } catch {
        // ignored — finishing flips back to false so the user can retry
      }
      finishing = false;
    }
  }
</script>

<!-- Full-screen takeover. Sidebar is hidden in +layout.svelte when the
     route starts with /onboarding, so this owns the whole viewport.

     `tint-preview` re-binds Tailwind's hardcoded `accent-cyan` palette to
     the live `--v2-accent*` CSS variables (see <style> below). Without
     this, the picker's $effect would paint the vars but the wizard's own
     mode-card border / Next button / stepper dot — which compile to a
     fixed hex from tailwind.config.js — wouldn't move. Scoping the
     override to this section avoids leaking the rebind into any chrome
     that might mount alongside the wizard. -->
<section class="min-h-screen w-full flex flex-col tint-preview">
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
            <span class="w-8 h-px" class:bg-accent-cyan={isDone} class:bg-border-subtle={!isDone}
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
            <h1 class="text-3xl font-semibold text-text-primary">Welcome to IronClaw</h1>
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
                Run IronClaw on this Mac. Private. Free with NEAR.AI Cloud. ~150MB bundled.
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
                Connect to an IronClaw server you (or your team) operate. Bring your URL + token.
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

          <!-- Personalize. Tint picker below the mode cards. Six swatches
               that live-preview by painting `--v2-accent*` on documentElement
               via the $effect above — so the active mode-card border, the
               stepper dot, and any other `var(--v2-accent)`-bound surface
               flips as the user clicks through. Persisted to the active
               profile on Finish (and on Skip-after-pick) via withChosenTint. -->
          <div class="space-y-3">
            <div
              class="flex flex-col items-center gap-3"
              role="radiogroup"
              aria-label="Accent color"
            >
              <div class="flex items-center gap-3">
                {#each PROFILE_TINT_ORDER as tintKey (tintKey)}
                  {@const swatch = PROFILE_TINTS[tintKey]}
                  {@const isSelected = chosenTint === tintKey}
                  <button
                    type="button"
                    onclick={() => pickTint(tintKey)}
                    title={swatch.label}
                    aria-label="Set accent color to {swatch.label}"
                    aria-checked={isSelected}
                    role="radio"
                    class="rounded-full transition-all min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none"
                  >
                    <span
                      class="block w-6 h-6 rounded-full transition-all"
                      style="background-color: {swatch.accent}; {isSelected
                        ? `box-shadow: 0 0 0 3px ${swatch.accent};`
                        : ''}"
                    ></span>
                  </button>
                {/each}
              </div>
              <p class="text-xs text-text-muted">Accent color</p>
            </div>
          </div>
        </div>
      {:else if step === 2}
        <div class="space-y-6 animate-step">
          {#if activeProfile?.mode === 'local'}
            <div class="space-y-2">
              <h1 class="text-2xl font-semibold text-text-primary">Set up NEAR.AI Cloud</h1>
              <p class="text-text-muted text-sm">
                We'll set up NEAR.AI Cloud — IronClaw's built-in inference. You'll sign in with your
                NEAR account after we start the sidecar.
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
                    <span class="text-sm font-semibold text-text-primary">NEAR.AI Cloud</span>
                    <span
                      class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30"
                    >
                      Recommended
                    </span>
                  </div>
                  <p class="text-xs text-text-muted">
                    Free during private preview. No API key required — sign in with your NEAR
                    account when the sidecar starts.
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
                    <label for="onb-orkey" class="block text-xs text-text-muted mb-1">
                      OpenRouter key
                    </label>
                    <input
                      id="onb-orkey"
                      type="password"
                      bind:value={openRouterInput}
                      placeholder={openRouterStored ? '•••• stored in macOS Keychain' : 'sk-or-...'}
                      class="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-cyan transition-colors min-h-[44px]"
                    />
                  </div>
                  <p class="text-xs text-text-muted">
                    Need a key?
                    <button
                      type="button"
                      onclick={() => openExternal('https://openrouter.ai/keys')}
                      class="text-accent-cyan underline decoration-dotted hover:decoration-solid inline-flex items-center gap-1"
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
                Enter the URL and gateway token. The token is stored in your macOS Keychain — never
                in plain text on disk.
              </p>
            </div>

            <div class="surface p-5 space-y-5">
              <div>
                <label for="onb-url" class="block text-xs text-text-muted mb-1"> Base URL </label>
                {#if detectionScanning && !detectedUrl}
                  <!-- Live scan indicator. Replaced with the detect banner
                       once Promise.allSettled resolves and a hit is found,
                       or silently dropped if no port answered. -->
                  <div
                    class="mb-2 flex items-center gap-2 px-3 py-2 rounded-md border border-border-subtle bg-bg-deep text-xs text-text-muted"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      class="w-3.5 h-3.5 text-accent-cyan animate-spin shrink-0"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <span>Scanning localhost for an IronClaw server…</span>
                  </div>
                {/if}
                {#if detectedUrl}
                  <!-- Auto-detect hint. Renders only when probeCandidate()
                       found a healthy IronClaw on a common localhost port.
                       Two visual states:
                         1. Pre-apply: cyan banner, "Use" button + dismiss
                         2. Post-apply: green banner, "✓ Detected and saved"
                       Both stay visible on Back/Next so the user gets a
                       consistent picture each time they revisit step 2. -->
                  {#if detectedSaved}
                    <div
                      class="mb-2 flex items-center gap-2 px-3 py-2 rounded-md border border-green-500/40 bg-green-500/5 text-xs"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        class="w-4 h-4 text-green-400 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span class="flex-1 text-text-primary">
                        Detected and saved —
                        <code class="font-mono">{detectedUrl}</code>
                        {#if detectedVersion}
                          <span class="text-text-muted">
                            (IronClaw {detectedVersion}{#if detectedLlmBackend}, {llmBackendLabel(
                                detectedLlmBackend
                              )}{/if})
                          </span>
                        {/if}
                      </span>
                      <button
                        type="button"
                        onclick={dismissDetectedUrl}
                        aria-label="Dismiss"
                        class="text-text-muted hover:text-text-primary transition-colors"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          class="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  {:else}
                    <div
                      class="mb-2 flex items-center gap-2 px-3 py-2 rounded-md border border-accent-cyan/40 bg-accent-cyan/5 text-xs"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        class="w-4 h-4 text-accent-cyan shrink-0"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                      <span class="flex-1 text-text-primary">
                        {#if detectedVersion}
                          Detected IronClaw {detectedVersion}{#if detectedLlmBackend}
                            ({llmBackendLabel(detectedLlmBackend)}){/if} at
                          <code class="font-mono">{detectedUrl}</code> — use this?
                        {:else}
                          Detected IronClaw at
                          <code class="font-mono">{detectedUrl}</code> — use this?
                        {/if}
                      </span>
                      <button
                        type="button"
                        onclick={applyDetectedUrl}
                        class="px-2 py-1 rounded bg-accent-cyan text-bg-deep text-[11px] font-semibold hover:brightness-110 transition"
                      >
                        Use
                      </button>
                      <button
                        type="button"
                        onclick={dismissDetectedUrl}
                        aria-label="Dismiss"
                        class="text-text-muted hover:text-text-primary transition-colors"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          class="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  {/if}
                {/if}
                <input
                  id="onb-url"
                  type="text"
                  value={activeProfile?.remoteBaseUrl ?? 'http://127.0.0.1:18789'}
                  oninput={(e) => patchActiveProfile({ remoteBaseUrl: e.currentTarget.value })}
                  placeholder="e.g. http://127.0.0.1:18789 (via ssh -L)"
                  class="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-cyan transition-colors min-h-[44px]"
                />
                <p class="text-xs text-text-muted mt-1.5">
                  Tip: tunnel a private server over SSH first, e.g.
                  <code class="font-mono text-text-primary"
                    >ssh -L 18789:127.0.0.1:3100 user@host</code
                  >, then use
                  <code class="font-mono text-text-primary">http://127.0.0.1:18789</code>.
                </p>
              </div>

              <div>
                <label for="onb-token" class="block text-xs text-text-muted mb-1">
                  Gateway token
                </label>
                <input
                  id="onb-token"
                  type="password"
                  bind:value={tokenInput}
                  placeholder={tokenStored ? '•••• stored in macOS Keychain' : 'ironclaw-...'}
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
                onclick={skip}
                disabled={finishing}
                class="text-sm text-text-muted hover:text-text-primary transition-colors disabled:opacity-50 min-h-[44px]"
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
            <h1 class="text-2xl font-semibold text-text-primary">Let's confirm it works</h1>
            <p class="text-text-muted text-sm">
              {#if activeProfile?.mode === 'local'}
                We'll spawn the bundled sidecar and ping its health endpoint.
              {:else}
                We'll send a health check to
                <code class="font-mono text-text-primary">{activeProfile?.remoteBaseUrl ?? ''}</code
                >.
              {/if}
            </p>
          </div>

          <div class="surface p-6 flex flex-col items-center gap-4">
            <!-- Status pane -->
            <div class="w-full min-h-[120px] flex flex-col items-center justify-center text-center">
              {#if testStatus === 'idle'}
                <!-- Brief idle frame; the $effect fires runTest() on mount,
                     so this state is only visible for a single tick. The
                     spinner state below takes over within ~1 frame. -->
                <p class="text-sm text-text-muted">Preparing connection test…</p>
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
                <div class="flex flex-col items-center gap-3 w-full">
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

                  <!-- Live-chat probe banner. Renders in a small surface
                       below the gateway-OK message so the user sees BOTH
                       signals: gateway up (top), LLM round-trip (bottom).
                       The wizard's "Finish" affordance is unconditional on
                       the chat probe — a flaky LLM never blocks setup. -->
                  {#if chatStatus === 'probing'}
                    <div
                      class="w-full mt-1 px-3 py-2 rounded-md border border-border-subtle bg-bg-deep flex items-center gap-2 text-xs text-text-muted"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        class="w-3.5 h-3.5 text-accent-cyan animate-spin"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      <span class="flex-1">Testing live chat…</span>
                      <button
                        type="button"
                        onclick={skipLlmProbe}
                        class="text-text-muted hover:text-accent-cyan transition-colors underline-offset-2 hover:underline"
                      >
                        Skip
                      </button>
                    </div>
                  {:else if chatStatus === 'ok'}
                    <div
                      class="w-full mt-1 px-3 py-2 rounded-md border border-green-500/40 bg-green-500/5 text-left"
                    >
                      <div class="flex items-center gap-2 text-xs text-green-300 font-medium">
                        <svg
                          viewBox="0 0 24 24"
                          class="w-3.5 h-3.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="3"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Connected and replying</span>
                      </div>
                      {#if chatPreview}
                        <p class="text-xs text-text-muted mt-1 font-mono break-words">
                          {chatPreview}
                        </p>
                      {/if}
                    </div>
                  {:else if chatStatus === 'skipped'}
                    <div
                      class="w-full mt-1 px-3 py-2 rounded-md border border-accent-gold/30 bg-accent-gold/5 text-xs text-accent-gold flex items-center gap-2"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        class="w-3.5 h-3.5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                      <span>{chatHint ?? 'LLM check skipped'}</span>
                    </div>
                  {:else if chatStatus === 'timeout' || chatStatus === 'error'}
                    <div
                      class="w-full mt-1 px-3 py-2 rounded-md border border-border-subtle bg-bg-deep text-xs text-text-muted flex items-center gap-2"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        class="w-3.5 h-3.5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                      <span>{chatHint ?? 'Healthy (LLM not tested)'}</span>
                    </div>
                  {/if}
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
                  <p class="text-sm text-red-300 font-medium max-w-md break-words">
                    {testMessage ?? 'Connection failed'}
                  </p>
                </div>
              {/if}
            </div>

            <!-- Action row -->
            {#if testStatus === 'idle' || testStatus === 'testing'}
              <!-- No primary action while the auto-test is in flight; the
                   spinner above is the only affordance. A "Skip LLM test"
                   link is offered if the chat probe is still pending so
                   impatient users can short-circuit out. -->
              {#if chatStatus === 'probing'}
                <button
                  type="button"
                  onclick={skipLlmProbe}
                  class="text-xs text-text-muted hover:text-accent-cyan transition-colors underline-offset-2 hover:underline min-h-[32px]"
                >
                  Skip LLM test
                </button>
              {/if}
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
                {finishing ? 'Loading IronClaw…' : "You're set. Loading IronClaw…"}
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
       user is never trapped in the wizard. More visible than a bare
       muted link: pill-shaped border + hover affordance + secondary hint
       below so the user knows the wizard isn't a one-shot. -->
  <footer class="shrink-0 px-8 py-4 flex justify-end">
    <div class="flex flex-col items-end gap-1">
      <button
        type="button"
        onclick={skip}
        disabled={finishing}
        class="px-3 py-1.5 rounded-md border border-border-subtle text-xs text-text-muted hover:text-text-primary hover:border-text-muted transition-colors disabled:opacity-50 min-h-[32px]"
      >
        Skip onboarding
      </button>
      <span class="text-[10px] text-text-muted/70"> Configure later in Settings </span>
    </div>
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

  /* Tint-preview rebind. The wizard's mode-card border, Next button,
     stepper dot, and brand wordmark all use Tailwind's `accent-cyan`
     palette, which compiles to a fixed hex (#4ca7e6) from tailwind.config.js
     and therefore can't track the live `--v2-accent*` CSS variables that
     the tint picker paints. We re-bind those utilities, scoped to the
     wizard's `tint-preview` root, so the picker's live preview reaches
     every accent surface inside the flow. The `:global()` wrapper is
     required because the underlying utilities are emitted by Tailwind,
     not authored in this file — Svelte's scoped-CSS hashing would
     otherwise drop the rules as unused. */
  :global(.tint-preview .text-accent-cyan) {
    color: var(--v2-accent);
  }
  :global(.tint-preview .bg-accent-cyan) {
    background-color: var(--v2-accent);
  }
  :global(.tint-preview .border-accent-cyan) {
    border-color: var(--v2-accent);
  }
  :global(.tint-preview .hover\:border-accent-cyan:hover) {
    border-color: var(--v2-accent);
  }
  :global(.tint-preview .hover\:text-accent-cyan:hover) {
    color: var(--v2-accent);
  }
  :global(.tint-preview .focus\:border-accent-cyan:focus) {
    border-color: var(--v2-accent);
  }
  /* Alpha-modifier utilities (`bg-accent-cyan/10`, `/20`, `/5`,
     `border-accent-cyan/30`, `/40`) compile to rgb(76 167 230 / X%) in
     Tailwind v3. Override them with the soft palette slot. */
  :global(.tint-preview .bg-accent-cyan\/5),
  :global(.tint-preview .bg-accent-cyan\/10),
  :global(.tint-preview .bg-accent-cyan\/20),
  :global(.tint-preview .group-hover\:bg-accent-cyan\/20:hover),
  :global(.tint-preview .group:hover .group-hover\:bg-accent-cyan\/20) {
    background-color: var(--v2-accent-soft);
  }
  :global(.tint-preview .border-accent-cyan\/30),
  :global(.tint-preview .border-accent-cyan\/40) {
    border-color: var(--v2-accent-soft);
  }
</style>
