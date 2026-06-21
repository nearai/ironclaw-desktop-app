# Workbench MCP Data Delivery — Build State (2026-06-20)

Autonomous day-long build. Goal: populate the Workbench with REAL MCP data
(Composio: Gmail/Calendar/Drive/Notion/Slack/GitHub) the SECURE way, restore the
v13 design, validate with real data. No commits/pushes. No fake/hardcoded data.

## Decisions (locked)
- **Delivery = in-gateway read-only connector route** (NOT a local bridge — a bridge
  is a second key-holder + unguarded localhost inbox-reader + bypasses gates/audit).
- The Composio key lives ONLY in IronClaw's encrypted credential store (bound via
  the setup flow). The keychain copy I briefly made was DELETED.
- Run a locally-built route-enabled sidecar for dev/verify; do NOT swap the app's
  shipped binary (the source tree is WIP + 3 weeks behind → regression risk).

## Proven facts (first-hand, live)
- Composio API v3 base `https://backend.composio.dev/api/v3`, header `x-api-key`.
- The user's Composio key (provided in chat) is BOUND + PERSISTED in IronClaw:
  `POST /api/webchat/v2/extensions/composio/setup {action:'configure'|'submit',
  payload:{secrets:{composio_api_key:<KEY>}}}` → `provided:true`; then
  `POST /api/webchat/v2/extensions/composio/activate` (empty body) → composio
  `auth=true active=true state=active`.
- Connected accounts (ACTIVE) for entity `user_id=pg-test-1e5425b4-7e40-4f5f-96b4-b513aa951a30`:
  gmail, googlecalendar, googledrive(x2), googledocs, notion, slack, github (attio EXPIRED).
- Real inbox fetched deterministically:
  `POST /api/v3/tools/execute/GMAIL_FETCH_EMAILS {arguments:{max_results,query:'in:inbox'}, user_id:'pg-test-...'}`
  → 200, real messages (The Information, a16z crypto, MetaLeX, github-actions, …).
- Tool slugs: `GMAIL_FETCH_EMAILS`, `GMAIL_FETCH_MESSAGE_BY_*`, `GMAIL_LIST_THREADS`,
  `GOOGLECALENDAR_*` (events list/find), etc. Read-only allowlist target:
  `*_FETCH_*`, `*_LIST_*`, `*_GET_*`, `connected_accounts`.

## Why the agent path is NOT the delivery
- No REST tool-invoke route on the sidecar (all /tools,/mcp,/composio 404) — MCP
  data only flows through the LLM agent runtime (threads→runs→timeline).
- Agent runs are flaky headless (turns stop processing; composio capability is
  `default_permission:"ask"` → blocks on a gate with no UI to resolve) and are
  slow/costly/non-deterministic — wrong for an always-on dashboard.
- Hybrid plan: deterministic route for the ambient "what needs me" surface; the
  agent path stays for the open-ended command box (in-boundary, gated).

## Build environment (de-risked)
- Reborn source: `/Users/abhishekvaidyanathan/Documents/Playground/ironclaw`
  (workspace, ~70 crates). HEAD `1d7f5e306` (2026-06-01), 404 behind origin/main,
  **44 tracked-modified files (WIP — do NOT reset/clobber)** incl. turn_runner.rs,
  text_loop_driver.rs, model_gateway.rs (agent-runtime WIP).
- Toolchain: rustc/cargo 1.93.1. Builds: `cargo build -p ironclaw_reborn_cli
  --features webui-v2-beta` → `target/debug/ironclaw-reborn` (incremental ~42s).
- Sidecar boot recipe (env): NEARAI_API_KEY (from keychain
  `security find-generic-password -s com.openclaw.ironclaw-desktop -a llm-nearai:default -w`),
  IRONCLAW_REBORN_WEBUI_TOKEN=GATEWAY_AUTH_TOKEN=<token>, GATEWAY_HOST/PORT,
  DATABASE_BACKEND=libsql, GATEWAY_ENABLED=true, LLM_BACKEND=nearai, NEARAI_MODEL=auto.
  Default profile `~/.ironclaw/reborn/local-dev` (has composio key bound + active).

## Route design (in `ironclaw_webui_v2` + facade)
- Routes register in `crates/ironclaw_webui_v2/src/router.rs` (`webui_v2_router`),
  handlers in `handlers.rs`, patterns in `descriptors.rs`. Handlers get
  `WebUiV2State { services: Arc<dyn RebornServicesApi> }`. Facade is in
  `crates/ironclaw_product_workflow/src/reborn_services.rs` (exposes setup_extension,
  threads/messages/timeline/gate — NO tool-execute yet).
