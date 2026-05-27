# Changelog

## v0.1.6 (unreleased) — Rounds 7–11 (post-R6λ audit)

Builds on the v0.1.0 surfaces below. ~10 K LoC across five rounds (Round 7
through Round 11), four new top-level surfaces, two new admin tabs, one
new component library, one new utility module, and a defense-in-depth
secrets-redaction layer. All gates green: `npm run check` (0 errors),
`npm run build` (clean), `cargo check`, `cargo clippy` (no findings).

### New surfaces

- **Jobs** (`/jobs`, Round 8) — background-queue browser. List + detail
  panel with status pills, retry, and 15s poll cadence (faster than
  missions because jobs churn). Backed by `/api/jobs` (Round 7 smoke-test
  catch — endpoint exists but was unwired). Two files (`+page.svelte`
  643 LoC, `JobDetailPanel.svelte` 544 LoC).
- **Missions** (`/missions`, Cmd+9, Round 10) — Engine v2 three-pane
  (projects rail / missions list / mission detail drawer). Status badges
  (active=cyan, paused=gold, completed=green, failed=red), 30s poll.
  Gated by `settings.engineV2Enabled` toggle; surface auto-redirects out
  when the toggle flips off mid-session.
- **Engine thread detail** (Round 11) — full-viewport overlay above
  `MissionDetail`. Two-column body (transcript + timeline), live 2s poll
  of `/api/engine/threads/{id}/events`, tagged-union rendering for
  `MessageAdded` / `StateChanged` / `StepCompleted` / `ActionExecuted`,
  per-message `MarkdownView`, token + cost breakdown per step, auto-stop
  poll on `Done`/`Failed` terminal states. Largest single file in the
  app at 823 LoC.
- **Admin → Usage** tab (Round 9) — cards strip (users / jobs / 30d LLM
  calls / 30d cost), per-user/per-model table with hour/day/week/month/
  year buckets, uptime formatted "3d 22h"-style. Backed by
  `/api/admin/usage/summary` + `/api/admin/usage?period=`.

### Surface upgrades

- **Settings → LLM Provider Switcher** (Round 9) — replaces the binary
  NEAR.AI / OpenRouter radio with a dropdown over the gateway catalog
  (~26 entries). Per-credential-kind UI: api_key / open_ai_compatible →
  password input, session_token / o_auth_device_code → "Sign in" button,
  file_based_credentials → path input, aws_credentials → 3-field set,
  ollama → no input. Test Connection + List Models buttons.
  Per-profile per-provider Keychain accounts under
  `llm-<provider_id>:<profile>` (legacy `openrouter-key:<profile>`
  preserved). 684 LoC.
- **Settings → API tokens** (Round 10) — list active + revoked tokens
  with masked preview prefix. Two-step create modal: name + scope chips
  → success page with raw token in big mono + Copy + red "Save this now"
  warning. Dedicated revoke confirm modal. Revoked tokens stay
  strikethrough in-list.
- **Settings → Notifications sounds** (Round 11) — 8 macOS system
  sounds (Tink/Frog/Glass/Pop/Submarine/Sosumi/default/none) per
  category (chat / routine / sidecar / error). Quiet-hours window with
  overnight-wrap support (start>end treated as crossing midnight); banner
  still shows during quiet hours, sound forced silent. Per-row Preview
  button.
- **Admin → Tool Policy v2** (Round 9) — 3-state per-tool model
  (Ask each time / Always allow / Disabled) via `/api/settings/tools`,
  replacing v1's binary `disabled_tools` list. Locked tools show a lock
  icon + reason tooltip; bulk Allow/Deny/Reset skip locked rows with a
  follow-up toast naming the skipped count.
- **Extensions → OAuth device-flow** (Round 10) — `SetupDrawer` detects
  `field.type === 'oauth'`. On click: start → display verification_uri +
  big user_code + countdown → poll every `interval` seconds → success or
  retry on denied/expired. 3 consecutive network errors trip into
  `failed`. Esc cancels the flow first, then closes the drawer.
- **Chat → File attachments** (Round 11) — paste-image / drag-drop /
  file picker. 5 attachments per send, 5 MB per file, image-only MIME
  allowlist (PNG/JPEG/GIF/WebP). Optimistic blob-URL thumbnails;
  server-confirmed reconcile strips the appended `<attachments>` block
  from the user bubble. Force legacy `/api/chat/send` when attachments
  present (Responses API silently drops them).
