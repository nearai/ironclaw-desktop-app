// Test helpers for the IronClaw desktop Playwright suite.
//
// The app is a SvelteKit + Tauri client. Two boundaries need to be mocked
// to run it in a browser-only Playwright context:
//
//   1. Tauri IPC. Real handlers live in Rust; the webview talks to them via
//      `window.__TAURI_INTERNALS__.invoke('command', args)`. We inject a
//      stub object *before* page navigation so the very first `import` of
//      `@tauri-apps/api/core` sees a populated `__TAURI_INTERNALS__`. The
//      stub routes every `invoke` call through a table of canned values
//      derived from the optional `overrides` (fresh-install settings,
//      stored token, etc.).
//
//   2. IronClaw gateway. The app talks to `http://127.0.0.1:18789/api/*`
//      (or whatever the active profile's `remoteBaseUrl` resolves to) via
//      `fetch` and `EventSource`. `mockGateway` registers `page.route`
//      handlers for the endpoints the tests exercise (`/api/health`,
//      `/api/gateway/status`, `/api/profile`, `/api/chat/threads`,
//      `/api/chat/thread/new`, `/api/chat/send`, `/api/chat/events`,
//      `/api/v1/responses`). Other endpoints fall through to a default
//      404 so a missing mock surfaces loudly instead of silently hanging
//      the test.

import type { Page, Route } from '@playwright/test';

// ---- Tauri shim -----------------------------------------------------------

/** Tauri settings shape, mirrored from the real `AppSettings` so the wizard
 *  recognises it as a valid loaded payload. Only the fields the tests care
 *  about are typed here — anything else gets passed through verbatim. */
export interface TauriMockSettings {
  activeProfileId?: string;
  profiles?: Array<{
    id: string;
    name: string;
    mode: 'local' | 'remote';
    remoteBaseUrl?: string;
    localBaseUrl?: string;
    llmBackend?: 'nearai' | 'openrouter';
    llmProviderId?: string;
    tint?: string;
  }>;
  onboardingComplete?: boolean;
  adminMode?: boolean;
  trayEnabled?: boolean;
  useResponsesApi?: boolean;
  engineV2Enabled?: boolean;
}

/** Per-test overrides for the Tauri shim. Anything not specified falls back
 *  to a sensible default (empty token, fresh-install settings, etc.). */
export interface TauriMockOverrides {
  settings?: TauriMockSettings;
  /** Token returned by `get_token(profileId)`. Default: null (no token). */
  token?: string | null;
  /** Token returned by `get_or_create_local_token()`. Default: a fake UUID. */
  localToken?: string | null;
  /** Result of `get_openrouter_key`. Default: null. */
  openRouterKey?: string | null;
}

/** Default fresh-install settings — `onboardingComplete: false` so the layout
 *  redirects to /onboarding on first mount. Mirrors what the Rust
 *  `get_settings` handler returns the first time the app launches. */
const DEFAULT_FRESH_SETTINGS: TauriMockSettings = {
  activeProfileId: 'default',
  profiles: [
    {
      id: 'default',
      name: 'Default',
      mode: 'remote',
      remoteBaseUrl: 'http://127.0.0.1:18789',
      localBaseUrl: 'http://127.0.0.1:3100',
      llmBackend: 'nearai',
      llmProviderId: 'nearai'
    }
  ],
  onboardingComplete: false,
  adminMode: false,
  trayEnabled: true,
  useResponsesApi: true,
  engineV2Enabled: false
};

