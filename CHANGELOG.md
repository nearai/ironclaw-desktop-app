# Changelog

## v0.4.13 — Stale-stream regression test (2026-05-28)

- **Test coverage**: a deterministic regression test for the R106 P1 fix —
  once a Chief-of-Staff brief run is aborted (panel closed, or a newer run
  starts), a stale stream must stop writing rather than clobber the panel.
  Uses a gated async generator so the abort lands mid-stream deterministically.
  +1 test; locks in the in-flight abort guard shared by Brief/Triage/Draft.

## v0.4.12 — Polling unified (2026-05-28)

- **Simplification (audit R200 P1, complete)**: migrated the last poll
  surface — EngineThreadDetail — onto `createPollingRefresh`. Its
  restart-on-liveness `$effect` now toggles the shared handle's idempotent
  `start()`/`stop()` instead of hand-managing a `setInterval`. All five poll
  loops (jobs, routines, missions, admin, engine-detail) are now unified with
  consistent in-flight suppression.

## v0.4.11 — Polling migration cont'd (2026-05-28)

- **Simplification (audit R200 P1)**: migrated the Missions and Admin
  Usage-dashboard poll loops onto the shared `createPollingRefresh` helper
  (v0.4.10), inheriting its in-flight suppression. Four of five poll surfaces
  are now unified (jobs, routines, missions, admin); EngineThreadDetail has
  restart-on-thread-change semantics and gets its own careful pass.

## v0.4.10 — Shared polling helper (2026-05-28)

- **Simplification + robustness (audit R200 P1)**: extracted the repeated
  `setInterval`/`clearInterval` poll lifecycle into a tested
  `src/lib/util/polling.ts` (`createPollingRefresh`) and migrated the Jobs +
  Routines surfaces onto it. The helper adds **in-flight suppression** — if a
  refresh is still pending when the next tick fires, the tick is skipped
  instead of stacking overlapping requests on a slow gateway. +5 unit tests.
  (Missions / engine-detail / admin-usage migrate in later passes.)

## v0.4.9 — ExtensionCard coverage (2026-05-28)

- **Test coverage**: added render tests for `ExtensionCard` covering the
  v0.4.5 "Set up" affordance — the prominent CTA + category hint for an
  unconfigured connector (channel → token, oauth → sign-in), the icon gear
  when ready, and the registry Install button. +4 tests; locks in the
  Slack-style "Needs setup → one click" UX.

## v0.4.8 — Shared widget payload helper (2026-05-28)

- **Simplification (audit R200 P1)**: TableWidget and ComparisonWidget had
  identical `cellText` + payload-normalization copy-pasted. Extracted to a
  tested `src/lib/util/table-payload.ts` (`cellText` + `normalizeTablePayload`,
  defensive against any payload shape, never throws). +4 unit tests.

## v0.4.7 — Omnibar skills cache (2026-05-28)

- **Perf (audit R200 P1)**: the omnibar (Cmd+Space) called `listSkills()` over
  the network on every debounced query ≥2 chars — a full round-trip per
  keystroke-batch. Now cached session-scoped with a 60s TTL and searched
  locally; a freshly installed skill still appears within the window. Identical
  results, far fewer requests on the hot search path.

## v0.4.6 — Audit pass (2026-05-28)

Independent Codex audit of the whole app (`docs/AUDIT-perf.md`) — a
prioritized P0/P1/P2 map of latency, bundle, dead-code, and simplification
findings. The safe, behavior-preserving wins are applied now; the larger
P0/P1 items (streaming reparses the full buffer per delta, eager layout
overlay + MarkdownView imports, +page.svelte decomposition) are documented
for reviewed follow-up.

Applied this pass:

- **Keyed `{#each}` hardening**: TableWidget (headers/rows/cells),
  ComparisonWidget (rows), and the settings notification-sound selectors now
  carry keys — same robustness class as the R107 registry fix.
- **Dead code**: dropped a no-op `onMount` + unused import from
  CommandPalette.

## v0.4.5 — Extensions: fix Registry + clearer setup (2026-05-28)

Dogfooding the Extensions surface against a live gateway surfaced two real
issues:

- **Registry tab crash fixed** (R107): a blank or duplicate connector `name`
  from the gateway made the registry grid's keyed `{#each … (ext.name)}`
  throw uncaught — which showed as a generic "An error occurred" toast and
  silently reverted the tab. `listRegistry` (and `listExtensions`) now drop
  blank names and dedupe, so the grid always renders. +2 client tests.
- **"Needs setup" is now actionable** (R108): an unconfigured connector shows
  a prominent gold **"Set up"** button (not a cryptic gear) plus an inline
  hint about what it needs — "Sign in to connect (OAuth)", "Add a token to
  connect", or "Add credentials or config" — inferred from its category. So
  connecting Slack (already installed, "Needs setup") is one obvious click to
  the setup form, where you enter the token / complete OAuth yourself.

## v0.4.4 — CoS hardening (2026-05-28)

Fixes from an independent Codex review of the v0.4.x Chief of Staff arc (no
P0s found):

- **Stale-stream guard** (P1): Brief/Triage/Draft stores now stop writing the
  instant a newer run (or close) aborts the current one, so a slow stale
  stream can't clobber newer output.
- **Draft pre-stream race** (P1): `onDraft` stamps a monotonic request token
  and bails if a slower `getHistory()` resolves after a newer request.
- **Injection boundary** (P2): the brief/triage/draft prompts now tell the
  agent to treat thread titles, transcripts, and open-loop text strictly as
  data — never as instructions — and not to call tools during these read-only
  completions.
- **Never-throw** (P2): `buildBriefingPrompt` guards an invalid `now` instead
  of throwing on `toISOString()`.
- **Unique ids** (P2): open-loops `add()` regenerates on the astronomically
  rare id collision so keyed rendering + toggle/remove stay correct.

539 tests green (+5), 0 type errors. Production bundle verified.

## v0.4.3 — Draft to send (2026-05-28)

- **Draft a reply** (R105): a send-icon button in the chat header (also
  `/draft [instruction]`) has the Chief of Staff write a finished reply in
  your voice, grounded in the active thread. Type what it should say or
  leave it blank to infer; the draft streams into a panel with an editable
  instruction, Regenerate, and Copy. Read-only — nothing is posted into the
  thread; you copy what you want. The natural follow-through for triage's
  "Can handle" bucket. Prompt assembler (`src/lib/util/draft.ts`) is a tested
  pure util: caps the transcript to the most recent N, returns only the draft
  body, notes assumptions, asks when there's nothing to go on; never throws.