- **Chat → Responses API streaming** (Round 7d) — added `streamResponse()`
  using `/api/v1/responses` with proper delta events. Capability-detected
  per-client; soft-falls-back to the legacy chat path on 404/405. Per-user
  opt-out via Settings → Advanced.
- **About dialog** (Round 7b) — modal showing app + gateway + profile
  + sidecar + system info. Mounted in layout, triggered from Cmd
  palette + Settings → About card link.
- **Sidebar v2** (Round 7c) — 224→56 px collapse with hover-tooltips on
  icons; per-nav badge counts (threads / skills / routines / extensions
  / jobs / missions) bound to live store data; gold dot on Settings when
  updater errors.

### Defense-in-depth (Round 7f, 8, 10)

- **`MaskedValue` component** (`src/lib/components/MaskedValue.svelte`, 94
  LoC) + **`redact` utility** (`src/lib/utils/redact.ts`, 157 LoC). Module
  exports `containsSecret`, `redactSecrets`, `redactJsonObject`. Patterns
  matched: `Bearer \S+`, `sk-[a-zA-Z0-9_-]+`, common API-key prefixes.
- **`IronClawClient.getSettings()`** now redacts by default. Edit-site
  call sites use `getSettingsRaw()` (Settings → Server-side card, Admin →
  System Prompt) and render each primitive through `MaskedValue` with a
  per-row "View raw" toggle. New consumers that don't know about
  `MaskedValue` get safe-by-default.
- **`getSystemPrompt()` / `getSystemPromptRaw()`** — same pattern,
  Admin System Prompt editor uses the Raw variant for round-trip edit
  fidelity.

### Round 7 critical bug fixes (live smoke test against IronClaw v0.28.2)

Five+ wire-shape mismatches that meant chat was silently broken on the
legacy path. All resolved before Round 8 work began:

- `getHistory` — server returns `{turns:[{turn_number, user_message_id,
  user_input, response, ...}]}`, not `{messages:[]}`. Client now expands
  each turn into user + assistant `Message` rows.
- `streamEvents` — server emits `event: response` with `type:"response"`,
  not `"text_response"`. Bound the right events in `normalizeEvent`;
  `text_response` kept as a legacy alias.
- `listThreads` — server uses `turn_count`, not `message_count`. Now
  reads both with fallback, surfaces as `message_count` on `Thread`.
- `extensionTools` — server returns `[{name, description}]` with NO
  extension field. Filter dropped — now returns all tools.
- `gatewayStatus` — server uses `uptime_secs`, not `uptime_seconds`.
  Type extended with `llm_backend`, `daily_cost`, `actions_this_hour`,
  `restart_enabled`, `model_usage`.
- `getSettings` — server returns `{settings: [{key, value, updated_at}]}`
  array, not a map. Now folds via `Object.fromEntries`.

### Design system (Round 11 IronClaw v2 harvest)

- Adopted **signal blue `#4ca7e6`** as the primary accent (matches the
  reborn-integration web UI). Strategy: repointed Tailwind's
  `accent.cyan` token at the new value so ~110 existing consumers pick
  it up automatically. Direct hex swaps in 4 files where `#00d4ff` was
  hardcoded (MarkdownView code blocks, Sidebar logo border, ChatSearch
  active-match highlight, chat empty-state inline style).
- New `--v2-*` CSS variables in `src/app.css` (dark-only canvas / surface
  / text / accent / semantic tokens).
- **`<Icon name="…" />` component** (`src/lib/components/Icon.svelte`,
  163 LoC) with 31 icons ported from upstream `icons.js` (attach / bolt
  / check / chat / chevron / close / clock / copy / download / file /
  flag / folder / info / layers / list / lock / logout / moon / plug /
  plus / pulse / search / send / settings / shield / spark / sun / tool
  / trash / upload / warning / x). 24×24 viewBox, `currentColor` stroke.
  Note: **not yet imported anywhere** — adopt incrementally.
- Tailwind extended with `positive` / `positive-soft` / `warning-v2` /
  `danger` / `danger-soft` semantic colour tokens.

### API client surface (Rounds 7–11)

New methods added to `IronClawClient` (`src/lib/api/ironclaw.ts`):