/**
 * Inject a `window.__TAURI_INTERNALS__` shim into the page so the SvelteKit
 * app — which probes that global to decide whether IPC is available — sees a
 * populated runtime. The shim's `invoke` routes through a small dispatch
 * table seeded from `overrides` plus persistent in-memory state for
 * `set_token` / `save_settings` etc. so a test that runs the wizard
 * end-to-end leaves the in-memory store in the same shape Rust would.
 *
 * In addition, when `overrides.settings` is set and `onboardingComplete`
 * is `true`, we pre-seed the connection store's `settings` rune via a
 * dynamic-import side effect AND a periodic guard that re-applies the
 * value if a later init pass clobbers it. This sidesteps a known race
 * in the app: Sidebar's `onMount` calls `connection.init()` and takes
 * the `initialized` flag BEFORE the layout's `onMount` fires, so the
 * layout's `init().then(...)` callback runs against `DEFAULT_SETTINGS`
 * (`onboardingComplete: false`) and unconditionally bounces to
 * `/onboarding` — even when settings.json already says we're past the
 * wizard.
 *
 * MUST be called *before* `page.goto(...)` so the script fires on
 * navigation. Uses `addInitScript`, which Playwright re-runs on every
 * navigation in the page lifetime.
 */
export async function mockTauri(
  page: Page,
  overrides: TauriMockOverrides = {}
): Promise<void> {
  const settings = overrides.settings ?? DEFAULT_FRESH_SETTINGS;
  const token = overrides.token ?? null;
  const localToken = overrides.localToken ?? 'local-token-abc123';
  const openRouterKey = overrides.openRouterKey ?? null;

  // Stringify the seed once — `addInitScript` serializes the function +
  // args into a JS literal that runs in the browser. Pass the seed through
  // a JSON object so the in-page closure can mutate it without bleeding
  // back into Node-side state.
  await page.addInitScript(
    ({
      seedSettings,
      seedToken,
      seedLocalToken,
      seedOpenRouterKey
    }: {
      seedSettings: TauriMockSettings;
      seedToken: string | null;
      seedLocalToken: string | null;
      seedOpenRouterKey: string | null;
    }) => {
      // ---- mutable in-page state ---------------------------------------
      // Cloned per page so subsequent `goto()` calls in the same test see
      // the latest writes (the wizard does several `save_settings` calls
      // before the final route change). `JSON.parse(JSON.stringify(...))`
      // is the shortest deep-clone that avoids structuredClone — which
      // some Playwright contexts disable for cross-realm safety.
      const state: {
        settings: TauriMockSettings;
        tokens: Record<string, string | null>;
        openRouterKeys: Record<string, string | null>;
        localToken: string | null;
      } = {
        settings: JSON.parse(JSON.stringify(seedSettings)) as TauriMockSettings,
        tokens: {} as Record<string, string | null>,
        openRouterKeys: {} as Record<string, string | null>,
        localToken: seedLocalToken
      };

      // Seed the first profile's token (if any). The real Keychain layer
      // does per-profile storage; we mirror that here.
      const firstProfileId = state.settings.profiles?.[0]?.id ?? 'default';
      state.tokens[firstProfileId] = seedToken;
      state.openRouterKeys[firstProfileId] = seedOpenRouterKey;

      function pick<T extends object>(obj: unknown, key: string): T[keyof T] | undefined {
        if (obj && typeof obj === 'object' && key in obj) {
          return (obj as Record<string, T[keyof T]>)[key];
        }
        return undefined;
      }

      function dispatch(command: string, args: unknown): unknown {
        switch (command) {
          // ---- Settings ----
          case 'get_settings':
            // Returning a deep clone — the real IPC layer is a separate
            // process, so app code mutating the result mustn't poison
            // our copy.
            return JSON.parse(JSON.stringify(state.settings));
          case 'save_settings': {
            const next = pick<{ settings: TauriMockSettings }>(args, 'settings');
            if (next) state.settings = JSON.parse(JSON.stringify(next)) as TauriMockSettings;
            // eslint-disable-next-line no-console
            console.log('[mockTauri] save_settings onboardingComplete=', state.settings.onboardingComplete);
            return null;
          }

          // ---- Keychain (per-profile tokens + OpenRouter keys) ----
          case 'get_token': {
            const profileId = pick<{ profileId: string }>(args, 'profileId') ?? firstProfileId;
            return state.tokens[profileId] ?? null;
          }
          case 'set_token': {
            const profileId = pick<{ profileId: string }>(args, 'profileId') ?? firstProfileId;
            const t = pick<{ token: string }>(args, 'token') ?? null;
            state.tokens[profileId] = t as string | null;
            return null;
          }
          case 'delete_token': {
            const profileId = pick<{ profileId: string }>(args, 'profileId') ?? firstProfileId;
            delete state.tokens[profileId];
            return null;
          }
          case 'get_openrouter_key': {
            const profileId = pick<{ profileId: string }>(args, 'profileId') ?? firstProfileId;
            return state.openRouterKeys[profileId] ?? null;
          }
          case 'set_openrouter_key': {
            const profileId = pick<{ profileId: string }>(args, 'profileId') ?? firstProfileId;
            const k = pick<{ key: string }>(args, 'key') ?? null;
            state.openRouterKeys[profileId] = k as string | null;
            return null;
          }
          case 'delete_openrouter_key': {
            const profileId = pick<{ profileId: string }>(args, 'profileId') ?? firstProfileId;
            delete state.openRouterKeys[profileId];
            return null;
          }

          // ---- Sidecar lifecycle (no-op in remote-mode tests) ----
          case 'get_or_create_local_token':
            return state.localToken ?? 'local-token-fallback';
          case 'local_data_dir':
            return '/tmp/ironclaw-test';
          case 'start_sidecar':
            // 4444 is arbitrary — tests run in remote mode, so this path
            // is never exercised. If a future test exercises local mode,
            // the mock should be expanded.
            return 4444;
          case 'stop_sidecar':
            return null;
          case 'sidecar_status':
            return { status: 'idle', port: null, error: null };

          // ---- Tray / window ----
          case 'update_tray_status':
          case 'update_tray_badge':
          case 'update_tray_recent':
          case 'set_tray_visible':
          case 'open_profile_window':
            return null;

          // ---- LLM provider credentials (Settings only) ----
          case 'get_llm_provider_credential':
            return null;
          case 'set_llm_provider_credential':
          case 'delete_llm_provider_credential':
            return null;

          // ---- File reveal (Settings only) ----
          case 'reveal_in_finder':
            return null;

          // ---- Tauri plugin internals ----
          // Tauri's event plugin uses `plugin:event|listen` to register
          // listeners. We return a fake numeric handle (the real Tauri
          // returns the listener id) so callers can `await listen(...)`
          // without throwing. The unlisten function is never called
          // during these tests but if it were, `plugin:event|unlisten`
          // would also no-op.
          case 'plugin:event|listen':
            return 0;
          case 'plugin:event|unlisten':
          case 'plugin:event|emit':
            return null;

          // The updater plugin checks for updates on launch. Returning
          // null tells the JS client "no update available" — matches the
          // Tauri 2 updater API shape.
          case 'plugin:updater|check':
            return null;

          // The notification plugin's permission probe + send paths.
          // Tests don't care about real notifications; tell the app it
          // has permission so it doesn't show the request UI.
          case 'plugin:notification|is_permission_granted':
            return true;
          case 'plugin:notification|request_permission':
            return 'granted';
          case 'plugin:notification|notify':
            return null;

          // The shell plugin's `open` is used by "open in browser" links.
          case 'plugin:shell|open':
            return null;

          // App version / window / metadata plugins. The AboutDialog and
          // a few other surfaces probe these; returning a sane stub keeps
          // them from logging warnings into the console.
          case 'plugin:app|version':
            return '0.0.0-e2e';
          case 'plugin:app|name':
            return 'ironclaw-e2e';

          default:
            // Surface unknown commands loudly during dev, then throw to
            // match real-IPC behaviour for missing handlers (which
            // throws — we mirror that to catch test drift). Tauri's
            // plugin namespace is `plugin:<name>|<method>`. Anything
            // unhandled there is also let through as a warning + throw
            // so the test sees it.
            // eslint-disable-next-line no-console
            console.warn('[mockTauri] unhandled invoke:', command, args);
            throw new Error(`mockTauri: no handler for "${command}"`);
        }
      }

      // The Tauri 2 internals object exposes `invoke` (sync entrypoint
      // returning a Promise) plus a `transformCallback` helper used by
      // some plugins. We only need `invoke` for now.
      // The `metadata` field carries `__currentWindow.label` — `messages`
      // store reads it via the app plugin, which we stub separately.
      // Mark this as the Tauri shim so the JS-side `inTauri()` check
      // (which looks for `__TAURI_INTERNALS__` on window) flips to true.
      (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
        // Tauri 2: invoke takes (cmd, args, options?) and returns
        // Promise<unknown>. Wrap dispatch in a microtask so the call
        // shape matches the real IPC (which is always async).
        invoke: (cmd: string, args: unknown) =>
          new Promise((resolve, reject) => {
            try {
              resolve(dispatch(cmd, args));
            } catch (err) {
              reject(err);
            }
          }),
        // Some plugins call `transformCallback(handler)` to register an
        // event-bus listener. We don't fire events in the test, but the
        // function must exist so plugin init paths don't throw.
        transformCallback: () => 0,
        metadata: { currentWindow: { label: 'main' }, windows: [] }
      };
    },
    {
      seedSettings: settings,
      seedToken: token,
      seedLocalToken: localToken,
      seedOpenRouterKey: openRouterKey
    }
  );

  // ---- Pre-seed the connection store ---------------------------------
  // When the seeded settings carry `onboardingComplete: true`, eagerly
  // import the connection store as soon as the document is ready and
  // overwrite its `settings` rune + flip its `initialized` flag. This
  // beats the Sidebar→Layout race (see jsdoc above): the layout's
  // first `init().then(...)` callback then reads the pre-seeded
  // settings instead of `DEFAULT_SETTINGS`, so no spurious redirect.
  //
  // Skipped when `onboardingComplete` isn't true — the onboarding test
  // RELIES on the wizard redirect, and pre-seeding would prevent it.
  if (settings.onboardingComplete === true) {
    await page.addInitScript(
      ({ seedSettings, seedToken }: { seedSettings: TauriMockSettings; seedToken: string | null }) => {
        // Run after the document is parsed but before the layout's
        // onMount fires. SvelteKit boots from `<script type="module">`,
        // which runs after DOMContentLoaded, but our pre-seed needs to
        // race ahead. Schedule the seed on the same microtask boundary
        // by attaching a `readystatechange` listener.
        const seed = async (): Promise<void> => {
          try {
            // The connection store lives at this path in the Vite dev
            // server's module graph. `?import` query ensures Vite returns
            // the JS module rather than a static asset.
            const url = new URL('/src/lib/stores/connection.svelte.ts', location.origin).href;
            const mod = (await import(/* @vite-ignore */ url)) as {
              connection: {
                settings: TauriMockSettings;
                token: string | null;
                initialized?: boolean;
              };
            };
            // Direct assignment to the $state-backed property. Svelte 5's
            // rune captures this as a single-step replace; the layout's
            // subsequent read of `connection.settings.onboardingComplete`
            // sees the seeded value.
            mod.connection.settings = JSON.parse(JSON.stringify(seedSettings)) as TauriMockSettings;
            if (seedToken !== null) {
              mod.connection.token = seedToken;
            }
            // Mark initialized so subsequent `init()` calls return
            // immediately without re-doing the load (which would
            // briefly observe `DEFAULT_SETTINGS` again, re-introducing
            // the race).
            if ('initialized' in mod.connection) {
              mod.connection.initialized = true;
            } else {
              // Access the private slot directly when not exported. The
              // class declares `private initialized = false;` but
              // TypeScript private is JS-visible.
              (mod.connection as unknown as { initialized: boolean }).initialized = true;
            }
          } catch (err) {
            // Pre-seed is best-effort — if the import path changes or
            // the module hasn't compiled yet, the test will still work
            // (it just falls back to the redirect-and-recover dance).
            // eslint-disable-next-line no-console
            console.warn('[mockTauri] pre-seed failed:', err);
          }
        };
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => void seed(), { once: true });
        } else {
          void seed();
        }
      },
      { seedSettings: settings, seedToken: token }
    );
  }
}