- Plan: add `POST /api/webchat/v2/connectors/read {toolkit, tool, arguments}` →
  handler → new `RebornServicesApi::connector_read` → resolve `composio_api_key`
  from secrets → call Composio REST (read-only allowlist) → structured JSON.
  Reuse the Composio client in `crates/ironclaw_first_party_extensions` (composio).
- Read-only enforced server-side; writes never go through this route (stay on the
  gated agent path). Same-origin + existing bearer auth applies (host composition).

## Frontend (desktop app repo: ironclaw-desktop-app-main, branch codex/workbench-overhaul-backend-loop)
- Workbench at `crates/ironclaw_webui_v2_static/static/js/pages/workbench/`.
- Wire a data adapter (lib/api.js: `connectorRead`) → rail/cards/source-readiness.
- v13 visual restore per `docs/design/workbench-v13-fidelity-spec-2026-06-20.md`
  and `workbench-restoration-plan-2026-06-20.md` (branding, theme toggle, Memory
  nav, accent Ask, rich cards, dense rail). v13 design tokens: accent #1c63d6,
  serif display "Newsreader", rail #13181f. Screenshots: /tmp/wb-compare-070449/.

## Route status (agent-built, in reborn repo)
- Routes added: `GET /api/webchat/v2/connectors/connected`, `POST /api/webchat/v2/connectors/read`
  (read-only allowlist `^[A-Z0-9]+_(FETCH|LIST|GET|SEARCH)_`; behind existing bearer/same-origin auth).
- Build GREEN. Allowlist VERIFIED (`GMAIL_SEND_EMAIL` → 400). Key resolved server-side, never exposed.
- New files: `crates/ironclaw_reborn_composition/src/connectors.rs` (ComposioConnectorPort),
  `crates/ironclaw_product_workflow/src/reborn_services/connectors.rs`; edits to webui_v2
  router/handlers/descriptors, composition factory/runtime/webui, + one additive boot fix
  (`crates/ironclaw_extensions/src/v2.rs`: `#[serde(default)] provider_scopes`).
- OPEN: key-resolution 503 — `resolve_api_key` doesn't find a `configure`-bound `composio_api_key`
  (scope mismatch vs where setup/configure writes it / how the composio WASM host injects it).
  Fix agent in flight to align the route's resolution scope to the extension's. Verify script:
  `COMPOSIO_KEY=… node /tmp/test-route-fresh.mjs` (fresh profile → real inbox via route).
- Real-profile boot blocked by manifest-hash skew (June-1 build vs June-19 profile) → use fresh
  profile for verify; for the real desktop app the route ships via official build.

## Frontend (desktop app repo)
- Adapter added (additive): `lib/api.js` → `connectorsConnected()`, `connectorRead({toolkit,tool,arguments})`.
- Proxy harness: `scripts/workbench-live-proxy.mjs` (serve static + proxy /api → route sidecar, bearer injected).

## Key-resolution fix (DONE)
Root cause: `setup {action:configure}` persisted nothing (hit `unsupported_extension_auth_configure_projection`; dev binary uses InMemorySecretStore). Fix: intercept composio configure in `setup_extension` → write `composio_api_key` through `ComposioConnectorPort` at the SAME owner scope (`local_default(owner)`) the read path uses, so write/read can't drift. Files: `reborn_services/connectors.rs` (configure_secrets on ConnectorReadPort), `composition/connectors.rs` (impl), `reborn_services/lifecycle_setup.rs` (try_configure_composio_secrets), `reborn_services.rs` (setup_extension intercept). Build green; allowlist intact.

## END-TO-END PROVEN (real data)
- Route sidecar (`target/debug/ironclaw-reborn`) on fresh profile + composio key configured server-side returns REAL data:
  `/connectors/connected` → gmail/googlecalendar/googledrive/googledocs/notion/slack/github ACTIVE;
  `/connectors/read GMAIL_FETCH_EMAILS` → real inbox; `GMAIL_SEND_EMAIL` → 400.