- `streamResponse` (R7d)
- `getUsageSummary`, `getUsageEvents` (R9, period-bucket aware)
- `listLlmProviders`, `testLlmConnection`, `listLlmModels` (R9)
- `listToolPermissions`, `setToolPermission` (R9, v2 model)
- `getSettingsRaw`, `getSystemPromptRaw` (R10 redact split)
- `listMissions`, `getMission`, `listProjects`, `getProject`,
  `listEngineThreads` (R10)
- `startExtensionLogin`, `pollExtensionLogin` (R10 OAuth device)
- `listUserTokens`, `createUserToken`, `revokeUserToken` (R10)
- `getEngineThread` (404→null), `getEngineThreadSteps`
  (forward-compat empty `[]`), `listEngineThreadEvents` (R11)
- `sendMessage(threadId, content, attachments?)` — extended signature
  (R11).

Plus ~18 new TypeScript types: `UsageSummary`, `UsageEvent`,
`LlmProvider`, `LlmModel`, `ToolPermission`, `ToolPermissionEntry`,
`BackendConfig` (Rust), `EngineMission`, `EngineProject`, `EngineThread`,
`DeviceLoginStart`, `DeviceLoginPoll`, `UserToken`, `EngineThreadMessage`,
`EngineThreadDetail`, `EngineThreadStep`, `EngineThreadEvent` (tagged
union), `AttachmentInput`, `Job`, `JobSummary`.

### Sidecar (Rust, Round 9)

- `sidecar.rs` — env wiring for NEAR.AI / OpenRouter / OpenAI /
  Anthropic provider IDs in v1; remaining 20+ providers tracked as TODOs
  inside the module.
- `keychain.rs` — per-profile per-provider accounts
  (`llm-<provider_id>:<profile-id>`) added alongside the legacy
  `openrouter-key:<profile-id>` slot.

### Bundle profile (post-R11)

Top client chunks (gzip in parens):

| Chunk                  | Size       | Gzip      |
|------------------------|------------|-----------|
| `chunks/DfDYC6eE.js`   | 143.60 kB  | 46.88 kB  | ← shared kernel
| `nodes/11.…` (jobs)    |  81.14 kB  | 21.37 kB  |
| `nodes/0.…` (chat)     |  67.23 kB  | 20.10 kB  |
| `chunks/DwQK25nF.js`   |  62.28 kB  | 18.18 kB  | ← markdown pipeline
| `nodes/3.…` (settings) |  46.11 kB  | 13.41 kB  |

`highlight.js` remains at the trimmed 12-language pack from R6
(~140 KB raw, dominant chunk previously 1017 KB before code-split).
Sidecar binaries unchanged at 303 MB total (95 MB aarch64 + 104 MB
x86_64 + sandbox daemons; both gitignored, fetched via `binaries/
download.sh`).

### Audit fixes in this release (R6λ → R11 audit pass)

- Added `aria-label="Attach images"` to the visually-hidden file input
  in `src/routes/+page.svelte:1729`. The input is button-driven (the
  composer `+` button proxies the click) but screen readers can still
  reach it; previously it had no name.
- Added `id="notifications"` + `scroll-mt-6` to the Notifications
  surface card in `src/routes/settings/+page.svelte:1975`. The Command
  Palette's `Open settings → Notifications` action now scrolls to the
  card on land instead of dumping at the top of the page.
- Removed the now-stale `TODO(settings-anchors)` block at
  `src/lib/components/CommandPalette.svelte:1028` and rewrote the
  inline comment at the action site (~605) to describe the wiring
  instead of the missing anchor.
- Dropped the brittle `:~290` line reference from
  `src/lib/components/Sidebar.svelte:382` (file has grown well past
  that line; the TODO text alone is self-documenting).

No production behaviour changes. No new dependencies. Zero changes to
route logic, business code, or stores.

## v0.1.0 (unreleased) — initial private push

55 frontend files (Svelte 5 + TypeScript), six Rust modules, 1,160 LoC Rust.
Target: macOS 12+. Built clean against `npm run check`, `npm run build`,
`cargo check`. Pushed to https://github.com/abbyshekit/ironclaw-desktop (private).

### Surfaces

- **Chat** (`/`) — SSE streaming against `/api/chat/stream`, markdown via
  `marked` + DOMPurify, per-message code-block copy buttons, scroll-to-bottom
  FAB with 100px threshold, lazy history paging at 200px from top, draft
  persistence per-thread in sessionStorage, retry-on-failure with optimistic
  bubble removal, collapsible tool-inspector right rail, find-in-thread
  (Cmd/Ctrl+F), slash-command autocomplete (`/skill-name`) backed by the
  skill catalog, native-notification on reply when window unfocused.
