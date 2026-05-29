# Changelog

## v0.4.65 — The Desk: open-loops quick-add (increment 6) (2026-05-29)

- **The Desk (increment 6 — capture)**: the "Open loops" section now always
  renders with a quick-add input ("Track a commitment…", Enter or Add), so the
  Desk is a capture surface, not just a viewer — jot a commitment the moment you
  think of it and it lands in the R100 open-loops store. New `RebornDesk.addLoop`
  (delegates to the store's trim/empty-guarded `add`); the panel gained a small
  form with submit-to-add + a disabled-when-empty button. +2 tests (917 total).
  Backend-agnostic (localStorage), so it works on a Reborn v2 backend.

## v0.4.64 — The Desk: "Needs you" nav badge (increment 5) (2026-05-29)

- **The Desk (increment 5 — ambient signal)**: the Desk sidebar nav row now
  shows a gold "Needs you" count badge (and collapsed-state corner dot) when an
  approval gate is pending, sourced from `rebornDesk.gateCards.length`. This
  surfaces the agent's "I'm blocked, decide for me" moment app-wide without
  opening the Desk — the proactive-CoS signal. Open loops are deliberately not
  counted so the badge stays a quiet "act now" cue rather than always-on. Wired
  through the existing Sidebar badge system (new `'desk'` BadgeKey + `deskBadge`
  derived + gold `dotColorClass` + pill). Sidebar snapshot unaffected (no gate
  pending in the no-op state). 915 tests green.

## v0.4.63 — The Desk: command-palette entry (increment 4) (2026-05-29)

- **The Desk (increment 4 — discoverability)**: added "The Desk" → `/desk` to
  the Cmd+K command palette's Navigate list (top entry), so the home surface is
  reachable from the universal launcher, not just the sidebar. Small, safe,
  backend-agnostic. 915 tests green.

## v0.4.62 — The Desk: "Open loops" commitments section (increment 3) (2026-05-29)

- **The Desk (increment 3 — open loops)**: added an "Open loops" section to
  `RebornDeskPanel` surfacing tracked commitments from the existing open-loops
  store (R100) as cards with **Done** (resolve) and **Dismiss** actions. This
  is the research's #1 differentiator (commitment tracking) and is
  backend-agnostic — the open-loops store is localStorage-backed, so it works
  on a Reborn v2 backend (unlike a v1-routines feed would). The section renders
  only when there are active loops (stays calm/bounded otherwise). Exported
  `OpenLoopStore` for dependency injection; the `RebornDesk` store gained
  `loopCards` + `resolveLoop`/`dismissLoop`, with the loop store injectable for
  tests. +5 unit/render tests (915 total). _Note: the v1-sourced "while you
  were away" feed was deferred — routines/jobs are v1-only and don't exist on a
  Reborn backend; open loops were the more v2-coherent next increment._

## v0.4.61 — The Desk: route + sidebar nav (increment 2) (2026-05-29)

- **The Desk (increment 2 — reachable)**: added a `/desk` SvelteKit route
  (`src/routes/desk/+page.svelte`) mounting `RebornDeskPanel`, plus a **"Desk"**
  sidebar nav entry (shield glyph) placed at the top of the rail as the
  chief-of-staff home. No digit shortcut (0–9 are taken); reached via the
  sidebar (and, in a later increment, the command palette). Regenerated the
  Sidebar snapshot for the new row. 912 tests green.

## v0.4.60 — The Desk: approval-gate inbox (chief-of-staff home, increment 1) (2026-05-29)

- **New surface — "The Desk"**: the start of a channel-first, proactive
  chief-of-staff home, chosen via deep research (3 agents) + the NEAR AI
  All-Hands direction (channel-first/agentic, organizational intelligence,
  design-as-moat, non-technical users). Rather than a reactive chat log, the
  Desk is a priority-sorted feed of cards you act on. **Increment 1 is the
  "Needs you" approval-gate inbox** — the differentiated, Reborn-unique moment
  (the agent _paused and is waiting for your decision_), which had no dedicated
  home before (gates only resolved inline mid-chat). New `reborn-desk.svelte.ts`
  store (derives gate cards from the live `RebornChatController`'s projection
  `pendingGate`; `approve`/`deny` delegate to `resolveGate`) + `RebornDeskPanel.svelte`
  (gate cards with Approve/Deny + a calm "you're all caught up" empty state).
  Controller/desk are injectable for tests. +8 unit/render tests (912 total).
  Additive — not yet routed/landed; next increments add the route + nav, the
  "while you were away" activity feed, open-loop commitments, and make it the
  default landing surface.

## v0.4.59 — Settings: API-version selector + live-verified v2 round-trip (2026-05-29)

- **Reborn migration (step 8 — Settings control)**: added an "API version" card
  to `/settings` (per active profile) with Reborn WebChat v2 (default) vs legacy
  v1 radios, wired through the existing `patchActiveProfile`. This is how a
  profile is pointed at a Reborn server (set v2 + a base URL like
  `http://127.0.0.1:3000` + token) or opted back to v1 — no more hand-editing
  `settings.json`. The card clarifies that the other surfaces (Skills/Logs/
  Knowledge/Routines) always use v1.
- **Live-verified** the full v2 round-trip against a local `ironclaw_reborn_cli`
  server: createThread → sendMessage → projection lifecycle
  (`queued`→`running`→`completed`, lowercase as the reducer expects) → terminal
  success → timeline refetch → assistant reply rendered. Confirmed the SSE wire
  shape (named `event:` line + frame-body `data:`) matches the v0.4.56 decode
  fix.

## v0.4.58 — Reborn v2 is now the default chat path (2026-05-29)

- **Reborn migration (step 7 — the switch)**: the chat surface now defaults to
  IronClaw Reborn WebChat v2. `+page.svelte` mounts `RebornChatPanel` when
  `connection.apiVersion === 'v2'`, falling back to the legacy v1 stream +
  composer only for a profile explicitly set to `'v1'`. The `apiVersion`
  default flipped from `'v1'` to `'v2'` across `defaultProfile`, both
  `migrateLoaded` branches, `validateImportedSettings`, and the connection
  store's derived — so existing profiles (no field on disk) and new ones both
  speak v2; an explicit `'v1'` is the only opt-out. `RebornChatController.loadTimeline`
  is now resilient (a 404 on an unknown/cross-backend thread id degrades to an
  empty thread instead of throwing out of the mount effect). Other surfaces
  (Skills/Logs/Knowledge/Routines/etc.) are unchanged. Settings tests updated
  for the new default (904 tests green).
- **Note**: v2 only implements chat — point a profile at a running
  `ironclaw_reborn_cli` server (e.g. `http://127.0.0.1:3000`, token
  `local-dev-token`) for the chat to function; against a v1-only gateway the
  panel shows an empty thread.

## v0.4.57 — Reborn v2 chat panel component (2026-05-29)

- **Reborn migration (step 6 — chat UI)**: new `RebornChatPanel.svelte` — a
  self-contained WebChat v2 chat surface, deliberately isolated from the large
  v1 chat body in `+page.svelte`. It mounts the `RebornChatController` (binding
  to a `threadId` prop: reset + `loadTimeline` + `openStream` on switch, teardown
  on destroy), renders the projection message stream (user / assistant via
  `MarkdownView` / system / tool-activity / error bubbles + a typing indicator),
  shows an approval gate banner (Approve/Deny → `resolveGate`), and provides a
  composer with Enter-to-send and a Stop button that cancels the active run.
  The controller is injectable (defaults to the singleton) for testability.
  +5 render tests in `RebornChatPanel.test.ts` (904 total). Additive — the chat
  route doesn't mount it yet (next step flips the chat to v2).

## v0.4.56 — Reborn migration: codex review fixes (2026-05-29)

- **Reborn migration (step 5 — codex review fixes)**: an independent codex
  review of the cumulative migration diff (before wiring the chat surface)
  surfaced five issues, all fixed:
  - **(HIGH) SSE decode contract**: `streamWebChatV2Events` assumed `data:` was
    a full `{type, frame}` envelope. The Reborn runtime (per its own SPA's
    `useSSE`) names the frame type on the `event:` line and puts the frame
    _body_ in `data:`. The decoder now reconstructs `{ type: body.type ?? <event
    name>, frame: body }`, so named frames like `event: projection_update` are
    no longer dropped. Fixed the transport test's wire shape + added a
    named-event and a default-channel test.
  - **(HIGH) token leak**: a failed SSE open put the full `?token=…` URL into
    `HttpError`; now uses the token-free path in the error/log surface.
  - **(MEDIUM) typed gates**: `reduceEvent` now handles the scaffolded
    `gate` / `auth_required` event variants (ported from the SPA's
    `gateFromEvent` — `auth_request_ref` maps to the gate-ref slot; correlates
    to the latest run when the prompt omits `turn_run_id`).
  - **(MEDIUM) thread binding**: `RebornChatController.send(content, threadId)`
    now binds `this.threadId` for the explicit-id path (not just on
    auto-create), and `loadTimeline` binds it too, so `resolveGate`/`cancel`
    can't target a stale thread.
  - **(MEDIUM) reset**: `reset()` clears `threadId` so a "new chat" send can't
    post into the previous thread.
  - +7 unit tests across `reborn.test.ts`, `reborn-transport.test.ts`,
    `reborn-chat.test.ts` (899 total).

## v0.4.55 — Reborn v2 chat controller (2026-05-29)

- **Reborn migration (step 4 — chat controller)**: new
  `src/lib/stores/reborn-chat.svelte.ts` — the v2 counterpart to the v1
  `messages.svelte.ts` store, kept separate so the live v1 chat path is
  untouched. `RebornChatController` owns the reactive `RebornChatState` and
  drives the projection-driven flow over the `*V2` transport: `send`
  (auto-creates a thread on first message, pushes an optimistic user bubble,
  records the active run), `openStream` (folds SSE envelopes through
  `reduceEvent` and refetches the timeline on terminal run success — Reborn
  doesn't stream assistant replies), `loadTimeline`, `resolveGate`, and
  `cancel`. The IronClaw client is injected via a constructor getter
  (defaulting to `connection.client`) so the orchestration is unit-testable
  without the connection store. +9 unit tests in `reborn-chat.test.ts`
  (thread auto-create, optimistic bubble, send-failure path, terminal→refetch
  wiring, running≠refetch, gate resolve, cancel, timeline projection).
  Additive — no surface mounts the controller yet.

## v0.4.54 — Per-profile API-version flag (2026-05-29)

- **Reborn migration (step 3 — connection gate)**: added an optional
  `apiVersion: 'v1' | 'v2'` to `ProfileConfig` (`settings.svelte.ts`) so the
  Reborn WebChat v2 path can be selected per-profile without disturbing
  existing v1 profiles. The field is opt-in and defaults to `'v1'` everywhere:
  `defaultProfile`, both `migrateLoaded` branches, and `validateImportedSettings`
  narrow leniently (anything that isn't exactly `'v2'` → `'v1'`, no rejection —
  mirrors the `tint` forward-compat precedent), so every on-disk file without
  the field round-trips unchanged. The connection store exposes a reactive
  `apiVersion = $derived(activeProfile.apiVersion ?? 'v1')` for the chat surface
  to branch on. +6 unit tests (3 migrate defaults/narrowing, 3 import-validator)
  in `settings.test.ts`. The user's live v1 backend (baremetal3) is untouched;
  v2 only activates on a profile explicitly marked `'v2'`.

## v0.4.53 — Reborn WebChat v2 transport methods (2026-05-29)

- **Reborn migration (step 2 — transport)**: grafted the WebChat v2 transport
  onto `IronClawClient` in `src/lib/api/ironclaw.ts`, reusing the existing
  `request()`/`parseSseStream()` plumbing (Tauri-http-plugin fetch + bearer
  auth + the manual SSE parser) so the connection store needs zero new wiring —
  the same derived `client` now speaks both v1 and v2. New methods:
  `createThreadV2`, `listThreadsV2`, `sendMessageV2`, `fetchTimelineV2`,
  `cancelRunV2`, `resolveGateV2`, and the `streamWebChatV2Events` SSE generator
  (yields `WebChatV2EventFrame` envelopes for `reduceEvent`). Every mutating
  call injects a fresh `client_action_id` idempotency key; the stream carries
  the token both as a `?token=` query param and a bearer header. +16
  wire-contract unit tests in `reborn-transport.test.ts` (path, method, query
  string, idempotency-key injection, body shape, SSE decode, open-failure) plus
  an exported `buildV2Query` helper. Purely additive — no caller yet, so
  existing behavior is unchanged.

## v0.4.52 — IronClaw Reborn WebChat v2 client core (2026-05-29)

- **Reborn migration (foundation)**: new pure module `src/lib/api/reborn.ts` —
  the WebChat v2 client contract, reverse-engineered from the
  `reborn-integration` SPA (`crates/ironclaw_webui_v2_static`) and validated
  live against a local `ironclaw_reborn_cli --features webui-v2-beta` server.
  Covers the full `/api/webchat/v2/*` surface: DTO types (create/list threads,
  send message, timeline, cancel, gate-resolve, extension setup), the
  `client_action_id` idempotency-key helper, the timeline→message + tool-card
  mappers, and the projection/event reducer (`applyProjectionItems`,
  `reduceEvent`) that drives the local-dev `projection_snapshot`/`_update`
  stream — including the "refetch the timeline on terminal run success" rule
  (Reborn doesn't stream assistant replies). +23 unit tests in `reborn.test.ts`;
  no production wiring yet, so existing behavior is unchanged. Foundation for
  migrating the desktop client off the v1 `/api/chat/*` gateway.

## v0.4.51 — IronClaw SSE/normalizer parser coverage (2026-05-29)

- **Test coverage**: first tests for the pure parsing/mapping helpers at the
  heart of the chat stream in `src/lib/api/ironclaw.ts`. Six previously
  module-private helpers are now exported (zero behavior change) and covered by
  +22 unit tests in `ironclaw-parsers.test.ts`: `parseSseFrame` (event field,
  multi-line `data:` join, single-leading-space strip, comment/`id`/`retry`
  ignore, empty-vs-null frames); `findFrameEnd` (LF-LF, CRLF-CRLF, earliest of
  both, no-delimiter); `sinceToPeriod` (hour/day/week/month/year buckets +
  future-clamp + unparseable→undefined, via fake timers); `normalizeLogLevel`
  ("warning"→warn, case-insensitive canonical levels, nullish/numeric→info);
  `mapRunStatus` (completed→success, running, else→failed); and
  `mapExtensionKind` (channel/mcp/oauth collapse + lowercased passthrough +
  empty→undefined). The larger Responses/`normalizeEvent` switches are left for
  a follow-up.

## v0.4.50 — window-focus tracker coverage (2026-05-29)

- **Test coverage**: first tests for the window-focus tracker
  (`src/lib/stores/window-focus.svelte.ts`), which gates OS-notification firing
  so alerts only surface when the user isn't already looking at the app. +6
  unit tests for the event-driven logic: `init()` seeds `focused` from
  `document.hasFocus()`; window `blur`/`focus` events flip it; a hidden document
  (`visibilitychange`) counts as unfocused and a re-shown+focused document
  restores it; `dispose()` detaches the listeners; and `init()` is idempotent (a
  second call doesn't re-seed). Drives real DOM events and spies
  `document.hasFocus` / `visibilityState`. No production code changed.

## v0.4.49 — reply-thread UI store coverage (2026-05-29)

- **Test coverage**: first tests for the reply-thread UI-state singleton
  (`src/lib/stores/reply-thread-ui.svelte.ts`, R80 — tracks which message's
  reply panel the chat surface is showing). +4 unit tests: starts closed;
  `open()` records the parent message + thread id and flips `isOpen()` true;
  `open()` overwrites a previously open panel; `close()` clears both fields. No
  production code changed.

## v0.4.48 — toast store coverage (2026-05-29)

- **Test coverage**: first tests for the app-wide `toasts` singleton
  (`src/lib/stores/toasts.svelte.ts`). +8 unit tests driving the public API
  with fake timers: `show()` appends a toast with the returned id and the
  default "info" kind (or an explicit kind) and accumulates multiple toasts in
  order with distinct ids; `dismiss()` removes the matching toast (and is a
  no-op for an unknown id); the auto-dismiss timeout fires after
  `AUTO_DISMISS_MS` but not before; and `clear()` empties the queue and cancels
  pending timers so a stale timeout can't resurrect a toast. No production code
  changed.

## v0.4.47 — conversation-export helper coverage (2026-05-29)

- **Test coverage**: first tests for the pure export-formatting helpers in
  `src/lib/api/files.ts` (R4b / R61 / R87 — conversation export). +15 unit tests
  covering the deterministic builders that previously had none:
  `sanitizeFilenameStem` (clean pass-through, OS-hostile run collapse,
  whitespace collapse, empty/whitespace fallback, 80-char truncation);
  `todayStamp` zero-padded `YYYY-MM-DD`; `buildThreadJsonShape` /
  `buildThreadJsonText` (canonical field projection that drops `message_count`,
  message mapping, `exported_at` stamp, round-trippable 2-space JSON);
  `buildThreadMarkdown` (title heading + fallback, user/assistant/tool turn
  headings, trailing-divider trim + single trailing newline); and
  `buildThreadHtml` (non-trivial output containing the title, blank-title
  fallback). The IPC-coupled functions are left to integration. No production
  code changed; suite crosses 800 tests.

## v0.4.46 — runtime probe coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `src/lib/utils/runtime.ts` (R25-1 — Tauri IPC-gating probes). +10 unit tests:
  `inTauri()` tracks presence of `window.__TAURI_INTERNALS__`; `inTauriFully()`
  is true only when the internals expose a `transformCallback` **function**
  (false for absent internals, a partial dev shim, or a non-function value);
  `diagEnabled()` returns true in Vite dev mode and otherwise honours the
  `localStorage['ironclaw-diag'] === '1'` opt-in (false when unset or not
  exactly "1"). Drives the branches with a window-internals stub,
  `vi.stubEnv('DEV', …)`, and a Map-backed localStorage. No production code
  changed.

## v0.4.45 — NewProfileModal render coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `NewProfileModal.svelte` (R4a — "+ New profile" modal). +8 render tests
  covering the parts that don't drag connection internals: self-gates closed;
  renders the dialog with title + description when open; "Create profile" is
  disabled for an empty or whitespace-only name and enables once a valid name
  is typed; and Cancel / backdrop / Escape each fire `onClose`. The
  create-and-switch submit path (addProfile → switchProfile → goto) is left to
  the integration layer; `$app/navigation` is mocked. No production code
  changed. This drains the last clean small/medium untested component — the
  remaining untested components are the large composite surfaces and the
  telemetry-coupled `UpdaterBanner`.

## v0.4.44 — ResizeHandle behavior coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `ResizeHandle.svelte` (R14c — drag-to-resize pane splitter). +9 tests for the
  store-free, props-driven handle: renders a `role="separator"` with the
  WAI-ARIA splitter attrs (`aria-orientation`/`label`/`valuemin`/`valuemax`/
  `valuenow`); on mount reports the default width upstream, or the persisted
  width (clamped) when localStorage carries one, and stays silent when the
  parent passes `initialWidth`; double-click resets to the default and persists
  it; a primary-button drag reports the clamped live width via `onresize` and
  persists the final width on mouseup (toggling the `dragging` class); the
  width clamps to `max`; and a non-primary mousedown is ignored. Uses a
  Map-backed localStorage shim. No production code changed.

## v0.4.43 — SkillEditorModal render coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `SkillEditorModal.svelte` (R65 — inline skill editor). +14 render tests
  driving the `skillEditor` singleton's public `$state` (open/skill/draft/
  saving/error) and asserting its methods: self-gates closed; renders the
  dialog with a generic "Edit skill" title or "Edit skill — &lt;name&gt;" plus
  description when a skill is loaded; the dirty "\*" marker tracks draft-vs-
  script; the textarea binds to `draft`; the error banner shows only when
  `error` is set; Save disables + shows the "Saving…" spinner while `saving`;
  Save calls `skillEditor.save()`; and Cancel / header-close / backdrop /
  Escape all call `skillEditor.hide()`. Mocks the `Icon` child; spies the two
  store methods. No production code changed.

## v0.4.42 — PerThreadPromptModal render coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `PerThreadPromptModal.svelte` (R43 — per-thread system-prompt override editor).
  +13 render tests driving the modal off the `perThreadPrompts` + `toasts`
  stores: self-gates closed; renders the dialog + thread title (falling back to
  "Untitled thread"); pre-fills the textarea from the existing override; shows
  the live character count against `MAX_PROMPT_CHARS` and the over-limit warning;
  enables/disables "Reset to default" by `hasOverride`; Save persists a non-empty
  draft (`set` + success toast + `onChanged` + close); an empty draft routes
  through `clear` instead; Reset clears + info-toasts + closes; Cancel, backdrop
  click, and Escape all close. Spies the two sibling stores. No production code
  changed.

## v0.4.41 — ToolFlowPanel render coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested `ToolFlowPanel.svelte`
  (R42 — tool-call visualizer). +7 render tests over `toolFlow.forThread(threadId)`:
  empty state when no tools ran; a count badge plus one row per call; a pending
  call shows the in-progress label and "…" latency; latency formats sub-second
  ("23ms") vs multi-second ("1.5s") for done calls; expanding a done call reveals
  Args + Result; expanding a pending call shows "Running…"; expanding an error
  call shows the error message. Spies `toolFlow.forThread` to feed `ToolCall`
  fixtures. No production code changed.

## v0.4.40 — ChatTabs render coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested `ChatTabs.svelte`
  (R52 — Chrome-style chat tabs). +5 render tests driving the `chatTabs` store:
  self-gates with no open tabs; renders a `role="tab"` per open id with titles
  and the active `aria-selected`; clicking a tab calls `chatTabs.setActive` +
  emits `onSelect`; the per-tab close button calls `chatTabs.close` + emits
  `onClose(id, nextActive)`; the + button emits `onNew`. Drives the store
  `$state` directly and spies its methods. No production code changed.

## v0.4.39 — ReplayBar render coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested `ReplayBar.svelte`
  (R58 — time-travel replay controls). +9 render tests driving the bar off the
  `replay` store: self-gates to nothing with no events; renders the
  controls + `cursor / total` + scrubber bounds; play/pause toggles via
  `replay.play`/`replay.pause`; scrubbing calls `replay.scrubTo`; the speed
  buttons call `replay.setSpeed`; the "Live" affordance shows only when not at
  the end (and jumps to `total`); and the close button fires `onClose`. Spies
  the `replay` singleton's methods. No production code changed.

## v0.4.38 — BuildProvenanceBadge render coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `BuildProvenanceBadge.svelte` (R38 — build-kind provenance chip). +4 render
  tests drive the three build kinds via the `forced` prop (which skips the
  `build_provenance` IPC): public / support / dev each render the right label,
  `data-build-kind`, `data-signing`, and `aria-label`, and the chip title
  carries the signing + profile. No production code changed.

## v0.4.37 — ReplyThreadPanel render coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `ReplyThreadPanel.svelte` (R80 — Slack-style reply-thread side panel). +6
  render tests: the empty state + parent preview, rendering existing replies,
  lazy `load()` + `markRead()` on mount, the close button firing `onClose`,
  the Send button gated on draft content and posting via
  `replyThreads.post(parentId, threadId, content)`, and the long-parent
  preview truncation. Spies the `replyThreads` store and stubs `MarkdownView`.
  No production code changed.

## v0.4.36 — TokenSourceBadge render coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `TokenSourceBadge.svelte` (v0.2.9 — token-source provenance chip). +4 render
  tests drive the three present states via the `forcedSource` prop (which
  bypasses the IPC + poll timer): keychain / file-fallback / absent each
  render the right label, `data-source`, and `aria-label`, and `forcedSource`
  suppresses the loading flash. (Crosses 700 tests in the suite.) No
  production code changed.

## v0.4.35 — LightboxModal render coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `LightboxModal.svelte` (R19b — chat image lightbox). +6 render tests: the
  image wires up `src` and `alt`, `alt` falls back to "Preview", all three
  dismissal paths fire `onClose` (backdrop click, close button, Escape key),
  and clicking the image itself does NOT dismiss (stopPropagation). No
  production code changed.

## v0.4.34 — VoiceAnswerBar render coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `VoiceAnswerBar.svelte` (R51 — voice-answer status bar). +6 render tests:
  self-gates to nothing when disabled; when enabled shows the idle "Voice
  answer on" label with Stop + turn-off controls and `aria-live="polite"`;
  shows "Speaking…" while speaking; surfaces an error chip with the message as
  its title; Stop calls `voiceAnswer.stop()` and turn-off calls
  `voiceAnswer.setEnabled(false)`. Drives the real `voiceAnswer` singleton's
  fields and spies its methods. No production code changed.

## v0.4.33 — ModelPresenceStrip render coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `ModelPresenceStrip.svelte` (R83 — Council model-presence pills). +6 render
  tests for this zero-import, purely-presentational component: the empty-runs
  guard (renders nothing), the status→label mapping (pending→queued /
  streaming→thinking / done→ready / error→failed), the `label`→`providerId`
  fallback, done-only latency display, `aria-live="polite"` while streaming
  (else off), and the error message surfacing in the pill title. No production
  code changed.

## v0.4.32 — SubAgentChip render coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `SubAgentChip.svelte` (R57 — dispatched background-task chip). +6 render
  tests lock the status-driven branches: running/queued show the "working"/
  "queued" label and a cancel affordance (clicking it calls
  `subAgents.cancel(task.id)`); running renders streamed progress; succeeded
  hides cancel and toggles the result body via "View result"/"Hide result";
  failed shows the error and hides cancel. Spies the real `subAgents`
  singleton's `progressFor`/`cancel` (importing a sibling store is fine). No
  production code changed.

## v0.4.31 — CronPreview render coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `CronPreview.svelte` (R20b — inline human-readable cron description). +4
  render tests lock the three-way branch: empty/nullish/blank input renders a
  non-alert empty span; a valid expression renders the gold preview with a
  `title` and the calendar icon (spot-checking `0 9 * * *` → "Every day at
  9:00 AM"); an invalid expression renders an accessible `role="alert"` with
  `aria-label="Invalid cron expression"`; and the optional `classes` prop is
  appended. (Human text itself is covered by `cron.test.ts`.) First pass of
  the untested-component coverage vein now that the store vein is drained. No
  production code changed.

## v0.4.30 — Gate find-in-thread version bump behind searchOpen (2026-05-29)

- **Performance (audit R200 P1)**: the chat `contentVersion` effect bumped a
  counter on every streaming token (every `history`/`streamingBuffer`/
  `isStreaming` change) even when the find-in-thread bar was closed.
  `ChatSearch` is the only reader of `contentVersion` and only mounts while
  `searchOpen`, so the bump was wasted reactivity on the streaming hot path.
  Gated the effect on `searchOpen` (early-return when closed): while closed it
  only tracks `searchOpen`, so streaming tokens no longer churn it; when the
  bar opens the effect re-runs, re-subscribes to the deps, and resumes
  bumping, and ChatSearch runs its own initial scan on mount — so no find
  result is missed. Behavior-preserving while the bar is open (full suite
  green, no test changes).

## v0.4.29 — Replay-UI store coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `replay-ui.svelte.ts` (R58 — time-travel replay bar visibility). +7 tests
  lock the per-thread open flags (`isOpenFor` null-safe, `open`/`close`/`toggle`
  tracked independently across threads) and the persisted speed preference
  (`readSpeed` defaults to 1 on missing input and round-trips a positive value,
  falling back to 1 for invalid / zero / negative stored values). No production
  code changed.

## v0.4.28 — Sign-in state-machine coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `sign-in.svelte.ts` (R5d/R44 — NEAR.AI sign-in detection). +9 tests lock
  `refresh()`'s mapping of `getProfile()` outcomes onto the coarse status:
  no client → `unknown`; null → `signed-out` (with the "Signed out" toast
  only on a signed-in→signed-out transition); a profile → `signed-in` with the
  account-label fallback chain (`near_account` → `display_name` → `user_id` →
  "NEAR.AI") and no re-toast when already signed in; a thrown error →
  `error` + `lastError`; the inflight guard collapsing concurrent refreshes;
  and `reset()` clearing back to a clean slate. Overrides the real
  `connection.client` getter and spies `toasts.show`. No production code
  changed.

## v0.4.27 — Surface-refresh registry coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `surface-refresh.svelte.ts` (R24a — the Cmd+R per-surface refresh registry).
  +6 tests lock the contract: `invoke()` returns false when nothing is
  registered and true when a handler ran, `register` is last-registration-wins,
  `unregister` clears the slot, async handlers are awaited, and a throwing
  handler is swallowed (logged) while `invoke()` still resolves to true — so
  Cmd+R can never crash the app. No production code changed.

## v0.4.26 — Cross-window broadcast bus coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `broadcast.svelte.ts` (R17a — the `BroadcastChannel` cross-window state-sync
  bus). +8 tests stub the global `BroadcastChannel` with a controllable fake
  and lock the lifecycle (`init` opens one channel + is idempotent; `teardown`
  closes it), `send` (no-op before init, stamps `senderId`, posts the wire
  message), the unavailable-`BroadcastChannel` no-op path, and the
  loop-prevention guards in `handle()` (self-sent and malformed messages are
  ignored, a foreign message is handled without throwing or echoing back). No
  production code changed.

## v0.4.25 — Sidecar log ring-buffer coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `sidecar-logs.svelte.ts` (R26 — the sidecar stdout/stderr bridge). +7 tests
  cover both regimes: outside the Tauri webview every method is a safe no-op
  (init does no IPC, clear empties only the local mirror), and inside a faked
  Tauri webview `init()` backfills via the `get_sidecar_logs` IPC, attaches
  the `sidecar:log` listener, the live listener appends, the MIRROR_CAP ring
  prune drops the oldest line, `clear()` issues `clear_sidecar_logs`, and
  `teardown()` detaches the listener. Mocks `@tauri-apps/api/core` + `/event`
  (third-party modules — safe to mock, unlike sibling `.svelte.ts`). No
  production code changed.

## v0.4.24 — Per-thread model tracker coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `thread-model.svelte.ts` (R41 — the localStorage-backed threadId→providerId
  map behind the chat header's provider chip). +8 tests lock `setProvider`
  (records + persists as a flat object, trims whitespace, ignores
  empty/whitespace/non-string providers and empty threadIds, write-last-wins,
  no-op preserving the Map reference when unchanged), `getProvider`/`has`, and
  `init()` (hydrates from localStorage, `coerceLoaded` drops invalid rows,
  idempotent). No production code changed.

## v0.4.23 — Activity-stream store coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `streams.svelte.ts` (R81 — the client-side activity-feed aggregator that
  federates threads + routines + skills). +6 tests lock `setFilter`,
  `filtered()` (all vs per-kind), and `load()`: the no-client early return,
  the already-in-flight guard, the merge + newest-first sort (with the
  epoch-0 skill sentinel sorting last, routines without a `last_run` filtered
  out, empty thread titles falling back), and the `allSettled` resilience
  (one failing source is dropped without surfacing an error). The test
  overrides the real `connection.client` getter rather than mocking the
  sibling `.svelte.ts` module (which interferes with the rune transform). No
  production code changed.

## v0.4.22 — Workspace Presets store coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `presets.svelte.ts` (R20a/R115 — capture/restore layout snapshots). +10
  tests lock `save` (captures pane widths + sidebar/statusbar toggles +
  current thread from localStorage/live stores, name trim/"Untitled"
  fallback, newest-first), `rename` (no-op on unknown id and unchanged
  name), `delete`, and `apply` (writes the widths back to localStorage,
  applies the tray-badge + thread-selection setters, navigates via `goto`,
  and errors without navigating on an unknown id), plus the `presetsModal`
  singleton. Mocks `$app/navigation` and spies the cross-store setters. No
  production code changed.

## v0.4.21 — Prompt Templates store coverage (2026-05-29)

- **Test coverage**: first tests for the previously-untested
  `templates.svelte.ts` (R29c — saved composer prompts recalled by chord /
  palette / slash autocomplete). +16 tests lock the pure, load-bearing
  logic: `parseVariables` (ordered, de-duped, ignores non-`\w` braces),
  `add` (name trim to 80 / "Untitled" fallback, variable parse, newest-first
  ordering, MAX_TEMPLATES rollover dropping the oldest), `update` (re-derives
  variables on body change, no-op for unknown id and unchanged patch),
  `delete`, `recordUse`, and `render` (single-pass substitution leaving
  unknown vars intact). Also covers the `templatesModal` and `composerInsert`
  one-shot bus singletons. No production code changed.

## v0.4.20 — CouncilPanel render coverage (2026-05-29)

- **Test coverage**: render smoke tests for the previously-untested
  `CouncilPanel.svelte` (R40/R91 — the Council fanout overlay summoned from
  the chat composer). +5 tests cover the self-gating render (closed →
  nothing), the open layout (header, 2–4 model hint, prompt textarea), the
  on-open `$effect` seeding the textarea from `council.initialPrompt`, the
  Convene button being disabled with no prompt/selection, and close-to-
  dismiss. Completes render coverage of the Council surface (column +
  panel). No production code changed.

## v0.4.19 — CouncilColumn render coverage (2026-05-29)

- **Test coverage**: render smoke tests for the previously-untested
  `CouncilColumn.svelte` (R40 — one column in the Council fanout grid). +8
  tests lock all four run lifecycle states (pending spinner / streaming
  first-tokens / error fallback / done), the latency footer formatting
  (sub-second "ms" vs multi-second "Xs"), and the promote-button gate
  (disabled until the run is done with non-empty content; click fires the
  callback). No production code changed.

## v0.4.18 — GlobalSearch highlight precompute (2026-05-29)

- **Performance (audit R200 P2)**: GlobalSearch now precomputes its
  substring-highlight segments once per query in a derived `decoratedGroups`
  view, instead of calling `highlight()` three times (label + subtitle +
  snippet) per visible row on every render. The hot list path — arrow-key
  navigation and hover, which only change the active index — no longer
  re-segments every row's three lines. Row IDs and ordering are preserved, so
  keyboard-nav indices still line up; behavior-preserving (search tests pass
  unchanged). Unblocked by the v0.4.15 `highlight` util extraction.

## v0.4.17 — RecapPanel render coverage (2026-05-29)

- **Test coverage**: render smoke tests for the previously-untested
  `RecapPanel.svelte` (R89 thread recap). +8 tests lock the three body states
  (summarizing / error / summary), the R92 stats strip (message count, token
  estimate, and the time-span that's hidden when `spanMs` is 0), the
  no-stats path, and that the close button dismisses the panel. Mirrors the
  BriefingPanel/Triage/Draft/ExtensionCard render-test pattern; no production
  code changed.

## v0.4.16 — Extracted + tested command-palette scorer (2026-05-29)

- **Simplification + coverage (audit R200 P2)**: extracted CommandPalette's
  inline tiered match scorer (`scoreMatch`: prefix > substring > subsequence)
  to a tested pure util (`src/lib/util/command-score.ts`). Behavior-preserving
  move; +6 unit tests cover the tier ordering, gap penalties, and no-match
  cases — locking previously-untested ranking logic.

## v0.4.15 — Extracted + tested highlight util (2026-05-29)

- **Simplification + coverage (audit R200 P2)**: extracted GlobalSearch's
  inline substring-`highlight` segmenter to a tested pure util
  (`src/lib/util/highlight.ts`) — behavior-preserving move that locks the
  fiddly [pre, match, post] splice logic with +7 unit tests and makes it
  reusable (CommandPalette / Omnibar can adopt it). Sets up the eventual
  per-row precompute without touching the render path yet.

## v0.4.14 — Guard coverage across CoS stores (2026-05-28)

- **Test coverage**: mirrored the v0.4.13 deterministic stale-stream guard
  test onto the Triage and Draft stores, so the R106 P1 abort guard is now
  regression-locked across all three Chief-of-Staff streaming surfaces
  (Brief, Triage, Draft). +2 tests.

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