- LIVE DEV ENV (keep-alive): sidecar port 4900 token `wbdev` (`/tmp/wb-dev-sidecar.mjs`, fresh HOME `/tmp/wb-dev-home`, InMemory store → re-configure key on restart) + proxy port 1474 (`scripts/workbench-live-proxy.mjs`, injects bearer, key stays server-side). Browser: `http://127.0.0.1:1474/v2/workbench?token=wbdev`. Real inbox confirmed THROUGH the proxy.
- NOTE: if sidecar restarts, re-`configure` the composio key (InMemory). Real-app build uses a persistent store + the user's real binding.

## DONE — Workbench renders REAL data + v13, verified
Frontend (desktop app repo): new `lib/workbench-connectors.js` (+test), `hooks/useWorkbenchConnectors.js`
(resilient React-Query: useConnectedAccounts/useConnectorInbox/useConnectorCalendar), `components/workbench-arrived.js`;
wired into workbench-page/shell/command; v13 restore (theme toggle, Memory nav, branding, accent Ask, dense rail,
serif display); fixtures+spec updated with /connectors mocks + 3 new tests.
Verified via direct URL `http://127.0.0.1:1474/v2/workbench?token=wbdev` (proxy MIME bug fixed):
- Source readiness: Gmail/Calendar/Drive/Notion/Slack "Ready · via Composio" (real ACTIVE accounts, honest).
- Arrived: REAL inbox (The Information / a16z crypto / More than Speculation / …) with UNREAD badges. Zero console errors.
- Screenshots: /tmp/wb-realdata-1781975411/, /tmp/wb-realdata-1781976063-final/, /tmp/wb-final-132741/workbench-live-real.png
Tests GREEN (independently re-run): node --check clean; 58 workbench unit; 35 workbench Playwright (incl. honesty tests:
"no Gmail hides Arrived, no console errors", "read failure degrades without fabricating mail"); agent also: 707 static, 104 a11y.

## How to run the live env (ephemeral; InMemory secret → re-configure key on sidecar restart)
1. `cd ~/Documents/Playground/ironclaw && COMPOSIO_KEY=<key> SIDECAR_PORT=4900 SIDECAR_TOKEN=wbdev node /tmp/wb-dev-sidecar.mjs &`
   (boots target/debug/ironclaw-reborn on a fresh HOME, configures composio key server-side)