- **Knowledge** (`/knowledge`) — tree rail with bookmarks + recents, FTS
  search via `/api/memory/search` (debounced), doc viewer with inline edit
  mode (POST `/api/memory/write`), new-doc modal, context-menu actions
  (bookmark toggle, copy path), per-doc localStorage history.
- **Skills** (`/skills`) — filtered card grid + detail drawer, trust badge,
  source provenance, usage-hint display, unverified-skill warning, view-mode
  toggle (grid/list), recents tracking, "run in chat" shortcut prefilling
  the composer.
- **Routines** (`/routines`) — stat strip + table + detail drawer, optimistic
  toggle, run-history with per-run output expansion, debounced search,
  category filter, last-run sparkline column (stub — see TODO at sparkline).
- **Logs** (`/logs`) — virtualized live tail of `/api/logs/events` SSE
  (handles 5K+ entries), level filter, debounced grep + search-history
  dropdown, pause/resume, auto-scroll lock when user scrolls up, prefs
  persisted to localStorage.
- **Extensions** (`/extensions`) — installed + registry tabs, install /
  activate / remove via `/api/extensions/*`, dynamic setup-schema drawer
  (text + password + OAuth-launch fields), debounced registry search, sort
  by name/category/installed-at, 30s background refresh.
- **Settings** (`/settings`) — per-profile gateway configs (remote URL +
  token, OR local sidecar w/ optional OpenRouter key), Cmd+1..6 surface
  shortcuts, mode toggle (remote/local), connection test, sidecar lifecycle
  buttons, notification toggles, bulk thread export (markdown + JSON),
  updater check, "re-run onboarding," "reveal data dir in Finder," sign-in
  status with NEAR.AI Cloud profile probe.
- **Admin** (`/admin`, Cmd+7) — gated behind `settings.adminMode`. Two tabs:
  - **Tool Policy** — 3-way per-tool selector (Allow / Prompt / Deny), bulk
    Allow / Deny / Reset, filter pills + search, dirty-tracked save. Server
    stores a `disabled_tools` list; client collapses `deny` into the list on
    save and treats absence as `prompt` on load.
  - **System Prompt** — 64 KB monospace editor with TextEncoder-accurate byte
    count, side-by-side MarkdownView preview, soft-warning above 63 KB,
    Restore-default with confirm.
- **Onboarding** (`/onboarding`) — three-step wizard (Welcome → Mode →
  Profile setup with connection test).

### Cross-cutting features

- **Command palette** (Cmd+K) — fuzzy match across navigation, recent
  threads, skills, routines, knowledge docs; recents persisted to
  localStorage.
- **Sidebar** — connection-status pill (idle / connecting / connected /
  disconnected), profile quick-switch, admin entry conditional on
  `adminMode`.
- **Toasts** — shared rune singleton with success/info/error tints,
  auto-dismiss with hover-pause.
- **Updater banner** — checks GitHub releases on focus, shows version +
  release notes link; pubkey-gated to refuse unsigned bundles.
- **Tray icon** — menu-bar status with connection state, listens to backend
  status events.
- **Window-focus tracking** — used to suppress notifications when the chat
  window is foregrounded.

### Core infrastructure

- **Tauri v2** (2.2) with `macos-private-api`, `tray-icon`, `image-png`
  features; plugins: `shell`, `updater`, `notification`, `dialog`.
- **SvelteKit 2** + **Svelte 5 runes** (`$state`, `$derived`, `$effect`,
  `$props`); `adapter-static` (frontendDist → `../build`).
- **Tailwind CSS 3.4** + dark-mode-only design tokens (`bg-deep`, `bg-base`,
  `bg-surface`, `border-subtle`, `accent-cyan`, `accent-gold`, `text-primary`,
  `text-muted`); 44px minimum touch targets.
- **TypeScript 5.7**, strict mode. `src/lib/api/ironclaw.ts` is the typed
  HTTP client; zero `any` usages in `src/lib/api/`.
- **Markdown pipeline** — `marked` 15 + `DOMPurify` 3.4 + `highlight.js` 11
  (all language packs, the dominant 951 KB / 311 KB-gzipped chunk).

### Backend (Rust)

- `lib.rs` — Tauri command registration + plugin init; bootstrap of tray,
  sidecar state, settings.
