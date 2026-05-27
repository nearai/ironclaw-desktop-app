# Changelog

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