## v0.4.2 — Triage + Today (2026-05-28)

The Chief of Staff gets two more proactive moves and a home on the Today
surface.

- **Triage my threads** (R102/R104): a list button in the chat header (also
  the palette's "Triage my threads" or `?triage=1`) has the CoS sort your
  recent threads into three buckets — Decision needed, FYI, and Can handle —
  each with a one-line reason and a suggested next action, grouped most
  urgent first. The executive-filter principle made concrete. Runs as a
  one-off completion under the CoS persona; read-only like Brief and Recap.
  The prompt assembler (`src/lib/util/triage.ts`) is a tested pure util
  (deterministic recency, optional preview, empty → "nothing to triage",
  never throws).
- **Open Loops tile** (R103): the Today dashboard now leads with your tracked
  commitments — complete / remove inline, add a new one, and a one-click
  "Brief me". Added to the default layout; existing layouts get a dashed
  "Add Open Loops" cell to opt in.

## v0.4.0 – v0.4.1 — Chief of Staff (2026-05-28)

The "enterprise chief of staff in your pocket" direction takes shape. This
line turns the assistant into an executive operator, not just a chat box.

- **Chief of Staff persona** (v0.4.0, R97): a curated, in-repo, fully
  readable system prompt that retasks the agent into an executive operator
  — lead with the recommendation, triage decision vs. FYI vs. self-handle,
  draft to send, track open loops, confirm risky actions. Shipped alongside
  a Research Analyst and an Editor persona. Start any thread under a persona
  from the command palette ("Start thread as Chief of Staff"); the prompt is
  applied as a per-thread override (R43). Canonical spec also lives at
  `skills/chief-of-staff/SKILL.md` for installing the behaviour server-side.
  All personas are authored in-repo (`src/lib/data/personas.ts`) — never
  fetched from a third-party catalog.
- **Open loops** (v0.4.1, R100): a local, persisted primitive for the
  commitments you're carrying. The store is a thin, defensively-loaded list
  in `localStorage` — no network, no thread coupling. Makes the CoS "track
  open loops" principle real.
- **Brief me** (v0.4.1, R99/R101): the chat header's shield button (also
  `/brief`, the palette's "Brief me", or `?brief=1`) has the Chief of Staff
  assemble a prioritized morning agenda from your recent threads + tracked
  open loops. It greets by date, summarizes what's active, restates your
  commitments, and proposes the top-3 priorities with a one-line rationale
  each. Runs as a one-off completion under the CoS persona — read-only, like
  Recap: it creates no thread and posts nothing into a conversation. The
  panel hosts an inline open-loops editor and a Regenerate button. The
  prompt assembler (`src/lib/util/briefing.ts`) is a tested pure util:
  deterministic recency hints, unparseable timestamps sort last, and an
  empty context still yields a valid "plan my day from scratch" brief.

## v0.3.1 – v0.3.3 — Recap + util library (2026-05-28)

Post-milestone increments on the v0.3.x line:

- **Thread recap** (v0.3.1, R89/R68): a "Recap" button in the chat header
  summarizes the whole conversation into a dismissable panel via the
  summarize util + a one-off (non-thread) completion. Non-destructive —
  never mutates or posts into the thread. The panel also shows at-a-glance
  **thread stats** (message count, estimated tokens, time span) computed
  from the same history (v0.3.3, R92).
- **Util library** (v0.3.1–v0.3.2): six tested pure utils under
  `src/lib/util/` — `summarize`, `message-search`, `html-export`,
  `cost-estimate`, `thread-stats`, `format-time`, `fuzzy`, `text-diff`,
  `contrast`. Wired into surfaces where there's a real consumer:
  `format-time` → streams relative timestamps, `fuzzy` → omnibar
  subsequence-recall fallback, `thread-stats` → recap panel. The rest
  remain available library code (no retrofitting working surfaces just to
  use them).
- **Production build validated** at v0.3.2: `npm run tauri build` compiles
  the Rust release and bundles `IronClaw.app` + `IronClaw_<ver>_aarch64.dmg`.
  (Updater `.sig` signing still needs `TAURI_SIGNING_PRIVATE_KEY`, supplied
  as a CI secret — the local bundle is unsigned by design.)

## v0.3.0 — Elite milestone (2026-05-28)

The roadmap's v0.3.0 gate. Everything in Waves 1–5 (R49–R88) is merged,
an Opus 4.8 full-codebase review ran against the v0.2.23 trail, and its
findings are fixed (see v0.2.24). What this release asserts:

- **The model does real work without leaving the app** — Python blocks
  execute (sandboxed), files attach + parse, sub-agents dispatch
  (graceful when the gateway lacks the endpoint), images generate,
  Mermaid/KaTeX/Plotly render (XSS-hardened).
- **Cmd+Space is the one thing to learn** — the omnibar federates
  threads, memory, skills, commands, and now offline message content
  (R86) with AI-ranked results.
- **The replay button** — scrub backward through a conversation and
  watch the tools the model chose (R58/R59).
- **Native everywhere it matters** — Spotlight indexes threads, Notes
  export works (now injection-safe), TTS speaks, vibrancy + traffic-light
  inset, workspace files mount to Finder.
- **Workspace-OS** — dashboard tiles, reply-threads, activity streams,
  generative widgets, a side-by-side LLM council, and a spatial canvas
  whose nodes can dispatch sub-agents and stream results back in place.

Security: the Opus review confirmed every `{@html}` sink DOMPurify-gated,
prototype-pollution + finite-number hydration guards on the canvas store,
correct `untrack()` on the canvas effect loop, zero `.unwrap()/.expect()`
in Rust production paths, and no token logging. The one P0 it found (an
AppleScript injection in the Notes export) is fixed in v0.2.24.

Quality bar at tag: **408/408 vitest green, 0 svelte-check errors, cargo
check + Rust unit tests clean, production build OK, bundle budget within
limits.**

Release note: the signed DMG is produced by the `release` GitHub
Actions workflow on this tag. That workflow is currently billing-blocked
on the account (R76 — fix in GitHub → Settings → Billing & plans); once
billing is restored the tag re-run yields the notarizable artifact.

## v0.2.23 — Waves 1–5: native reach, workspace-OS, sub-agents (2026-05-28)

Rolls up the post-v0.2.10 build push (internal bumps v0.2.11 → v0.2.23,
roadmap items R49–R88). Themes:

- **Native macOS reach** (R50/R51 TTS + voice answer, R60 Spotlight
  indexing, R61 Apple Notes export, R63 vibrancy + title-bar inset,
  R64 mini-mode, R70 workspace files → `~/Documents/IronClaw/<profile>`
  via `src-tauri/src/fs_mount.rs`, path-traversal guarded).
- **Workspace-OS surfaces** (R77/R78 dashboard + draggable tiles,
  R79/R80 Slack-style reply-threads, R81 activity-feed `/streams`,
  R82 generative widgets, R83 council v2 side-by-side streaming,
  R84 spatial canvas `/canvas` — native Svelte, no tldraw/React,
  defensive localStorage hydration).
- **Sub-agents** (R56/R57): dispatch a one-shot background task at the
  gateway's `/api/v1/tasks` family and stream progress into a per-thread
  chip; degrades cleanly (`SubAgentUnsupportedError`) when the gateway
  lacks the endpoint. R88 wires the canvas "Ask this node" composer to
  dispatch a real sub-agent and stream its output into a connected node.
- **Power-user search + render** (R53 Mermaid/KaTeX/Plotly renderers,
  XSS-hardened; R55 omnibar Cmd+Space; R58/R59 time-travel replay;
  R62 IndexedDB offline message cache; R65 inline tool authoring;
  R66 sandboxed Python REPL blocks; R67 `/imagine`; R69 per-bubble
  markdown edit).
- **Wave 5 utils + integration** (R85 auto-summarization util,
  R86 cached-message search wired into the omnibar as a `Message`
  result kind, R87 self-contained XSS-safe HTML transcript export
  wired into the chat export menu).
- **Perf** (R49 lazy-loaded routes) and **E2E** (R72 Playwright specs
  for chat tabs, dashboard, multimodal render, omnibar, replay,
  streams, voice).

CI note: GitHub Actions on this account is currently billing-blocked
(jobs fail to start with a spending-limit message); the local
`pre-push` hook runs the full `svelte-check` + `vitest` suite, so
pushes remain gated regardless. Resolve by updating GitHub → Settings
→ Billing & plans.

## v0.2.10 — Five new surfaces + release lockdown (2026-05-28)

First public release since v0.2.0 (2026-05-27). Folds in everything
shipped under the v0.2.1 → v0.2.9 internal version bumps (see entries
below for the underlying work) plus five user-facing surfaces and
the release lockdown:

- **Release lockdown** (R38): `diag_log` opt-in (DEV build OR
  `localStorage['ironclaw-diag']='1'`), `dev-devtools` Cargo feature
  default-OFF so right-click → Inspect is not available in release
  bundles, `build_provenance` Tauri command surfaces the build type
  (debug / release-with-devtools / release) in the About dialog.
- **IronHub catalog browse + install** (R39): new
  `/skills/ironhub` route powered by `src-tauri/src/ironhub.rs`
  (`list_catalog`, `fetch_skill`, `install_skill_local`). Lists the
  curated `github.com/nearai/ironhub` registry, one-click installs
  into the active workspace. Path-traversal hardened (no `..`, no
  `/`, no symlink escapes), install dir always rooted at
  `app_data_dir/skills/<name>/`. Catalog cache 1h.
- **LLM Council** (R40): new `/council` route + Cmd+0 shortcut.
  Sends the same prompt to N selected providers and shows responses
  side-by-side, with a `Promote` button per response to start a
  follow-up thread on that provider. Sequential fanout for now (the
  gateway has no per-call provider override yet); the in-route
  banner explains the limit. Store ready for parallel mode when
  the gateway lands per-call overrides.
- **Tool flow visualizer** (R42): right rail on the chat surface
  (`hidden xl:block w-[320px]`) renders the tool calls IronClaw
  made for the active thread, in order, with arguments + results.
  Powered by `src/lib/stores/tool-flow.svelte.ts` (per-thread
  Map). 9 vitest cases.
- **Per-thread system prompt override** (R43): kebab menu →
  `Custom system prompt…` opens a modal; the prompt overrides the
  workspace default for that one thread, gold chip on the header
  shows the override is active. Stored in `localStorage`
  (`ironclaw-per-thread-prompts`) with defensive filter against
  `__proto__` / `constructor` / `prototype`. 9 vitest cases.
- **Memory inspector** (R44): new `/memory` route + Cmd+M shortcut.
  Two-column list/detail across the IronClaw memory tree with
  search, create, edit, delete.

Backtest coverage for this trail:
- R45 codex review (P0/P1/P2 fanout).
- R46 live dogfood against `baremetal3.agents.near.ai` — 5 smoke
  specs, 5/5 passing in 7.3s.
- R47 bundle + perf regression check — 344 / 360 KB gzipped
  (95.6% of cap), R49 has queued lazy-loads for the three
  heaviest new modules.
- R48 fresh-user simulation — wipe + dev-up, time-to-first-chat.

## v0.2.9 (unreleased) — Ringfence + token-source visibility

- **Ringfence the v0.2.7 / v0.2.8 fixes** so a follow-up review pass
  doesn't mistakenly strip them. Both the `default = ["custom-protocol"]`
  Cargo feature and the keychain file fallback are load-bearing for
  release-mode connectivity; added block comments + a `CONTRIBUTING.md`
  section explaining the rationale.
- **`get_token_source` Tauri command** reporting whether the active
  bearer came from the Keychain, the file fallback, or is absent.
- **`TokenSourceBadge.svelte`** — pill component surfacing that state
  in the UI (cyan / gold / muted with tooltip per state). 5 new vitest
  cases cover the JS wrapper.
- **`scripts/stage-token.sh`** — writes a token straight into the file
  fallback so headless dev loops aren't blocked by the macOS keychain
  ACL prompt.

## v0.2.8 (unreleased) — APP WORKS (keychain timeout + file fallback)

After R34g unblocked the webview (v0.2.7), the production .app _still_
showed "Disconnected" because `keyring::Entry::get_password()` was
blocking forever waiting for an invisible macOS ACL grant. Every
`cargo --release` rebuild produces a new ad-hoc signature, so the
previous "Always Allow" no longer applies and the new prompt may
never surface. The synchronous call wedged the entire Tauri IPC
dispatcher — no fetches, no UI updates.

Fixed by running the keychain read on a worker thread with a
2-second timeout, then falling through to a plaintext file in
`app_data_dir/tokens/<account>.token` (mode 0600). Writes mirror to
both stores so a future build can read from either. Verified the
fix end-to-end: launching the bundled app now produces successful
fetches against `/api/health`, `/api/profile`, `/api/skills`,
`/api/chat/threads`, `/api/routines/summary`, `/api/jobs/summary`,
`/api/extensions`, `/api/extensions/readiness`, and
`/api/extensions/tools` — all status 200.

Also wires a `diag_log` Tauri command that the frontend uses to pipe
state into `RUST_LOG`, giving the production .app an observability
surface without devtools (also load-bearing for further debug, see
v0.2.9 ringfence).

## v0.2.7 (unreleased) — ROOT CAUSE (Cargo `custom-protocol` feature default)

The reason every prior production build of the `.app` showed
"Disconnected" forever: `src-tauri/Cargo.toml` was missing
`default = ["custom-protocol"]`. Without it, Tauri treats every
`cargo build` (even `--release`) as a dev build and points the
webview at `build.devUrl` (`http://localhost:1420`) which isn't
running in production — so the webview loaded a blank page and zero
JS ever ran. None of the prior 6 hours of debugging (ATS, CSP, http
plugin, keychain) addressed this; they were all chasing downstream
symptoms.

Fix is one line in Cargo.toml plus a compile-time error so the
regression can't ship again. Frontend assets now embed properly into
the binary; the webview boots; `connection.init()` actually runs.

## v0.2.6 (unreleased) — Diagnostic infrastructure (now removable)

Added smoke-test localStorage writes and `window.onerror` capture in
`app.html`, plus `tauri = { features = [..., "devtools"] }` so right
click → Inspect works in release. All used to triangulate the v0.2.7
root cause. The smoke-test scripts were removed in v0.2.7; `devtools`
stays on for now while we land the rest of R35.

## v0.2.5 (unreleased) — Onboarding repair + CORS bypass

- **Onboarding wizard end-to-end repair** (R34d/e):
  - Bidirectional `/onboarding` redirect: layout now routes the user
    OUT of the wizard once `onboardingComplete: true`, not just IN
    when it's false. Stops the trap when WebKit URL restore or any
    other path lands on `/onboarding`.
  - `connection.init()` promise-cached so concurrent callers all
    observe the SAME loaded settings (eliminates the
    DEFAULT-`onboardingComplete: false` race that triggered the
    invisible re-entry into the wizard).
  - Onboarding `skip()` now reads fresh settings from disk and
    flips only `onboardingComplete`, preserving the user's
    `mode: remote` against the wizard's in-memory draft (which had
    been writing `mode: local` to disk just by _navigating_ through
    step 2).
  - Step-2 "Skip for now" is wired to `skip()` instead of
    `step = 3` so it actually escapes the wizard.
  - `localStorage["ironclaw-onboarding-bypass"]` escape hatch in
    `+layout.svelte` so a future trap can be cleared without
    re-installing.