- `keychain.rs` — `keyring` crate (apple-native) wrappers; per-profile
  accounts: `gateway-token:<id>`, `openrouter-key:<id>`, plus global
  `local-gateway-token` with auto-UUID generation.
- `settings.rs` — JSON persistence to `app_data_dir`; survives launches.
- `sidecar.rs` — spawn/stop bundled IronClaw sidecar; auto-port-find
  3100–3200; env-driven LLM backend selection (NEAR.AI Cloud default,
  OpenRouter advanced).
- `tray.rs` — `tray-icon` integration with status events.
- `main.rs` — minimal entry; defers to `ironclaw_desktop_lib::run()`.

### Bundled sidecar binaries

- `binaries/ironclaw-aarch64-apple-darwin` (95 MB)
- `binaries/ironclaw-x86_64-apple-darwin` (104 MB)
- `binaries/sandbox_daemon-{aarch64,x86_64}-apple-darwin` (7.6 / 7.9 MB)
- Both fetched out-of-band via `binaries/download.sh`; gitignored.

### CI

- `.github/workflows/check.yml` — lint + frontend build + cargo check on PR.
- `.github/workflows/release.yml` — release pipeline (placeholder until
  signing keys are in place — see "Known limitations" below).

### Known limitations / upstream blocked

- **`POST /api/routines`** — Gateway returns 405. The "+ New routine" button +
  CreateRoutineModal are unwired. `client.createRoutine(req)` is pre-wired in
  `src/lib/api/ironclaw.ts`; see TODO at `src/routes/routines/+page.svelte:465`.
- **`DELETE /api/chat/threads/{id}`** — Gateway returns 404. Per-thread delete
  affordance is unwired. `client.deleteThread(id)` is pre-wired; see TODO at
  `src/routes/+page.svelte:305`.
- **`DELETE /api/memory` / `POST /api/memory/delete`** — Both return 404 from
  the gateway. Doc-delete handler is unwired; `client.deleteMemory(path)` is
  pre-wired (tries DELETE first, falls back to POST on 404/405). See TODO at
  `src/routes/knowledge/+page.svelte:483` and `src/routes/knowledge/DocViewer.svelte:144`.
- **`POST /api/auth/signout` / `DELETE /api/profile`** — Not exposed by the
  gateway. Sign-out flow in Settings nudges the user to the IronClaw web UI
  instead. See TODO at `src/routes/settings/+page.svelte:407`.
- **`GET /api/extensions` `installed_at`** — Sort by "recent" falls back to
  alphabetical because the gateway does not yet emit an `installed_at`
  timestamp. See TODO at `src/routes/extensions/+page.svelte:137`.
- **Last-run sparkline** — Routines table renders a placeholder; needs a
  history-aggregation endpoint. See TODO at `src/routes/routines/+page.svelte:207`.
- **Settings deep-anchors** — The Command Palette cannot deep-link into
  specific Settings panels (e.g. "/settings#notifications") because Settings
  has no anchor IDs. See TODO at `src/lib/components/CommandPalette.svelte:1011`.
- **Auto-updater signing** — `tauri.conf.json` ships with placeholder
  `plugins.updater.endpoints` and empty `pubkey`. Both must be set before
  the first signed release. See TODO at `src-tauri/src/lib.rs:275` and
  `src/lib/stores/updater.svelte.ts:19`.
- **Route-query deep-links** — `?open=<id>` (routines), `?path=<encoded>`
  (knowledge), `?prefill=…` (chat — wired) are partly used. Routines and
  knowledge sides still need to read their query param on mount. See TODOs
  in `src/lib/components/CommandPalette.svelte:684,700`.

### Audit fixes in this release

- Fixed Svelte 5 `attribute_duplicate` compile errors in
  `src/routes/admin/ToolPolicyEditor.svelte` (merged duplicate `class` and
  `class={…}` attributes on the filter pill buttons) and
  `src/routes/admin/SystemPromptEditor.svelte` (removed redundant
  `class:grid-cols-1` directives).
- Replaced Svelte-4-style `InstanceType<typeof SlashAutocomplete>` typing
  in `src/routes/+page.svelte:70` with the Svelte-5 export-object shape
  (`{ handleKey: (e) => boolean }`).
- Added `aria-label` to four high-traffic search inputs that previously
  relied on placeholder text alone (Knowledge SearchBar, Skills filter,
  Extensions search, Command Palette query).