2. `cd ~/Documents/Playground/ironclaw-desktop-app-main && SIDECAR_PORT=4900 SIDECAR_TOKEN=wbdev PORT=1474 node scripts/workbench-live-proxy.mjs &`
3. open `http://127.0.0.1:1474/v2/workbench?token=wbdev`
If /connectors/* → 503 after a restart, re-run step 1 (or curl POST /extensions/composio/setup {action:configure,...}).

## COMPLETE — Workbench shows real inbox + real calendar + real readiness (v13)
Final verified surface (`/tmp/wb-calendar-1781977869/workbench-full.png`): Gmail/Calendar/Drive/Notion/Slack
"Ready · via Composio"; "Arrived" real inbox (5 unread · 6 recent); "Upcoming" real calendar (6 next: "[ooo] Maggie"
Jun 22, "Legal Weekly", "NEAR AI Staff Leadership Weekly", "Strategy & Vision [Intents]"…); v13 chrome. Tests:
60 workbench unit + 37 Playwright; zero console errors live. NOTE: there are TWO read-only allowlists — server
`is_read_only_tool` (reborn `reborn_services/connectors.rs`) AND a CLIENT mirror `CONNECTOR_READ_TOOL_PATTERN`
(`lib/api.js`); BOTH had the infix-only bug and BOTH were fixed (accept read verb as any segment; reject writes
incl. FIND-but-also-write). Calendar needs `calendarId:'primary'` + `timeMin`+`timeMax` window (bare timeMin → 0 events).
New frontend files: `components/workbench-arrived.js` (Arrived + Upcoming + readiness), `hooks/useWorkbenchConnectors.js`,
`lib/workbench-connectors.js`.

## Allowlist fix + calendar (DONE)
The read-only allowlist (`is_read_only_tool` in `reborn_services/connectors.rs`) originally required the verb
right after the toolkit (`TOOLKIT_VERB_…`), so it wrongly rejected suffix-verb slugs (`GOOGLECALENDAR_EVENTS_LIST`)
and had no `FIND` → calendar reads 400'd. Rewrote it to a segment classifier: read-only iff a `_`-segment is a
READ verb (FETCH/LIST/GET/SEARCH/FIND/READ) AND no segment is a WRITE verb (SEND/CREATE/DELETE/UPDATE/INSERT/MOVE/
WATCH/…); real toolkit prefix; no empty segments. Tests: 3/3 (added calendar suffix-verb/FIND allows + write-with-LIST
rejects). Rebuilt; VERIFIED live via route: `GOOGLECALENDAR_EVENTS_LIST {calendarId:'primary', timeMin, singleEvents,
orderBy}` → real event ("[ooo] USA & Abhi"); Gmail still works; `GOOGLECALENDAR_EVENTS_INSERT` → 400. Calendar CARD
(frontend, today's events) being added by an agent against the live env.

## Follow-ons (non-blocking)
- Dock identity shows "NEAR AI Cloud" w/o name in dev proxy (currentUser.displayName empty there); upgrades when authenticated.
- Calendar hook (useConnectorCalendar) wired but not surfaced in a card yet — easy add under Arrived.
- Real desktop app: ship the connector route via the official reborn build (don't hand-swap the binary; source here is 3wk behind).
- Reborn route (in ~/Documents/Playground/ironclaw, uncommitted): connectors.rs (port), reborn_services + composition wiring,
  webui_v2 router/handlers/descriptors, +serde provider_scopes boot fix. Ship as a reviewable PR.

## Deterministic briefing — command box that actually works (DONE)
The freeform command box starts a Chat/agent thread (`useWorkbenchStart.startWorkbenchRequest` → `send(draft)`), which
needs the reborn agent runtime + a real NEAR AI session — NOT reproducible in the headless dev sidecar (and `/llm`+
`/extensions` 404 in the WIP-June-1 build; they mount from `product_auth_mount`/`public_mount` in
`ironclaw_reborn_composition::webui_serve::webui_v2_app`, not in `webui_v2_router`). So the highest-value catch-up intents
now answer **deterministically, in-browser, with no agent/model round-trip**, from connector data already in hand.
- `lib/workbench-briefing.js` — pure `isBriefingIntent(text)` (matches the short phrasings AND the verbose executive chip
  fills "Tell me what needs my attention today…" / "Summarize what changed since I was last here…") + `buildBriefing({inbox,
  calendar, railGroups, gmailReady, calendarReady})` → `{headline, counts, sources, replies, events, attention}`. Honest:
  counts.replies = unread only; empty inputs → "all clear"; nothing fabricated. `lib/workbench-briefing.test.mjs` (6 tests).
- `components/workbench-briefing.js` + `styles/briefing.js` (token-based, light+dark). Reply rows open the in-app reading
  panel (real full email via READ tool); calendar rows deep-link to Google Calendar; "Read-only · nothing sent" provenance.
- `workbench-page.js` wiring: `handleAsk` routes briefing intents (when Gmail OR Calendar live) to `runBriefing`, else
  falls through to the agent. Briefing renders above Decisions; dismiss × clears it.
- VERIFIED live (proxy 1474 → sidecar 4900, real account): "Catch me up" + "What needs me today?" → "Good afternoon.
  5 replies waiting and 5 events on your calendar." with 5 real Gmail rows + 5 real Calendar rows; reply→reader fetched a
  real 8021-char email; dismiss works; renders faithfully in BOTH dark (default) and v13-native light. 0 console errors.
  Guards: 725/725 static unit tests, token lint OK, frontend contract OK. (`preview_click` doesn't fire React's synthetic
  onClick — use native `.click()` in eval; theme/state reads are 1 tick behind a click.)
- Theme: app default is `dark` (index.html `ironclaw:v2-theme`), honoring the global preference; the v13 light palette is
  the toggle and renders faithfully. Not flipped to light-default (would change the whole app); offered as a choice.

## Find Slack blockers — on-demand real Slack read (DONE)
Second deterministic command, on-demand (not a cached poll): clicking "Find Slack blockers" runs ONE read-only
`SLACK_SEARCH_MESSAGES` (SEARCH segment passes the route guard), sorted by recency, and renders the real matches with a
deep link to each Slack thread. Honest framing: a keyword search the user judges, not an LLM verdict; nothing posted.
- `lib/workbench-slack.js` — `isSlackBlockerIntent` (requires "slack" + a block/stuck/unblock stem or "unanswered";
  leading-boundary stem so "blockers"/"blocked" match; does NOT collide with the briefing), `SLACK_BLOCKER_QUERY`,
  `normalizeSlackBlockers` (cleans `<@U…>`→@mention, `<url|label>`→label, float `ts`→human when; drops empty-text rows).
  `lib/workbench-slack.test.mjs` (6 tests).
- `hooks/useWorkbenchConnectors.js` — `slackReady` added to `useConnectedAccounts`; `useConnectorSlackBlockers({enabled})`
  fires only when latched. `components/workbench-slack-blockers.js` (loading/results/empty/error) + blocker styles in
  `styles/briefing.js`. `workbench-page.js` `handleAsk` routes slack-blocker intent FIRST (more specific than briefing),
  latches `slackBlockersActive`; panel renders above Decisions; dismiss clears it.
- **Slack-search quirk (important):** the SIX-term query "blocked OR blocker OR stuck OR waiting OR unblock OR unanswered"
  reliably returns ZERO through Composio (3/3 runs), while the FIVE-term "blocked OR blocker OR stuck OR waiting OR unblock"
  reliably returns 8 (3/3). Not throttling — query-shape. Keep ≤5 OR-terms, no quoted phrases.
- VERIFIED live: "Find Slack blockers" → "8 messages mention a blocker" with REAL, genuinely-relevant rows
  ("recovery_required Is an Unrecoverable Dead End This is the top blocker", "Hooks PR stack … review-gated",
  "can we actually merge the WeCom PR … this is the blocker" — @joe/#x-ai-product-feedback, @zaki.manian/#ironclaw-pr-issue-tracking,
  dates, Slack permalinks). Dismiss works; 0 console errors. Guards: 731/731 static unit tests, token lint OK.

## Cross-tool unification: GitHub + Drive + Notion (DONE)
All six Composio accounts are live; wired the remaining three as ambient read-only polls and folded them into the briefing
so "catch me up" is a genuine cross-tool answer. Built via a Workflow (3 parallel agents → adversarial verify; all ok).
- New normalizer libs (pure, [] on failure, no fabrication; each with a unit test):
  `lib/workbench-drive.js` (`normalizeDriveFiles`, `driveKind`, `DRIVE_FILE_LIMIT`) — GOOGLEDRIVE_LIST_FILES needs an
  explicit `fields(id,name,mimeType,modifiedTime,webViewLink,iconLink)` projection (default omits mtime+link); link
  falls back to `drive.google.com/open?id=` and REJECTS non-http(s) hrefs (e.g. javascript:) — security-positive.
  `lib/workbench-notion.js` (`normalizeNotionPages`, `notionTitle`) — NOTION_SEARCH_NOTION_PAGE; title extracted from the
  `type==='title'` property; drops archived/in_trash/non-page. `lib/workbench-github.js` (`normalizeGithubNotifications`)
  — GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER; subject.title + reason + repo + repo html_url link.
- `hooks/useWorkbenchConnectors.js`: `driveReady`/`notionReady`/`githubReady` on `useConnectedAccounts`; ambient
  `useConnectorDrive`/`useConnectorNotion`/`useConnectorGithub` (polled like inbox/calendar). GitHub added to
  `WORKBENCH_CONNECTOR_FAMILIES` (readiness strip now shows all 6).
- `lib/workbench-briefing.js` `buildBriefing` now takes githubNotifications/driveFiles/notionPages + ready flags; counts +
  sources + sections for all; headline folds GitHub into "needs you". `components/workbench-briefing.js` renders
  "On GitHub" / "Recent files" / "Recent in Notion" via a shared `BriefLinkRow`. `workbench-page.js` polls the three and
  feeds them to `runBriefing`.
- VERIFIED live: "Catch me up" → "Good afternoon. 5 replies waiting, 5 GitHub items, and 5 events on your calendar." with
  5 real rows each for Replies/Calendar/GitHub/Drive/Notion; provenance Gmail·Calendar·GitHub·Drive·Notion; readiness
  shows all 6; real data (GitHub mentions + nearai/ironclaw CI; Drive "Full BD Data"/"JASON Levels"; Notion "Q2 2026
  Management Meeting"). 0 console errors. Guards: 750/750 static unit tests, token lint OK, frontend contract OK.
- (Preview-tooling note: wide screenshots from a freshly-started preview server mis-scale; DOM inspection + a mobile-width
  capture are the reliable evidence. Not an app issue.)
- NEXT BIG STEP (needs user sign-off): WRITES — gated in-app Draft/reply/send (GMAIL_CREATE_EMAIL_DRAFT etc.) behind an
  explicit approval modal. Not wired autonomously: side-effectful actions require the user's decision on the gating model.

## Gated WRITES — drafts now, send flag-ready (DONE)
User chose "start with drafts (option 1), send in scope if enabled (option 2)". Opened a DELIBERATE, narrow write path
SEPARATE from the read-only route; the read route still rejects every write. Backend (reborn source, uncommitted):
- `reborn_services/connectors.rs`: `RebornConnectorWriteRequest`, `ConnectorWriteKind {Draft,Send,Forbidden}`,
  EXPLICIT allowlists `DRAFT_WRITE_TOOLS=[GMAIL_CREATE_EMAIL_DRAFT]` + `SEND_WRITE_TOOLS=[GMAIL_SEND_EMAIL,
  GMAIL_SEND_DRAFT,GMAIL_REPLY_TO_THREAD]`, `classify_connector_write` (exact whole-slug match, no fuzzy), + `write`
  on `ConnectorReadPort`. Tests: draft/send/forbidden separation + draft tools never read-only.
- `ironclaw_reborn_composition/connectors.rs`: shared `execute_tool` helper (read + write issue the identical upstream
  call); `write` gates by classification — Draft always; Send only when `send_capability_enabled()` reads
  `IRONCLAW_WORKBENCH_SEND_ENABLED` truthy (default OFF). Key still resolved server-side, never to browser.
- Facade + `webui_v2` handler/router/descriptors: `POST /api/webchat/v2/connectors/write` (body limit 64KiB,
  mutation policy). Re-exported write types at the crate root. Fixed 6 `RebornServicesApi` test stubs (incl.
  pre-existing `StallingServices` gap) so `cargo test` compiles; sidecar `cargo build -p ironclaw_reborn_cli
  --features webui-v2-beta` clean (~23s).
- Frontend: `lib/api.js` `connectorWrite` + client draft/send allowlist; `lib/workbench-draft.js` (reply-package
  builder, `draftWriteArguments`, validation, `createdDraftId`) + test; `components/workbench-approve.js` approval
  modal (editable to/subject/body, "Create draft" only — Send button hidden unless `sendEnabled`, honest gate note,
  "nothing is sent"); reading panel gained a "Draft reply" action; `workbench-page.js` holds the draft flow +
  `connectorWrite` submit. `lib/workbench-connectors.js` `extractEmailAddress` + `fromEmail` on the full message so a
  reply pre-fills the real sender.
- VERIFIED: backend 4-case curl (SEND→rejected[send off], DELETE→rejected, draft-on-READ-route→rejected, draft→
  SUCCESS id r-3373…); full UI flow created a real Gmail draft (id r1576555434080695174) — modal showed "Draft created",
  NO Send button, gate note; `GMAIL_LIST_DRAFTS` confirms drafts present. 756/756 static tests, token lint OK, contract OK.
- TWO real test drafts now in the user's Gmail (subjects "IronClaw Workbench … test draft (safe to delete)" / "Re: This
  Week in Digital Finance"). User can delete them; I do NOT auto-delete (delete is off-allowlist).
- To enable SEND later (option 2): start the gateway with `IRONCLAW_WORKBENCH_SEND_ENABLED=1` AND surface a Send button
  in the approval modal (pass `sendEnabled` true + add a connectorWrite to a SEND tool). Server already gates it.

## Progress log
- [x] Proved deterministic Composio delivery (real inbox).
- [x] Bound Composio key in IronClaw store (secure, key never in browser/2nd process).
- [x] Built reborn sidecar from source; in-gateway read-only connector route (allowlist verified; writes 400).
- [x] Fixed key resolution → route returns REAL inbox end-to-end.
- [x] Frontend renders REAL data (Gmail inbox + "Ready via Composio" accounts) + v13 restore.
- [x] Tests green; live env usable via fixed proxy; real-data screenshots captured.
- [x] Deterministic briefing: "catch me up"/"what needs me" → real instant briefing (no agent), verified both themes.
- [x] On-demand "Find Slack blockers" → real Slack search (8 relevant rows + deep links), verified; ≤5-term query.
- [x] Cross-tool: GitHub/Drive/Notion ambient reads + unified briefing across all 6 connectors; readiness shows all 6.
- [x] Gated WRITES: separate write route, draft-creation always / send behind IRONCLAW_WORKBENCH_SEND_ENABLED (off);
      "Draft reply" → approval modal → real Gmail draft (verified, nothing sent). 756/756 tests; sidecar rebuilt+live.
- [x] No commits; secrets only in IronClaw's encrypted store.