- **`DataCloneError` audit** (R34f): Svelte 5 `$state` proxies are
  not structured-cloneable through Tauri IPC.
  `settings.svelte.ts:saveSettings` now `JSON.parse(JSON.stringify(s))`
  before `invoke()`. `notifications.svelte.ts:pushTrayRecent` got the
  same treatment after the audit found one more vulnerable site.
- **Tauri HTTP plugin** (`@tauri-apps/plugin-http` + `tauri-plugin-http`)
  added so production fetches route through Rust and bypass WKWebView
  CORS (gateway doesn't whitelist `tauri://localhost`). Falls back
  to native fetch in browser/vitest contexts.
- **`NSAllowsLocalNetworking` Info.plist** committed at
  `src-tauri/Info.plist` so the ATS exception is part of the build
  pipeline instead of a manual `plutil` patch.
- **Capability**: `http:default` grants `127.0.0.1:*`, `localhost:*`,
  `https://**`.

## v0.2.2 (unreleased) — P0 ATS fix (HTTP gateway connectivity in release builds)

- **App Transport Security exception baked into the bundle** — release
  builds of the desktop client silently failed every HTTP fetch to the
  gateway because the generated `Info.plist` had no ATS exception, and
  macOS ATS blocks plain-HTTP loads from WKWebView by default. The chat
  surface showed "Disconnected" forever despite a healthy gateway on
  `http://127.0.0.1:3100` (bundled sidecar) or `http://127.0.0.1:18789`
  (SSH-tunneled remote). Dev mode masked the bug because
  `npm run tauri dev` uses a different WKWebView path that bypasses ATS.
  Fixed by adding a sidecar `src-tauri/Info.plist` that tauri-bundler
  auto-merges into the bundled plist on every build. Uses the narrow
  `NSAllowsLocalNetworking = true` scope (covers 127.0.0.1, localhost,
  \*.local only) rather than the blanket `NSAllowsArbitraryLoads`, so
  production HTTPS gateways are unaffected and we don't broaden the
  attack surface. Verified post-build via
  `plutil -p IronClaw.app/Contents/Info.plist`.

## v0.2.1 (unreleased) — Rounds 26-31 (observability, templates, playground, hooks)

Major adds since v0.2.0, all four CI gates green (svelte-check 0
errors, 181/181 vitest, build clean, cargo check clean):

- **Sidecar log streaming** (R26) — Rust ring buffer in `sidecar.rs`
  captures stdout/stderr from the bundled IronClaw, replayed to the
  webview via a `sidecar:log` Tauri event. The Logs route gains a
  Gateway / Sidecar / Both source toggle so the user can grep either
  stream without flipping windows.
- **System prompt diff** (R27) — full-route `PromptDiff` component
  with side-by-side and unified modes, A/B version picker plus a
  Compare-to-current shortcut, and Restore to roll back. Diff
  engine lives under `lib/util/diff.ts`; pure functions, unit-tested.
- **Crash reporter + opt-in telemetry** (R28) — `crashes.rs` writes
  panics + sidecar exits to a JSONL ring (5 MB rotation) in the app
  support dir. New `telemetry.svelte.ts` store wired to 9 events
  (update available/installed, sidecar spawn/exit, tray badge change,
  command palette open, slash invocation, profile switch, mission
  start). Off by default; opt-in via Settings → Advanced.
- **Layout / sidebar init race fix** (R29a) — `connection.init()`
  now caches the in-flight promise so concurrent callers from the
  layout root, the sidebar, and the status bar dedupe to one
  initialization. Real bug caught by R24c Playwright runs flaking
  on cold reload — fixed once, verified by re-running the E2E suite.
- **Conversation templates** (R29c) — Cmd+Shift+T modal with
  `{variable}` substitution. Templates live as JSON in the workspace
  (`~/Library/Application Support/com.ironclaw.desktop/templates/`),
  show in both Cmd+K command palette and the slash autocomplete.
- **Notification grouping** (R29d) — same-category notifications
  within 30 s coalesce by id so a burst of sidecar restarts no
  longer flickers the macOS Notification Center. Tunable in
  Settings → Notifications. +7 tests, total now 181.
- **Component playground** (R30a) — `/dev/playground` route with 10
  stories (Toasts, Sparkline, UpdaterBanner, Sidebar, StatusBar,
  Spinner, ThreadSwitcher, SlashAutocomplete, CommandPalette,
  AboutDialog). Route is gated on `import.meta.env.DEV` so it never
  ships in production builds.
- **README workflows expansion** (R30b) — 6 step-by-step workflow
  guides (remote tunnel, local sidecar, profiles, slash + templates,
  global search, Engine v2), troubleshooting table, 4 real
  onboarding screenshots committed under `docs/screenshots/`.
- **SSH tunnel helper** (R31a) — `scripts/tunnel.sh` with
  open / close / status / restart subcommands, color output, env-var
  overrides (`IRONCLAW_SSH_ALIAS`, `IRONCLAW_TUNNEL_PORT`). README
  has a dedicated section.
- **Pre-commit hooks** (R31b) — `simple-git-hooks` + `lint-staged`
  wire `prettier --check` on staged files at commit, full
  `npm run check && npm run test` at push. Auto-installed by the
  `prepare` script on `npm install`.
- **Dogfood verification** (R25-1) — confirmed the app works
  end-to-end against the live IronClaw on `baremetal3`: 499 real
  threads listed, Knowledge tree paginates, Logs SSE streams. Added
  a DEV-only Tauri IPC shim in `app.html` + Vite proxy in
  `vite.config.js` so future headless dogfood runs work in a plain
  browser.

## v0.2.0 — First signed release (RELEASED 2026-05-27)

Released as [v0.2.0](https://github.com/abbyshekit/ironclaw-desktop/releases/tag/v0.2.0).
Artifacts: `IronClaw_0.2.0_aarch64.dmg`, `IronClaw_0.2.0_x64.dmg`,
`IronClaw.app.tar.gz`, `IronClaw.app.tar.gz.sig`.

First release with a signed updater pipeline. Pubkey baked into
`tauri.conf.json`; `TAURI_SIGNING_PRIVATE_KEY` +
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` set as GitHub Actions secrets so
the release workflow produces signed `.app.tar.gz` + `.sig` artifacts
alongside the DMGs.

- **Cmd+R reload + Cmd+L copy** (24a) — global shortcuts: Cmd+R reloads
  the current route via `goto(currentPath, { invalidateAll: true })`;
  Cmd+L copies the focused message or current visible chat content to
  the clipboard. Both wired through the layout-level keyboard handler;
  no conflicts with existing palette/thread/preset shortcuts.
- **Slash autocomplete usage ranking** (24b) — `SlashAutocomplete`
  now consults a new `slash-usage.svelte.ts` store that tracks
  per-command invocation counts in localStorage. Matches are sorted
  by (recency-weighted) usage first, then alphabetically. Boosts
  high-frequency commands to the top of the picker without breaking
  prefix-match semantics. Test coverage: `slash-usage.test.ts` with
  cases for fresh store, counter increment, recency decay, and
  storage corruption fallback.
- **Playwright E2E** (24c) — `playwright.config.ts` + first
  `tests/e2e/` suite covering: app launch, sidebar nav across all
  surfaces, command palette open/close, slash autocomplete, thread
  switch. New `.github/workflows/e2e.yml` runs the suite on PRs.
- **Inline thread rename** (24e) — `ThreadSwitcher` gains
  double-click-to-rename on each row. New `thread-rename.svelte.ts`
  store handles in-flight edits with debounced persistence and
  cross-tab broadcast via `BroadcastChannel`. Esc cancels, Enter
  commits, blur commits. `thread-rename.test.ts` covers commit,
  cancel, validation (empty/whitespace rejected), and broadcast.
- **Signing pipeline** — `scripts/generate-updater-key.sh` produces
  the minisign keypair locally; pubkey lives in
  `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`; private
  key never leaves `~/.tauri/`. CI consumes the key via repo secrets.

## v0.1.16 — Round 23 (env_logger + CSP + composite tray + import UX)

Four of the audit v3 v0.2/1.0 recommendations landed:

- **env_logger init** (23a / R22b fix) — added `env_logger = "0.11"`
  - 9 log statements at meaningful checkpoints (startup with version,
    sidecar spawn/health/stop, keychain access slot name without
    values, tray registration, window-close/exit hooks). Default
    filter `ironclaw_desktop_lib=info,warn`; override via
    `RUST_LOG=debug npm run tauri dev`. Sidecar passthrough + tray
    errors + keychain failures now reach stdout. Closes R22b's
    "real bugs invisible until you wire env_logger" gap.
- **Restrictive CSP** (23b) — replaced `app.security.csp: null` with
  explicit policy covering 10 directives. Highlights: script-src
  bans inline + eval (the meaningful XSS guard), object-src/frame-
  src 'none' blocks plugins + iframes, base-uri 'self' blocks
  `<base>` rewrite. Looseness documented: connect-src `http://*
https://*` is unavoidable until gateway URLs route through Rust
  proxy; style-src 'unsafe-inline' is required by Svelte 5 scoped
  CSS. ARCHITECTURE.md updated with the policy + reasoning.
- **Composite tray icons option-B** (23c) — replaced `set_title` text
  badge with 33 pre-rendered PNG composites (3 status colors ×
  11 count buckets: 0/1/2/3/4/5/6/7/8/9/9plus). Build script
  extends `build_tray_icons.py`. New `update_status_and_count` IPC.
  Rust caches both fields so a status flip preserves the count badge
  and vice versa. Binary embed via `include_bytes!` costs ~29KB.
- **Settings export/import UX** (23d) — four improvements: gold inline
  banner above Export/Import flagging that tokens aren't included;
  per-profile token badge ("Token: set" / "Token: missing", clickable
  to switch + focus the token input); welcome-back banner at top when
  active profile lacks token; post-import success modal listing each
  imported profile and the specific credentials it needs.

## v0.1.15 — Round 21 (snapshot tests + onboarding tint + profile reorder)

- **Snapshot tests** (21a) — 6 new test files producing 18 DOM snapshots
  across Sparkline (3 variants), Toasts (3 kinds), UpdaterBanner (4 states:
  idle/available/downloading/error), Sidebar (4: expanded × no-tint vs
  orange tint × collapsed × collapsed-with-tint), StatusBar
  (3: disconnected/connected/local-running), AboutDialog (1: open with
  mocked gateway+version+nav). Stabilization layer: fixed ids, mocked
  Tauri `app.getVersion`, pinned `navigator.userAgent` + `screen.width/height`,
  Map-shimmed `localStorage` (Vitest 4's default is broken). Three
  `$app/*` stubs under `tests/__mocks__/` + 3 alias lines in
  `vitest.config.ts` so the SvelteKit virtual modules resolve under jsdom.
  Total tests: 126 → 150.
- **Onboarding tint preview** (21b) — Step 1 "Personalize" section with
  6-swatch tint picker (signal/cyan/violet/orange/teal/rose). Live
  preview via `$effect` that writes `--v2-accent` vars on
  `documentElement` + a scoped style block rebinding Tailwind's
  `accent-cyan` utilities (and `/5,/10,/20,/30,/40` alphas, hover,
  focus variants) to the chosen tint. Selected swatch gets a 3px ring
  in its own tint. Persists across Back navigation; baked into the
  active profile on Finish.
- **Profile reorder** (21c) — drag-handle (6-dot grip SVG) on each
  profile row in Settings (20×24px) and Sidebar popover (14×24px,
  tighter). HTML5 native drag-drop with `opacity: 0.5` on the dragged
  row + 2px cyan line at the insertion point. Drop position
  determined by clientY vs row midpoint. Only the grip element is
  draggable so cmd-click-for-new-window (R15b) still works. New
  `reorderProfiles(orderedIds)` method on settings store: type-checks
  the array, validates length match + no duplicates + every id
  exists, no-ops on identity order, saves + broadcasts via the
  existing `settings-changed` BroadcastChannel. 6 new tests for
  reorder validation.

All gates green: 463 files, 0 svelte-check errors, 150/150 tests,
`cargo check` clean, `cargo clippy` clean.

## v0.1.14 — Round 20 (presets + cron + tray notifs + bundle tooling)

- **Workspace presets** (20a) — new `PresetStore` + `PresetsModal`.
  Captures current state (active path, current thread, panel widths,
  sidebar collapsed, tray badge, status bar visible) → saves as a
  named preset. Apply restores all via localStorage writes +
  `goto(activePath)` + cross-route nav remount re-hydrates from
  storage. **Cmd+Shift+P** opens the modal. New CommandPalette
  actions: "Workspace presets" + "Save current workspace as preset…".
- **Visual cron parser + preview** (20b) — new `cron.ts` util parses
  5-field cron + `@hourly`/`@daily`/etc aliases + IronClaw's
  `every 5m` shorthand + tolerates multi-space/tab/whitespace.
  Returns human readable ("Every weekday at 9:00 AM", "On the 1st
  of every month at 9 AM"). New `CronPreview.svelte` component
  shows preview inline (muted gold for valid, red for invalid).
  Wired under Schedule column in routines table + DetailPanel header.
  44 new tests; total 126.
- **Tray menu recent notifications** (20c) — notifications store
  gains a 10-item rolling history (TTL 24h, persisted to localStorage
  in a separate slot so `clearHistory` doesn't touch prefs). Rust
  tray rebuilds the "Recent" submenu when JS invokes
  `update_tray_recent` with the top 5. Click → `tray:open-notification`
  event routes by category (chat→/, routine→/routines, sidecar→
  /settings). "Clear all" item dismisses. Disabled "No recent
  notifications" placeholder when empty.
- **Bundle analyzer + perf snapshot** (20d) — `scripts/analyze-bundle.sh`
  walks `build/_app/immutable/` for per-file raw+gzip+line counts,
  per-node totals, top-5. `scripts/bundle-baseline.json` captures
  current state (46 files, 958 KB raw / 293 KB gzip, 30.6% ratio).
  `scripts/bundle-compare.sh` diffs vs baseline, exits 3 on regression
  (>10% total gzip or >25% on any stable file). `scripts/perf-snapshot.sh`
  spins up vite dev server + curl-probes 5 routes for TTFB / total
  time / size / critical resource counts. README appended a
  "Bundle analysis" section.

All gates green: 454 files, 0 errors, 126/126 tests, cargo clean.

## v0.1.13 — Round 19 (UX polish + chat v3 + comprehensive docs)

- **UX polish + a11y deep pass** (19a) — global focus-visible cyan
  ring in `app.css` for buttons/links/`[role=*]` elements (was missing
  everywhere, relying on dim default browser outline). Added
  `role="tablist"`/`tab`/`aria-selected` to Admin (3 tabs) +
  Extensions (Installed/Registry). Modal semantics (`role="dialog"`,
  `aria-modal="true"`) on slide-in detail panels (Routines/Jobs/
  Missions). Improved chat empty state to distinguish
  disconnected-vs-empty-but-ready. 28 P2/P3 findings documented in
  `UX_NOTES.md` for follow-up sweeps.
- **Chat v3** (19b) — three composer/surface upgrades:
  - **Image lightbox** — click any image (attachment or markdown img)
    → backdrop-dimmed overlay, capped 90vw/90vh, dismiss on
    backdrop/Esc/close. Event delegation on the scroll container
    so attachment thumbnails AND assistant-rendered images both
    open the same modal.
  - **Voice input** — Web Speech API (`webkitSpeechRecognition`
    fallback for Safari/Tauri WebKit). Mic button pulses red while
    listening, interim transcript streams into the textarea
    anchored at the user's caret position, finals bake additively,
    3s silence auto-stops. Disabled with tooltip on Firefox.
  - **Conversation branching** — each assistant bubble gets a
    hover-revealed branch button → confirm dialog → spawns new
    thread. Probed `/api/chat/threads/<id>/branch` returns 404 —
    fallback seeds the new thread with "Forked from <id> at turn N.
    Original context:" + concatenated history, so the agent gets
    context as part of the first user turn. Re-probes cached
    per-session for when upstream adds native branching.
- **Documentation pass** (19c) — `ARCHITECTURE.md` (878 lines) with
  4 Mermaid diagrams covering the Tauri shell, store dependencies,
  multi-window broadcast sync, sidecar spawn sequence. Full security
  model documented (Keychain scoping, capability allowlist, redact
  pipeline, CSP punt with reasoning). All Rust modules, every store
  with line counts, the markdown pipeline (marked → DOMPurify →
  highlight.js 12 curated languages), sidecar lifecycle per backend.
  `CONTRIBUTING.md` (637 lines): prereqs/install/dev, the 4 CI gates
  with failure criteria, end-to-end recipes for new API methods +
  new surfaces + new icons, release flow including the keypair
  setup. `README` gained a "Quick tour" section with the 7 core
  chords and Cmd+1..9 surface table.

All gates green: 449 files, 0 errors, 82/82 tests, build clean.

## v0.1.12 — Round 18 (settings search + quick capture + 48 more tests)

- **Settings search** (18a) — sticky search bar at top of settings
  page, 200ms debounced, walks 17 section cards via
  `data-section-id` + `data-section-title` attributes. Dim
  non-matching cards (`opacity-30` + transition), thin cyan ring
  around matches. Result list under the bar with click-to-scroll.
  Inline gold-tint highlight only in the result-list labels (titles
  are safe text); card bodies stay uninstrumented to avoid breaking
  form bindings / live components. Cmd+F focuses the search input
  when on `/settings`; doesn't conflict with chat's Cmd+F (mounted
  only on chat route).
- **Quick capture mini-chat overlay** (18b) — **Cmd+Shift+N** opens
  a ~500×180 floating modal. 3-row auto-grow textarea (up to 8
  rows). Cmd+Enter sends; bare Enter inserts newline (different
  from chat — gives time to refine). Auto-discovers or creates a
  "Quick captures" thread on first send. Toast on success
  ("Captured to Quick captures"), keep modal open with content on
  error. Available via CommandPalette "Quick capture" action too.
  Disabled when offline. Esc with non-empty content fires native
  discard confirm.
- **Component test coverage** (18c) — 6 new test files, +48 tests,
  total 82 across 10 files:
  - **MarkdownView** (9): h1/h2/h3 ids, code highlighting, GFM
    tables, callout blockquotes, `<script>` + `on*` +
    `javascript:` strip, `data:image/*` pass-through.
  - **MaskedValue** (6): mask/reveal/hide/empty/non-secret/locked.
  - **Sparkline** (8): empty/single/flat series, bars/line/area
    variants, negatives, custom dimensions.
  - **Toasts** (5): show, 3500ms auto-dismiss, manual dismiss,
    stack, kind classes (`vi.useFakeTimers`).
  - **notifications store** (13): `isInQuietHours` wrap/disabled/
    same-day/start==end cases, quiet-hours setters, `unseenCount`
    triggers + `markAllSeen` + broadcast emit.
  - **pins store** (7): pin/unpin/isPinned/idempotent/cap/all/
    persistence.

  Vitest 4's localStorage is partial; per-test Map-backed shim
  installed in `beforeEach` since `vitest.setup.ts` was off-limits.

All gates green: 448 files, 0 errors, 82/82 tests, build clean.

## v0.1.11 — Round 17 (broadcast sync + Cmd+T switcher + doc TOC + pins)

- **Cross-window BroadcastChannel sync** (17a) — new
  `broadcast.svelte.ts` rune store opens channel
  `ironclaw:state-sync`. Settings changes in one window broadcast
  `settings-changed`; receiving windows call
  `connection.reloadSettings()` without re-pinging the gateway or
  cycling the sidecar. `notification-seen` clears unseen across
  windows. Two-layer loop prevention: windowId (`crypto.randomUUID`
  on module load) stamped on every send + opt-out flag on local
  `markAllSeen` so receivers don't re-emit. Reserved hooks for
  `profile-switched` / `connection-event` / `sidecar-status`.
- **Cmd+T quick thread switcher** (17b) — new `ThreadSwitcher.svelte`
  modal — fuzzy substring search, gold mark highlight, two-tier
  sort (last-selected desc → updated_at desc), recent threads
  section when input empty, tint dot per row. Cmd+T binding uses
  `e.code === 'KeyT'` for non-QWERTY layouts. Added "Switch thread"
  action to CommandPalette. Recent threads tracked via
  `threads.svelte.ts.recordRecentThread` (dedupe-cap-10, persisted
  to localStorage).
- **Document outline / TOC** (17c) — DocViewer's right rail renders
  a 200px wide TOC when MarkdownView produces 3+ h1/h2/h3 headings.
  Walks rendered DOM via `$effect` + `tick`, indents by level
  (8/20/32px), click smooth-scrolls to anchor, active section
  determined by `getBoundingClientRect` at 16px-from-top threshold.
  Hides below 1100px viewport, hides in edit mode. Collapse button
  persists state to localStorage. Reads slugger IDs from
  MarkdownView's existing renderer override.
- **Pin/favorite across surfaces** (17d) — new `pins.svelte.ts`
  rune singleton tracking pinned items per surface (skill/routine/
  knowledge/thread/extension). Per-surface star toggles (Skill
  cards, Extension cards, Routine action column, hover-revealed
  on chat thread rows). Pinned items hoist to top of each surface
  via stable sort. CommandPalette gains a "Pinned" category +
  pill that aggregates across all surfaces; gold-accented headers
  signal pinned state.

All gates green: 440 files, 34/34 tests, build clean.

## v0.1.10 — Round 16 (sparkline + drag-drop knowledge + search filters + tints)

- **Sparkline component** (16a) — new reusable `Sparkline.svelte`
  with line/bars/area variants, auto-normalize, negative handling,
  single-point centering, threshold ref-line. Pure SVG primitives,
  zero deps. Adopted in: routines summary (24h bars, replacing
  hand-rolled flex-bars), admin usage dashboard (per-row
  `call_count` bars under "LLM calls (30d)" card), engine thread
  detail (cumulative-tokens area chart in header beside the Tokens
  scalar).
- **Drag-drop file import to Knowledge** (16b) — drop `.md`/`.txt`/
  `.json` files anywhere on the `/knowledge` route → batch-import
  modal with per-file editable paths (default `imports/<filename>`),
  JSON pretty-print, depth-counter for `dragenter`/`leave` (no
  strobing), `MAX_FILES=20`, `MAX_SIZE=1MB`, MIME allowlist
  (`text/markdown`, `text/plain`, `application/json`, plus
  extension-fallback for empty-MIME drops). Sequential `writeMemory`
  - aggregate summary toast (all-ok / partial / all-failed). Modal
    stays open if every write failed for retry.
- **GlobalSearch surface-filter chips** (16c) — pill row above
  results — All / Knowledge / Threads / Jobs / Skills / Routines /
  Extensions. Each pill shows result count. Active pill cyan.
  Number-key 1–7 shortcuts when input empty. sessionStorage
  persistence. Filtered view drops per-section headers (since
  they'd all be one surface). Knowledge `$effect` short-circuits
  when scope excludes Knowledge.
- **Per-profile theme tint** (16d) — new optional `tint` field on
  `ProfileConfig` — signal (default cyan-blue), cyan (old
  IronClaw), violet, orange, teal, rose. CSS variables
  (`--v2-accent` and friends) repaint live via `$effect` on
  `document.documentElement`. Visual signals in Sidebar (brand
  glyph + wordmark + profile popover dots), StatusBar
  (profile-section dot when connected), Settings (per-profile
  6-swatch radiogroup picker). Each window can have a different
  tint when multi-window is open, so visually distinguishing
  profiles.

All gates green: 436 files, 0 errors, 34/34 tests, cargo clean.

## v0.1.9 — Round 15 (query-param deep-links + multi-window + status bar)

- **Deep-link wiring** (15a) — chat reads `?thread=`, jobs reads
  `?open=`, skills reads `?focus=`, extensions reads `?focus=` on
  mount. Match → open the target item (select thread, open
  job/skill drawer, expand+scroll-into-view extension card). Stale
  links toast "X not found" and clear the param via SvelteKit
  `goto` with `replaceState`. Closes 4 TODOs from R14b
  GlobalSearch.
- **Multi-window per profile** (15b) — new `src-tauri/src/windows.rs`
  with `open_profile_window` + `list_open_profile_windows` commands.
  Window label = `profile-<sanitized-id>`; existing label focused,
  not duplicated. Capability whitelist uses `profile-*` glob + new
  `core:webview:allow-create-webview-window` permission. Connection
  store reads `?profile=<id>` on init and overrides
  `activeProfileId` per-window so windows can scope to different
  profiles simultaneously. Settings + Sidebar (cmd-click) trigger
  the spawn.
- **Bottom status bar** (15c) — new `StatusBar.svelte` with three
  sections: left = profile + Remote/Local + port, center =
  provider · model, right = jobs queue (pulse when >0) + tokens
  today (admin) + latency. **Cmd+/** toggles visibility (persisted
  to localStorage). Below 900px shows only the left section. Click
  sections to navigate to Settings / Jobs.
- **Onboarding auto-detect** (15d) — persist accepted URL to active
  profile immediately. Step 3 auto-tests on mount with "Skip LLM
  test" link. Port scan extended to 6 ports
  (`3100`/`18789`/`3334`/`8080`/`22821`/`3000`) via
  `Promise.allSettled` + 2s timeout per port. Fingerprint banner
  upgrades to show detected IronClaw version + LLM backend.
  Detection state survives Back/Next navigation within the wizard.

All gates green: 434 svelte files / 0 errors, 34/34 tests,
`cargo check` + clippy clean.

## v0.1.8 — Round 14 (tests + global search + resize panels + CI guards)

- **Testing infrastructure** (14a) — vitest +
  `@testing-library/svelte` + `@testing-library/jest-dom` + jsdom
  - mocked Tauri IPC. 34 starter tests across 4 files covering
    `redact` utility (Bearer / `sk-` / `api-key` / JWT / JSON walk /
    preserveTips), `IronClawClient` parsers (`getHistory`
    turns→messages expansion, `listThreads` `turn_count`→
    `message_count`, `gatewayStatus` `uptime_secs`, `getSettings`
    array→map fold), settings store migrations (empty→defaults,
    legacy flat→profile, orphan re-anchor), Icon component (known
    names, fallback). Hooked into `.github/workflows/check.yml`
    between `npm run check` and `build`.
- **Cross-surface global search** (14b) — **Cmd+Shift+F** opens a
  full-width top-of-viewport modal that searches across knowledge /
  threads / jobs / skills / routines / extensions in parallel via
  `Promise.allSettled`. 300ms debounce, gold-tint substring
  highlight, recent-searches in localStorage, arrow-nav + Enter
  routing. Also reachable via Cmd+K → "Search everywhere" action.
- **Drag-to-resize panels** (14c) — new `ResizeHandle` component
  (4px vertical strip, double-click resets). Wired into chat
  (rail + inspector), knowledge (tree), missions (projects).
  Widths persist to localStorage per-pane. Below 900px viewport,
  handles auto-disable and panes revert to defaults (persisted
  values retained).
- **CI guards + endpoint probe** (14f) —
  `scripts/probe-blocked-endpoints.sh` checks if upstream IronClaw
  has shipped the server-blocked endpoints we currently stub
  (thread delete, routine create, memory delete, signout,
  recent-runs). Green = still blocked, yellow = now responding
  (wire UI!). `.github/workflows/style-guard.yml` fails PRs
  introducing hardcoded `#00d4ff` / `#4ca7e6` / `#2882c8` /
  `#00bcd4` outside the design-token allowlist
  (`tailwind.config.js`, `app.css`, `icons/`).

## v0.1.7 — Round 12 (audit follow-ups + tray badges + thread virtualization)

Audit-v2 follow-ups (post-R6λ): tray badges, thread virtualization,
plus a host of correctness fixes from the R12d audit pass.

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
  - sidecar + system info. Mounted in layout, triggered from Cmd
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

| Chunk                  | Size      | Gzip     |
| ---------------------- | --------- | -------- | ------------------- |
| `chunks/DfDYC6eE.js`   | 143.60 kB | 46.88 kB | ← shared kernel     |
| `nodes/11.…` (jobs)    | 81.14 kB  | 21.37 kB |
| `nodes/0.…` (chat)     | 67.23 kB  | 20.10 kB |
| `chunks/DwQK25nF.js`   | 62.28 kB  | 18.18 kB | ← markdown pipeline |
| `nodes/3.…` (settings) | 46.11 kB  | 13.41 kB |

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