// ---- Gateway mock ---------------------------------------------------------

/** Per-test overrides for the gateway-route mock. */
export interface GatewayMockOverrides {
  /** Base URL the app is configured to talk to. Defaults to the SSH-tunnel
   *  convention used by the fresh-install settings (`18789`). The mock
   *  globs both `http://127.0.0.1:<port>/api/*` and `http://localhost/*`
   *  shapes so a settings.json with either host works. */
  baseUrl?: string;
  /** Gateway version string returned by /api/gateway/status. */
  version?: string;
  /** LLM backend tag returned by /api/gateway/status. */
  llmBackend?: 'nearai' | 'openrouter' | string;
  /** Threads returned by /api/chat/threads. Default: empty. */
  threads?: Array<{
    id: string;
    title?: string;
    created_at: string;
    last_message_at?: string;
    turn_count?: number;
  }>;
  /** Reply text the mocked stream emits. Default: "Mocked reply". */
  mockedReply?: string;
  /** Whether to expose `/api/v1/responses` as an available route.
   *  Default: false — keeps the test deterministic on the legacy
   *  `/api/chat/send` + `/api/chat/events` path, which is the path the
   *  prompt's `chat.spec.ts` exercises. */
  exposeResponsesApi?: boolean;
  /** User profile shape returned by /api/profile. Default: a signed-in
   *  NEAR account so the wizard's chat-probe pre-flight passes. */
  profile?: {
    id?: string;
    display_name?: string;
    role?: string;
    email?: string | null;
    avatar_url?: string | null;
    near_account?: string;
  } | null;
}

/**
 * Register `page.route` handlers for the IronClaw gateway. Matches both
 * `http://127.0.0.1:<port>/api/*` (the default remote URL) and any URL
 * with `/api/...` path so a test that overrides the base URL doesn't have
 * to re-register the routes.
 *
 * Returns a `Promise<void>` — Playwright route handlers are registered
 * synchronously but `page.route` itself is async.
 */
export async function mockGateway(
  page: Page,
  overrides: GatewayMockOverrides = {}
): Promise<void> {
  const version = overrides.version ?? '0.29.4';
  const llmBackend = overrides.llmBackend ?? 'nearai';
  const threads = overrides.threads ?? [];
  const mockedReply = overrides.mockedReply ?? 'Mocked reply';
  const exposeResponsesApi = overrides.exposeResponsesApi === true;
  const profile =
    overrides.profile === undefined
      ? {
          id: 'default',
          display_name: 'Test User',
          role: 'owner',
          email: null,
          avatar_url: null,
          near_account: 'test.near'
        }
      : overrides.profile;

  // In-memory thread store the mock mutates as the chat surface creates
  // new threads / posts messages. Lives on the page-fixture lifetime via
  // closure capture; each `mockGateway` call snapshots the seed list.
  // Cloning so test mutations don't bleed back into the seed array.
  const liveThreads = threads.map((t) => ({ ...t }));
  let lastThreadId = 0;
  function nextThreadId(): string {
    lastThreadId += 1;
    return `mock-thread-${lastThreadId}`;
  }

  // Per-thread history. The chat surface's post-stream reconcile
  // (`messages.loadHistory(threadId)`) replaces the local byThread
  // entry with whatever the server returns, so if `/api/chat/history`
  // returns empty turns we wipe the optimistic user bubble + the
  // streamed assistant reply. We side-step that by remembering each
  // turn the chat surface POSTs to `/api/chat/send` and serving the
  // pair back on the next history fetch.
  const turnsByThread = new Map<
    string,
    Array<{ turn_number: number; user_input: string; response: string }>
  >();

  // Host prefix: ALL gateway routes are anchored to `127.0.0.1|localhost`
  // on the known IronClaw ports. Without this anchor a regex like
  // `/\/api\/health/` would also match Vite dev-server module requests
  // such as `/src/lib/api/health.ts` (which contains "/api/health" as a
  // substring) and break the page bootstrap. The ports below mirror the
  // onboarding wizard's auto-detect list plus the fresh-install default
  // (18789) and the mock sidecar port (4444).
  const GATEWAY_HOSTS = '(?:127\\.0\\.0\\.1|localhost):(?:3100|3334|3000|8080|18789|22821|4444)';

  // --- catch-all ---------------------------------------------------------
  // Registered FIRST because Playwright dispatches `page.route` handlers
  // in REVERSE registration order — the most recently added handler wins
  // for a matching request. We want the specific routes below to win, so
  // they come after. The catch-all 404s any unmatched gateway-host /api/
  // call so a missing mock surfaces as a clear failure (rather than the
  // request hanging until the connection store's timeout fires).
  await page.route(
    new RegExp(`^https?://${GATEWAY_HOSTS}/api/`),
    async (route: Route) => {
      // eslint-disable-next-line no-console
      console.warn(
        '[mockGateway] unmatched API call:',
        route.request().method(),
        route.request().url()
      );
      await route.fulfill({ status: 404, body: 'Not Found' });
    }
  );

  // --- /api/health -------------------------------------------------------
  await page.route(
    new RegExp(`^https?://${GATEWAY_HOSTS}/api/health(?:\\?.*)?$`),
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', channel: 'http' })
      });
    }
  );

  // --- /api/gateway/status ----------------------------------------------
  await page.route(
    new RegExp(`^https?://${GATEWAY_HOSTS}/api/gateway/status(?:\\?.*)?$`),
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version,
          engine_v2_enabled: false,
          llm_model: 'mock-model',
          llm_backend: llmBackend,
          enabled_channels: ['web'],
          ws_connections: 0,
          sse_connections: 0,
          total_connections: 0,
          uptime_secs: 60,
          daily_cost: '0.00',
          actions_this_hour: 0,
          restart_enabled: false,
          model_usage: []
        })
      });
    }
  );

  // --- /api/profile ------------------------------------------------------
  await page.route(
    new RegExp(`^https?://${GATEWAY_HOSTS}/api/profile(?:\\?.*)?$`),
    async (route: Route) => {
      if (profile === null) {
        await route.fulfill({ status: 401, body: '{}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile)
      });
    }
  );

  // --- /api/chat/threads (GET) ------------------------------------------
  await page.route(
    new RegExp(`^https?://${GATEWAY_HOSTS}/api/chat/threads(?:\\?.*)?$`),
    async (route: Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ threads: liveThreads, assistant_thread: null })
        });
        return;
      }
      await route.fulfill({ status: 404, body: '{}' });
    }
  );

  // --- /api/chat/thread/new (POST) --------------------------------------
  await page.route(
    new RegExp(`^https?://${GATEWAY_HOSTS}/api/chat/thread/new$`),
    async (route: Route) => {
      const id = nextThreadId();
      const now = new Date().toISOString();
      let title = 'Untitled';
      try {
        const body = route.request().postDataJSON() as { title?: string } | null;
        if (body && typeof body.title === 'string' && body.title.length > 0) {
          title = body.title;
        }
      } catch {
        // ignore — empty/non-JSON bodies are allowed
      }
      liveThreads.unshift({
        id,
        title,
        created_at: now,
        last_message_at: now,
        turn_count: 0
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ thread_id: id })
      });
    }
  );

  // --- /api/chat/send (POST, legacy path) -------------------------------
  // Returns `{message_id, thread_id}` and triggers the SSE stream below
  // by simply existing — the chat surface opens the EventSource after
  // a successful send, and our route handler for /api/chat/events emits
  // the canned reply. We also stash the (user_input, response) pair in
  // `turnsByThread` so the eventual `/api/chat/history` fetch returns
  // a server-confirmed view of the conversation and the chat surface's
  // post-stream reconcile doesn't wipe the optimistic bubble.
  await page.route(
    new RegExp(`^https?://${GATEWAY_HOSTS}/api/chat/send$`),
    async (route: Route) => {
      let threadId = '';
      let content = '';
      try {
        const body = route.request().postDataJSON() as {
          thread_id?: string;
          content?: string;
        } | null;
        threadId = body?.thread_id ?? '';
        content = body?.content ?? '';
      } catch {
        // ignore
      }
      if (threadId) {
        const existing = turnsByThread.get(threadId) ?? [];
        existing.push({
          turn_number: existing.length + 1,
          user_input: content,
          response: mockedReply
        });
        turnsByThread.set(threadId, existing);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message_id: `mock-msg-${Date.now()}`,
          thread_id: threadId,
          status: 'queued'
        })
      });
    }
  );

  // --- /api/chat/events (SSE) -------------------------------------------
  // EventSource expects `text/event-stream` with `data:` lines. We emit
  // a single `response` event carrying the mocked reply, then a
  // `message_end` so the iterator in `streamEvents` exits cleanly.
  //
  // Wire shape (matches `normalizeEvent` in src/lib/api/ironclaw.ts and
  // verified against IronClaw 0.29.4): the gateway emits the full
  // assistant content per event with `{type: "response", content: "..."}`.
  // The client's normalizer rewrites that into a `content_delta` for the
  // messages store.
  await page.route(
    new RegExp(`^https?://${GATEWAY_HOSTS}/api/chat/events(?:\\?.*)?$`),
    async (route: Route) => {
      const frames: string[] = [
        `event: response\ndata: ${JSON.stringify({
          type: 'response',
          content: mockedReply
        })}\n\n`,
        `event: message\ndata: ${JSON.stringify({
          type: 'message_end',
          finish_reason: 'stop'
        })}\n\n`
      ];
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        },
        body: frames.join('')
      });
    }
  );

  // --- /api/v1/responses ------------------------------------------------
  // Capabilities probe (GET) and POST streaming. The chat surface probes
  // GET first to decide whether to use this transport. We return 404 by
  // default so tests stay on the deterministic legacy path; flip
  // `exposeResponsesApi: true` to exercise the modern path.
  await page.route(
    new RegExp(`^https?://${GATEWAY_HOSTS}/api/v1/responses$`),
    async (route: Route) => {
      const method = route.request().method();
      if (method === 'GET') {
        if (!exposeResponsesApi) {
          await route.fulfill({ status: 404, body: 'Not Found' });
          return;
        }
        // 405 = exists but doesn't accept GET → confirms POST streaming.
        await route.fulfill({ status: 405, body: 'Method Not Allowed' });
        return;
      }
      if (method === 'POST') {
        if (!exposeResponsesApi) {
          await route.fulfill({ status: 404, body: 'Not Found' });
          return;
        }
        // Emit a single output_text.delta + a completed event.
        const frames: string[] = [
          `event: response.output_text.delta\ndata: ${JSON.stringify({
            type: 'response.output_text.delta',
            delta: mockedReply
          })}\n\n`,
          `event: response.completed\ndata: ${JSON.stringify({
            type: 'response.completed'
          })}\n\n`
        ];
        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache'
          },
          body: frames.join('')
        });
        return;
      }
      await route.fulfill({ status: 405, body: 'Method Not Allowed' });
    }
  );

  // --- /api/chat/history -------------------------------------------------
  // Returns the (user, assistant) turns we recorded from earlier
  // `/api/chat/send` calls so the chat surface's post-stream reconcile
  // (which replaces local optimistic state with the server-confirmed
  // history) doesn't wipe the test's expected bubbles.
  await page.route(
    new RegExp(`^https?://${GATEWAY_HOSTS}/api/chat/history(?:\\?.*)?$`),
    async (route: Route) => {
      const url = new URL(route.request().url());
      const threadId = url.searchParams.get('thread_id') ?? '';
      const turns = turnsByThread.get(threadId) ?? [];
      const now = new Date().toISOString();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          thread_id: threadId,
          turns: turns.map((t) => ({
            turn_number: t.turn_number,
            user_message_id: `mock-user-${threadId}-${t.turn_number}`,
            user_input: t.user_input,
            response: t.response,
            response_id: `mock-resp-${threadId}-${t.turn_number}`,
            started_at: now,
            completed_at: now
          })),
          has_more: false,
          oldest_timestamp: turns.length > 0 ? now : null
        })
      });
    }
  );

  // The catch-all 404 lives at the top of this function (registered
  // FIRST so the specific routes above shadow it — Playwright dispatches
  // route handlers in reverse-registration order). No further routes
  // beyond this comment.
}
