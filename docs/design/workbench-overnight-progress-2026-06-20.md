# Workbench Overnight Progress — 2026-06-20

Coordinator log for the IronClaw Desktop Workbench overhaul overnight loop.
Branch: `codex/workbench-overhaul-backend-loop`. No commits/pushes. Unrelated
changes preserved.

## Loop 1 — 2026-06-19 ~21:42 local — Orientation + baseline + evidence

Active workers: Coordinator (orientation, baseline, screenshots) + background
analysis workflow (E backend-map, F design-critique, deep code review, DoD
audit, adjacency audit, scenario coverage → adversarial verify → synthesize).

### Tree state

- On expected branch. Dirty scaffold present and intact.
- Untracked Workbench tree: `crates/.../pages/workbench/` (page + components +
  hooks + lib + styles, all split), `extensions/lib/registry-{catalog,readiness}.js`,
  `tests/static/workbench-static{.spec.ts,-fixtures.ts}`,
  `tests/static/workbench-persona-fixtures.json`, three design docs.
- `workbench-page.js` = 439 lines (thin route shell); `workbench-styles.js` = 19
  lines (aggregator over `styles/` modules). Split already done.

### Baseline validation — ALL GREEN

| Check                                                             | Result                                                      |
| ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `node --check` all workbench JS                                   | clean (exit 0)                                              |
| unit tests (hooks/lib/components + app/routes + probe acceptance) | 52/52 pass                                                  |
| Workbench Playwright (`workbench-static.spec.ts`)                 | 20/20 pass                                                  |
| a11y static (`a11y-static.spec.ts`)                               | 27/27 pass                                                  |
| `verify:static-frontend`                                          | OK — generated bundle in sync with source                   |
| `check:static-bundle`                                             | OK (only pre-existing Mermaid + tesseract WARNs, in budget) |
| banned-copy scan (source)                                         | clean — matches are negative test assertions only           |

Conclusion: the scaffold is materially further along than the runbook's "do not
assume complete" caveat. The runbook's #1 suspicion (stale generated bundle) is
NOT realized — `/v2/?token` → `/v2/workbench` redirect and full render work.

### Render evidence (outside repo)

Dir: `/tmp/ironclaw-workbench-overnight-20260619-214212/`

- `01-workbench-main-1440x960.png` — prompt-first hero "What do you want
  handled?", action-language chips (What needs me today? / Summarize what
  changed. / Check Slack blockers. / Research TEE vendors. / Prepare investor
  update. / Turn a file into a memo. / More), honest boundary line, honest empty
  rails (Needs Approval/Blocked/Working/Ready/Scheduled/Receipts all 0 with
  explanatory copy). No department/persona/function picker.
- `02-model-effort-inspector.png` — "Models come from NEAR AI Cloud. Effort is
  separate..."; Model dropdown (empty under no-backend = honest); EFFORT =
  Standard / Careful / Background (separate from model, not masquerading).
- `03-sources-inspector.png` — allowed-sources/boundary inspector.
- `04-empty-ask-state.png` — empty ask does not navigate to a hollow draft.
- `05-workbench-mobile-390x844.png` — mobile, `scrollWidth=390`, no horizontal
  overflow.

Note: static dev server has no live backend, so API calls return 502. The UI
degrades HONESTLY — shows "Could not check NEAR AI Cloud. Open model settings
and try again.", model falls back to "Auto", Ask is disabled. No fake data is
shown. This is the intended staged/unavailable behavior, not a bug.

### Validation run this loop

- `node --check` (workbench) -> pass
- `node --test` (52) -> 52 pass / 0 fail
- `playwright workbench-static.spec.ts` -> 20 passed (10.4s)
- `playwright a11y-static.spec.ts` -> 27 passed (13.2s)
- `verify:static-frontend` -> OK (re-run after dev-server regen, no drift)
- `check:static-bundle` -> OK

### Open risks

- None blocking. Remaining value is analysis depth (backend wiring map, design
  critique, DoD gaps, adjacency), verified fixes, and handoff docs — in flight
  via the background workflow.

### Next actions

- Ingest workflow synthesis; apply only adversarially-confirmed safe fixes
  serially with re-validation.
- Land the backend wiring map (Worker E) and visual/product QA (Worker F) docs.
- Write final handoff doc.

## Loop 2 — 2026-06-20 ~02:05 local — Live wiring reality check + honest source gates

### What changed

- Added `scripts/probe-workbench-live-wiring.mjs`, a reusable live-profile probe
  that starts bundled Reborn on a random loopback port, checks providers,
  model catalog, extension registry, installed connector setup state, and
  optional OAuth-start reachability, then writes redacted evidence under `/tmp`.
- Installed local Reborn packages for Gmail, Calendar, Drive, Docs, Sheets,
  Slides, Notion, and GitHub so the app sees real setup-required connectors
  rather than missing packages.
- Workbench manual source selection now blocks disconnected connector families
  instead of sending a prompt that implies Slack/Gmail/Docs are usable.
- Workbench source inspector now routes setup actions to real surfaces:
  Google connectors -> `/settings/inference#google-oauth`; Notion/GitHub ->
  `/extensions/registry?setup=1&focus=...`.
- Active generic MCP routers such as `custom-mcp`/Composio now appear as ready
  without overclaiming app-specific readiness; NEAR AI MCP is intentionally not
  shown as a broad personal-source connector.
- Fixed source-inspector row layout so status/action controls cannot collide
  with connector names, and widened mobile command spacing.

### Live local-profile evidence

Probe command:

```bash
node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json
```

Evidence file:
`/tmp/ironclaw-workbench-live-wiring-2026-06-20T02-05-21-870Z/probe.json`

Results:

- Sidecar healthy on loopback; `/llm/providers`, `/llm/list-models`,
  `/extensions`, `/extensions/registry`, and `/channels/connectable` all served.
- Active model: `nearai` / `zai-org/GLM-5.1-FP8`.
- NEAR AI catalog count: `47` models.
- `custom-mcp` / Composio: active, authenticated, setup phase `active`.
- Gmail/Calendar/Drive/Docs/Sheets/Slides: installed but unauthenticated,
  pending Google OAuth. OAuth-start returns `503`, so Google desktop OAuth setup
  is the remaining blocker before these can pull personal data.
- Notion: installed, unauthenticated, OAuth-start returns `200` with host
  `mcp.notion.com`.
- GitHub: installed, pending manual token.
- Slack/channels: connectable channel count `0`; no first-party Slack package
  advertised in this profile.

### Validation added/rerun

| Check                                                                                       | Result                           |
| ------------------------------------------------------------------------------------------- | -------------------------------- |
| `node --check scripts/probe-workbench-live-wiring.mjs`                                      | pass                             |
| live wiring probe with `--probe-oauth-start`                                                | pass; evidence written to `/tmp` |
| targeted Workbench Playwright: source readiness, setup actions, manual source block, mobile | 4/4 pass                         |
| focused Workbench unit tests after source/layout changes                                    | 37/37 pass                       |

### Current truth

The Workbench is not yet "pull my inbox/calendar/drive" usable because Google
OAuth is not configured. It is, however, now honest about that fact, provides
the right setup route, and proves the NEAR AI model path plus Composio/custom
MCP readiness against the operator's real local Reborn profile.

## Loop 3 — 2026-06-20 ~02:15 local — Live render, Ask smoke, mobile tap-target cleanup

### What changed

- Tightened mobile tap targets in the Workbench split styles:
  - `styles/shell.js`: slide-out active-work close control is now 44x44.
  - `styles/packet.js`: review workspace tabs and review checklist actions now
    have a 44px tap floor.
- Regenerated the static WebUI package with `npm run prepare:webui-static` so
  `main.bundle.js` and generated chunks reflect the source split.
- Ran the Workbench in the in-app browser against a real local Reborn gateway on
  `127.0.0.1:3000`, not just mocked static fixtures.

### Live browser evidence

Screenshot/proof directory:
`/tmp/ironclaw-workbench-iab-2026-06-20T02-12/`

Files:

- `01-live-model-panel.png` — live model panel populated from NEAR AI Cloud:
  Opus, GPT, GLM, Gemini, Qwen, etc., with separate Standard/Careful/Background
  effort controls.
- `02-live-sources-panel.png` — live source inspector reflects actual local
  profile: Google apps and Notion installed but blocked by setup, Composio ready,
  Web/local files available, Slack honestly not in catalog.
- `03-live-ask-smoke.png` — harmless Workbench Ask smoke created a first-class
  Work session status surface, carried selected `Claude Opus 4.6` + `Careful`,
  kept approval boundaries, and exposed the live Chat handoff.
- `05-mobile-live-workbench-after-tap-targets.png` — 390x844 mobile viewport
  after the tap-target patch.

Browser checks:

- `/v2/workbench?token=workbench-static-token` rendered `What do you want handled?`.
- Console warnings/errors: none during model, source, Ask, or mobile passes.
- Horizontal overflow: `0` desktop and mobile.
- Model interaction: selected `anthropic/claude-opus-4-6` and `Careful`; visible
  control updated to `Claude Opus 4.6 - Careful`.
- Ask interaction: submitted a harmless wiring-only prompt; Workbench stayed on
  `/v2/workbench`, showed `Work session started`, and preserved the selected
  model/effort/source/timing preferences.
- Cleanup: restored active local profile model back to the pre-test
  `nearai` / `zai-org/GLM-5.1-FP8`.

### Fresh live local-profile evidence

Probe command:

```bash
node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json
```

Evidence file:
`/tmp/ironclaw-workbench-live-wiring-2026-06-20T02-15-20-140Z/probe.json`

Results:

- Sidecar healthy; providers/models/extensions/registry/channels routes all 200.
- Active model restored to `nearai` / `zai-org/GLM-5.1-FP8`.
- NEAR AI model catalog count still `47`.
- Composio/custom MCP active and authenticated.
- Gmail/Calendar/Drive/Docs/Sheets/Slides installed but blocked on Google OAuth
  (`oauth/start` 503).
- Notion installed and OAuth-start reachable (`mcp.notion.com`).
- GitHub installed and pending manual token.
- Slack/channels still absent in the advertised local catalog.

### Post-patch validation

| Check                                                  | Result                      |
| ------------------------------------------------------ | --------------------------- | ------------ | ------------ | -------- |
| `node --check` changed Workbench style modules         | pass                        |
| focused Workbench Playwright (`stylesheet              | mobile                      | direct route | Ask starts`) | 4/4 pass |
| all Workbench unit tests under `pages/workbench`       | 39/39 pass                  |
| full Workbench Playwright (`workbench-static.spec.ts`) | 22/22 pass                  |
| a11y/static Playwright (`a11y-static.spec.ts`)         | 27/27 pass                  |
| `verify:static-frontend`                               | OK                          |
| live wiring probe after cleanup                        | pass; active model restored |

### Current truth

The Workbench surface is now proven live-renderable against the local Reborn
profile, with real NEAR model catalog data and honest connector readiness. The
main remaining product blockers are still the backend gaps from the wiring map:
Google OAuth setup, durable Work reads, approval/receipt feeds, memory writes,
and automation CRUD. Do not paper over those with dummy text.

## Loop 4 — 2026-06-20 ~02:23 local — Scheduled work rail reads the real automations API

### What changed

- Workbench's active rail now consumes the existing read-only
  `/api/webchat/v2/automations?limit=50&run_limit=5` route.
- `buildWorkbenchStateRail` accepts normalized automations and maps them into
  existing Workbench groups without adding fake write capability:
  - active schedules -> `Scheduled`
  - running runs -> `Working`
  - latest failed runs -> `Blocked`
  - latest completed runs -> `Recent receipts`
- Workbench page fetches automations with React Query and normalizes them with
  the same presenter used by the Scheduled page.
- Static Workbench fixtures now mock `/automations`, and the route test proves
  the rail calls the real read route before rendering scheduled rows.
- `scripts/probe-workbench-live-wiring.mjs` now includes the automations route
  in `route_status` and records count/sample evidence.

### Why this matters

The user-facing "Scheduled" and "Recent receipts" rail no longer has to stay
empty when the backend already knows about scheduled runs. Cadence creation is
still honest: no create/toggle/delete controls were added, because the write
flow remains a backend gap.

### Fresh live local-profile evidence

Probe command:

```bash
node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json
```

Evidence file:
`/tmp/ironclaw-workbench-live-wiring-2026-06-20T02-22-26-489Z/probe.json`

Results:

- `/automations?limit=50&run_limit=5` returns `200`.
- Current local automation count: `0`.
- Active model remains `nearai` / `zai-org/GLM-5.1-FP8`.
- NEAR AI model catalog remains `47`.
- Connector truth unchanged: Composio ready; Google apps blocked on OAuth;
  Notion OAuth-start works; GitHub needs manual token; Slack absent.

### Post-change validation

| Check                                                     | Result     |
| --------------------------------------------------------- | ---------- |
| `node --check` changed Workbench state/page/probe modules | pass       |
| focused rail unit test                                    | 6/6 pass   |
| focused Playwright automation-rail route test             | 1/1 pass   |
| all Workbench unit tests under `pages/workbench`          | 40/40 pass |
| full Workbench Playwright (`workbench-static.spec.ts`)    | 23/23 pass |
| a11y/static Playwright (`a11y-static.spec.ts`)            | 27/27 pass |
| `verify:static-frontend`                                  | OK         |
| live wiring probe with automations route                  | pass       |

### Current truth

Workbench can now reflect real scheduled/background work if the local profile
has any. This does not solve automation CRUD: creating a monitor from the
Workbench cadence inspector still needs a backed write flow and approval gate.

## Loop 5 — 2026-06-20 ~02:34 local — Started Workbench scene mirrors the live Chat timeline

### What changed

- The started Workbench scene no longer renders a static "No runtime artifact yet"
  placeholder after Ask.
- `WorkbenchSceneWorkspace` now polls the registered Chat timeline for the
  created thread and renders the latest assistant reply when it exists.
- Pending states stay honest:
  - no timeline message yet -> `Waiting on the live thread.`
  - user request recorded -> `Runtime accepted the request.`
  - timeline fetch fails -> warning state that directs the user to the live thread
  - assistant reply exists -> `Latest live reply`
- The preferences panel continues to show the actual model id selected from the
  NEAR AI Cloud catalog, separate from effort/source/timing.
- Fixed a hook-order issue in the scene component before broader QA by moving the
  timeline `useQuery` above the empty-state return.

### Fresh rendered evidence

In-app browser screenshot directory:
`/tmp/ironclaw-workbench-iab-2026-06-20T02-30/`

Screenshots:

- `01-workbench-main.png` — first viewport, live local Workbench route, real model
  label `GLM 5.1 FP8`.
- `02-workbench-after-ask.png` — Ask creates a first-class Workbench scene instead
  of navigating away or showing a dummy artifact.
- `03-workbench-runtime-preview.png` — scrolled scene proof: the current request,
  `Runtime accepted the request.`, actual model id
  `zai-org/GLM-5.1-FP8`, and approval boundary copy.
- `04-live-thread.png` — generated live Chat thread contains the Workbench request.

Browser checks:

- `/v2/workbench?token=workbench-static-token` rendered `What do you want handled?`.
- Console warnings/errors: none across initial render, Ask, scrolled scene preview,
  and live-thread proof.
- Ask interaction: submitted a harmless internal smoke prompt:
  `Smoke test the Workbench live thread preview only. Do not contact external people
or change external systems.`
- Workbench stayed on `/v2/workbench`, showed `Work session started`, exposed
  `Open live thread`, and removed the old placeholder.
- Live thread proof: `/v2/chat/1c351e3e-f44f-547c-8226-9666b3b75bb6` contained the
  Workbench request.
- Cleanup: the smoke run was cancelled through the real
  `/threads/{threadId}/runs/{runId}/cancel` route with `reason:user_requested`;
  refreshed UI no longer showed `IronClaw is thinking` or a `Cancel` button.

### Fresh live local-profile evidence

Probe command:

```bash
node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json
```

Evidence file:
`/tmp/ironclaw-workbench-live-wiring-2026-06-20T02-31-09-674Z/probe.json`

Results:

- Sidecar healthy; providers/models/extensions/registry/channels/automations routes all 200.
- Active model remains `nearai` / `zai-org/GLM-5.1-FP8`.
- NEAR AI model catalog count remains `47`.
- Current local automation count: `0`.
- Connector truth unchanged: Composio ready; Web Access active; Google apps blocked
  on OAuth-start 503; Notion OAuth-start works; GitHub needs manual token; Slack
  absent from advertised local catalog.

### Post-change validation

| Check                                                  | Result       |
| ------------------------------------------------------ | ------------ | -------- |
| `node --check` changed Workbench scene/style modules   | pass         |
| focused Workbench Playwright (`command starts          | Ask starts`) | 2/2 pass |
| full Workbench Playwright (`workbench-static.spec.ts`) | 23/23 pass   |
| static JS unit suite (`npm run test:static`)           | 681/681 pass |
| a11y/static Playwright (`a11y-static.spec.ts`)         | 27/27 pass   |
| `verify:static-frontend`                               | OK           |
| in-app browser rendered QA                             | pass         |
| live wiring probe                                      | pass         |

### Current truth

Workbench now has a real first-hop execution loop: the command composer creates
a Chat runtime thread, the Workbench scene stays in place, preferences are carried
through, the live thread is reachable, and the started scene reads the real
timeline instead of pretending an artifact exists. The next highest-value backend
gap is still durable Work reads plus approval/receipt feeds; without those, the
desk cannot yet become the full cross-tool "what needs me" operating surface.

## Loop 6 — 2026-06-20 ~02:39 local — Packet viewer model split for backend Work/receipt wiring

### What changed

- Split pure packet model building out of the large packet viewer component:
  - new `pages/workbench/lib/workbench-packet-model.js`
  - slimmer `pages/workbench/components/workbench-packet.js`
- The model layer now owns saved artifact selection, Chat handoff hrefs,
  approval metadata, receipt metadata, artifact preview state, and draft presence.
- Added direct model coverage for Chat handoff + receipt metadata so future
  backend Work/receipt adapters can feed the packet without reaching into the UI
  component.

### Why this matters

The packet viewer is the future review workspace for saved briefs, drafts,
research notes, and approvals. Before wiring server-backed Work reads or receipt
feeds into it, the conversion layer needs to be testable independently from the
rendered component. This pass reduces the brittle UI file and creates that adapter
boundary without changing user-facing behavior.

### Size / structure

- `workbench-packet.js`: `642` lines before this loop, `549` after.
- `workbench-packet-model.js`: `98` lines of pure model logic.
- Workbench unit tests: `41` focused Workbench tests after the new assertion.

### Fresh rendered evidence

In-app browser screenshot directory:
`/tmp/ironclaw-workbench-iab-2026-06-20T02-38/`

Screenshot:

- `01-workbench-render-after-packet-split.png` — `/v2/workbench` rendered after
  the split, with Workbench command surface and packet workspace present.

Browser checks:

- `/v2/workbench?token=workbench-static-token` rendered `What do you want handled?`.
- Packet workspace still exposed `Workbench review workspace tabs`.
- Empty saved-artifact state still rendered honestly.
- Console warnings/errors: none.
- No framework overlay.
- No new Ask/model run was submitted in this loop.

### Fresh live local-profile evidence

Probe command:

```bash
node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json
```

Evidence file:
`/tmp/ironclaw-workbench-live-wiring-2026-06-20T02-37-36-100Z/probe.json`

Results:

- Sidecar healthy; providers/models/extensions/registry/channels/automations routes all 200.
- Active model remains `nearai` / `zai-org/GLM-5.1-FP8`.
- NEAR AI model catalog count remains `47`.
- Current local automation count: `0`.
- Connector truth unchanged: Composio ready; Web Access active; Google apps blocked
  on OAuth-start 503; Notion OAuth-start works; GitHub needs manual token; Slack
  absent from advertised local catalog.

### Post-change validation

| Check                                                  | Result       |
| ------------------------------------------------------ | ------------ |
| `node --check` changed packet component/model modules  | pass         |
| focused packet model/component tests                   | 5/5 pass     |
| all Workbench unit tests under `pages/workbench`       | 41/41 pass   |
| full Workbench Playwright (`workbench-static.spec.ts`) | 23/23 pass   |
| static JS unit suite (`npm run test:static`)           | 682/682 pass |
| a11y/static Playwright (`a11y-static.spec.ts`)         | 27/27 pass   |
| `verify:static-frontend`                               | OK           |
| live wiring probe                                      | pass         |
| in-app browser rendered QA                             | pass         |

### Current truth

This loop did not add a new backend capability. It made the next backend capability
safer to wire: durable saved Work reads, approvals, and receipts can now be adapted
into a pure packet model before they hit the review UI. The product still needs
server-backed Work reads and cross-thread approval/receipt feeds to become the
actual chief-of-staff desk instead of a local saved-artifact viewer.

## Loop 7 — 2026-06-20 ~02:45 local — Natural suggestion labels with richer filled asks

### What changed

- Workbench starter suggestions now split visible `label` from composer `fill`.
- Visible chips are shorter and less robotic:
  - `What needs me today?`
  - `Catch me up`
  - `Find Slack blockers`
  - `Research TEE vendors`
  - `Prepare investor update`
  - `Turn a file into a memo`
- Clicking a chip now fills a complete request. Example:
  `Research TEE vendors` fills:
  `Research privacy-preserving TEE vendors for business use and give me a shortlist with tradeoffs, source links, and open questions.`
- Added `workbenchSuggestionFill()` so the command component does not know the
  suggestion data shape.
- Added unit/browser assertions that suggestions do not use trailing checklist
  periods and that fills are fuller than labels.

### Why this matters

This is a product-surface quality fix. The Workbench should feel like a personal
chief-of-staff input surface, not a menu of canned functions. Compact chips keep
the first viewport scannable while the filled requests teach the user what kind
of high-leverage, approval-safe work IronClaw can handle.

### Fresh rendered evidence

In-app browser screenshot directory:
`/tmp/ironclaw-workbench-iab-2026-06-20T02-44/`

Screenshots:

- `01-natural-suggestion-labels.png` — first viewport with new compact chip labels.
- `02-natural-suggestion-filled.png` — after clicking `Research TEE vendors`, the
  composer contains the full research request; no Ask was sent.

Browser checks:

- `/v2/workbench?token=workbench-static-token` rendered.
- New labels visible: `What needs me today?`, `Catch me up`, `Find Slack blockers`,
  `Research TEE vendors`.
- Old period labels absent (`Research TEE vendors.`, `Check Slack blockers.`).
- Direct DOM read confirmed the textarea value contains
  `privacy-preserving TEE vendors` and `shortlist`.
- Work session did not start during the proof; this loop did not submit another
  model run.
- Console warnings/errors: none.
- No framework overlay.

### Fresh live local-profile evidence

Probe command:

```bash
node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json
```

Evidence file:
`/tmp/ironclaw-workbench-live-wiring-2026-06-20T02-42-44-315Z/probe.json`

Results:

- Sidecar healthy; providers/models/extensions/registry/channels/automations routes all 200.
- Active model remains `nearai` / `zai-org/GLM-5.1-FP8`.
- NEAR AI model catalog count remains `47`.
- Current local automation count: `0`.
- Connector truth unchanged: Composio ready; Web Access active; Google apps blocked
  on OAuth-start 503; Notion OAuth-start works; GitHub needs manual token; Slack
  absent from advertised local catalog.

### Post-change validation

| Check                                                  | Result       |
| ------------------------------------------------------ | ------------ |
| `node --check` changed command/plan modules            | pass         |
| focused suggestion unit tests                          | 11/11 pass   |
| focused suggestion Playwright test                     | 1/1 pass     |
| all Workbench unit tests under `pages/workbench`       | 42/42 pass   |
| full Workbench Playwright (`workbench-static.spec.ts`) | 23/23 pass   |
| static JS unit suite (`npm run test:static`)           | 683/683 pass |
| a11y/static Playwright (`a11y-static.spec.ts`)         | 27/27 pass   |
| `verify:static-frontend`                               | OK           |
| live wiring probe                                      | pass         |
| in-app browser rendered interaction QA                 | pass         |

### Current truth

The Workbench first viewport now reads less like a function picker and fills more
useful, generalizable work requests. This improves the chief-of-staff surface,
but it still depends on the same backend gaps: durable Work reads, cross-thread
approvals, receipts, writable schedules, and memory.

## Loop 8 — 2026-06-20 ~02:58 local — Adaptive command label plus live-render proof

### What changed

- Added `commandActionLabel(brief)` next to the existing scene inference registry.
- The command button now adapts to the inferred work type:
  - empty / unknown: `Ask`
  - review packet / counter / agreement: `Review`
  - research: `Research`
  - growth/channel work: `Plan`
  - monitor/watch work: `Watch`
  - investor / stakeholder update: `Prepare`
- The send button now has stable `data-testid="workbench-send-button"` so tests
  do not couple command behavior to whichever visible verb is correct for a
  prompt.
- Updated browser tests that actually start work to click the stable button,
  while preserving explicit visible-label tests for `Ask`, `Prepare`, `Review`,
  and `Watch`.

### Why this matters

This removes one of the remaining "dummy UX" tells. A personal chief-of-staff
surface should not always say `Ask` after the user has typed "review this
counter" or "prepare an investor update." The label now gives the user a small,
immediate signal that IronClaw understood the kind of work without exposing a
function directory on the surface.

### Fresh rendered evidence

In-app browser screenshot directory:
`/tmp/ironclaw-workbench-iab-2026-06-20T02-56/`

Screenshots:

- `workbench-main-live-proxy.png` — current first viewport, served from the
  generated static bundle with `/api` proxied to the live local sidecar. It shows
  the real NEAR AI model label `GLM 5.1 FP8`, not a fake "Deep work" mode.
- `workbench-prepare-label-live-proxy.png` — after typing an investor-update
  request, the primary action reads `Prepare`.
- `workbench-review-label-live-proxy.png` — after typing the counter/agreement
  example, the primary action reads `Review`.

Browser checks:

- Static bundle route rendered through `http://127.0.0.1:1422/v2/workbench`.
- `/api` was proxied to the live local `ironclaw-reborn serve` process on 1420.
- The page no longer showed the static-only `Could not check NEAR AI Cloud`
  warning once proxied to the live API.
- The work mode control displayed the live model label `GLM 5.1 FP8`.
- `Prepare` and `Review` labels were observed after typing the corresponding
  prompts.

### Live local-profile evidence

Probe command:

```bash
node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json
```

Evidence file:
`/tmp/ironclaw-workbench-live-wiring-2026-06-20T02-51-39-861Z/probe.json`

Results:

- Sidecar healthy; providers/models/extensions/registry/channels/automations routes all 200.
- Active model: `nearai` / `zai-org/GLM-5.1-FP8`.
- Provider catalog count: `26`.
- NEAR AI model catalog count: `47`; sample includes Claude Opus, DeepSeek,
  Gemini, and OpenAI GPT models.
- Current active extensions observed: Composio, NEAR AI, Web Access.
- Current local automation count: `0`.

### Post-change validation

| Check                                                  | Result       |
| ------------------------------------------------------ | ------------ |
| `node --check` changed command/scene modules           | pass         |
| focused scene registry unit tests                      | 5/5 pass     |
| focused Playwright for suggestion + adaptive label     | 2/2 pass     |
| focused start/attachment/mobile Playwright rerun       | 8/8 pass     |
| all Workbench unit tests under `pages/workbench`       | 43/43 pass   |
| full Workbench Playwright (`workbench-static.spec.ts`) | 24/24 pass   |
| static JS unit suite (`npm run test:static`)           | 684/684 pass |
| a11y/static Playwright (`a11y-static.spec.ts`)         | 27/27 pass   |
| `verify:static-frontend`                               | OK           |
| live wiring probe                                      | pass         |
| in-app browser rendered interaction QA                 | pass         |

### Current truth

The generated static Workbench surface now renders with live model/provider data
when paired with the local API and the primary action is no longer hard-wired to
`Ask`. The design still needs the larger visual rethink already identified in
the QA doc: the serif hero is weak, the home screen is too sparse/board-like,
and the empty review workspace should not own the first visit.

Packaging caveat: direct `ironclaw-reborn serve` from the prebuilt sidecar
(`src-tauri/binaries/ironclaw-reborn-aarch64-apple-darwin`, built Jun 19 00:06)
redirected `/v2/workbench` to `/v2/chat`. The new static bundle route is valid
and tested, but the sidecar's embedded serve-mode UI is stale. Before calling
the desktop path end-to-end usable, rebuild or otherwise refresh the packaged
sidecar/static preview path and re-run the browser route proof without the
temporary static+API proxy.

## Loop 9 — 2026-06-20 ~03:05 local — Blank home no longer mounts empty review/files panels

### What changed

- `HomeView` now renders `WorkPacketPreview` only when `savedItems` contain a
  real reviewable artifact (`firstArtifact(item)`).
- The Local files drawer is no longer a standing home panel. It renders only
  after the user explicitly selects `Local files` in the Workbench source scope.
- Static route tests now prove:
  - blank/new-user home has no `workbench-document-workspace`;
  - blank/new-user home has no `workbench-workspace-files`;
  - seeded saved-work still renders the artifact review workspace;
  - local workspace browsing still appears and attaches text files after the
    Local files source is selected;
  - list/content/binary file failure states remain honest.

### Why this matters

This removes the largest remaining "mockup board of panels" failure. The home
surface now behaves closer to the intended product shape: command first, triage
second, artifact workspace only when there is actual work to review, and file
browsing only when the user chooses that source. It also keeps the product
generalizable: a lawyer, finance operator, founder, engineer, or people lead
does not land in an empty legal/document review desk before asking for work.

### Fresh rendered evidence

In-app browser screenshot directory:
`/tmp/ironclaw-workbench-iab-2026-06-20T03-04-loop9/`

Screenshots:

- `01-blank-home-no-empty-panels.png` — desktop blank home; no empty artifact
  review packet and no Local files drawer.
- `02-local-files-explicit-source.png` — after selecting `Local files`, the
  drawer appears and honestly reports gateway filesystem unavailability in the
  plain static preview.
- `03-mobile-blank-home-no-empty-panels.png` — 390px mobile blank home; no
  packet/files panels and no document horizontal overflow.

Browser checks:

- URL: `http://127.0.0.1:1423/v2/workbench`.
- Title: `IronClaw`.
- `workbench-brief-input` count: `1`.
- Blank home `workbench-document-workspace` count: `0`.
- Blank home `workbench-workspace-files` count: `0`.
- After selecting `Local files`, `workbench-workspace-files` count: `1`.
- Mobile `documentElement.scrollWidth - clientWidth`: `0`.
- Console warnings/errors: none.
- No framework overlay.

### Live local-profile evidence

Probe command:

```bash
node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json
```

Evidence file:
`/tmp/ironclaw-workbench-live-wiring-2026-06-20T03-02-05-637Z/probe.json`

Results:

- Sidecar healthy; providers/models/extensions/registry/channels/automations routes all 200.
- Active model: `nearai` / `zai-org/GLM-5.1-FP8`.
- Provider catalog count: `26`.
- NEAR AI model catalog count: `47`.
- Current active extensions observed: Composio, NEAR AI, Web Access.

### Post-change validation

| Check                                                  | Result                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `node --check` changed page module                     | pass                                                                                                         |
| focused Workbench route tests for home/packet/files    | 7/7 pass                                                                                                     |
| `npm run prepare:webui-static`                         | pass                                                                                                         |
| all Workbench unit tests under `pages/workbench`       | 43/43 pass                                                                                                   |
| full Workbench Playwright (`workbench-static.spec.ts`) | 24/24 pass                                                                                                   |
| static JS unit suite (`npm run test:static`)           | 684/684 pass                                                                                                 |
| a11y/static Playwright (`a11y-static.spec.ts`)         | 27/27 pass after rerun; first attempt hit port 1420 EADDRINUSE while another Playwright webserver was active |
| `verify:static-frontend`                               | OK                                                                                                           |
| live wiring probe                                      | pass                                                                                                         |
| in-app browser desktop/mobile rendered QA              | pass                                                                                                         |

### Current truth

The blank Workbench home is materially less cluttered and no longer defaults to
an empty legal/document review desk. This did not finish the design overhaul:
at the end of Loop 9, the saved-artifact workspace still needed
artifact-type-specific layouts, the visual system still needed a real font/theme
pass, the top/source trust chrome was still over-present, and Memory remained
over-promoted until a writable preference backend existed. Loop 11 resolves the
top/source chrome and Memory-nav pieces; the font/theme and artifact-layout
issues remain.

## Loop 10 — 2026-06-20 ~03:20 local — Saved-work viewer labels are type-aware, not fixed packet chrome

### What changed

- `buildPacketModel` now derives visible tab/checklist language from the saved
  work shape instead of hard-coding `Artifact / Draft / Sources`.
  - summary/reply saved work renders `Summary`, `Reply`, `Context`;
  - roadmap/research saved work renders `Research`;
  - file payloads render `File`;
  - fallback saved work still uses neutral `Output`, not legal/document wording.
- `WorkPacketPreview` now uses those inferred labels across the tab strip,
  review checklist, saved-output pane, reply pane, handoff modal, and local edit
  re-arming copy.
- Static route tests now prove:
  - seeded renewal work renders `Summary`, `Reply`, and `Context`;
  - the handoff button is blocked until the output and reply have been opened;
  - local roadmap extraction work renders a `Research` tab;
  - the old visible packet copy (`Artifact v`, `Review artifact`,
    `Saved snapshot`, `Sources will populate`) stays out of the component chrome.

### Why this matters

This fixes the next largest generalizability failure after Loop 9. Saved work no
longer reads like a generic legal redline packet with renamed nouns. It still is
not final product quality: the layout is the same saved-work frame, and it needs
artifact-type-specific bodies for reply batches, research briefs, monitor plans,
finance/ops summaries, engineering runbooks, and people workflows. But the
surface can now name what the work actually is without listing business functions
on the primary command surface.

### Fresh rendered evidence

In-app browser screenshot directory:
`/tmp/ironclaw-workbench-iab-2026-06-20T03-13-loop10/`

Screenshots:

- `00-workbench-main-command-surface.png` — first-viewport Workbench command
  surface with saved-work dock, adaptive suggestions, and real model label
  `GLM 5.1 FP8`.
- `01-saved-work-summary-tab.png` — saved renewal work with `Summary v6`,
  `Reply`, `Context`, and `Activity` tabs; saved content is rendered as
  `Renewal-terms-summary.md`.
- `02-chat-handoff-reviewed-ready.png` — handoff modal after required review,
  showing the action can open the linked Chat only after review completion.
- `03-reply-review-tab.png` — reply draft review tab with the prepared response
  and the linked handoff bar.

Browser checks:

- URL: `http://127.0.0.1:1424/v2/workbench`.
- Seeded saved-work tab labels observed:
  `Overview`, `Summary v6`, `Reply`, `Context`, `Activity`.
- Old visible packet phrases observed absent from the rendered page:
  `Artifact v`, `Review artifact`.
- Pre-review handoff modal observed buttons:
  `Open required items first`, `Review summary`, `Close`.
- Review path: `Review summary` selected the `Summary v6` tab; clicking `Reply`
  selected the `Reply` tab and closed the modal.
- The in-app browser kernel reset during an attempted extra pre-review modal
  screenshot; the interaction evidence above was captured before the reset, and
  all listed screenshot files were written successfully to host `/tmp`.

### Live local-profile evidence

Probe command:

```bash
node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json
```

Evidence file:
`/tmp/ironclaw-workbench-live-wiring-2026-06-20T03-12-42-885Z/probe.json`

Results:

- Sidecar healthy; providers/models/extensions/registry/channels/automations
  routes all 200.
- Active model: `nearai` / `zai-org/GLM-5.1-FP8`.
- Provider catalog count: `26`.
- NEAR AI model catalog count: `47`.
- Current active extensions observed: Composio, NEAR AI, Web Access.

### Post-change validation

| Check                                                  | Result                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `node --check` changed packet modules                  | pass                                                                                                         |
| focused Workbench packet component tests               | 6/6 pass                                                                                                     |
| all Workbench unit tests under `pages/workbench`       | 44/44 pass                                                                                                   |
| `npm run prepare:webui-static`                         | pass                                                                                                         |
| full Workbench Playwright (`workbench-static.spec.ts`) | 24/24 pass                                                                                                   |
| static JS unit suite (`npm run test:static`)           | 685/685 pass                                                                                                 |
| a11y/static Playwright (`a11y-static.spec.ts`)         | 27/27 pass after rerun; first attempt hit port 1420 EADDRINUSE while another Playwright webserver was active |
| `verify:static-frontend`                               | OK                                                                                                           |
| live wiring probe                                      | pass                                                                                                         |
| in-app browser rendered saved-work QA                  | pass, with screenshot caveat noted above                                                                     |

### Current truth

The Workbench scaffold is becoming less fake and less legal-indexed: blank home
is command-first, the primary model label is real, Ask starts the existing Chat
runtime, local files only appear when selected, and saved work now names its own
output/reply/context shape. The remaining high-risk gaps are still durable
saved-work backend read, cross-thread approvals, receipts/audit feed, automation
write flows, memory persistence, and a serious visual-system pass.

## Loop 11 — 2026-06-20 ~03:35 local — Source/boundary chrome simplified and split out of the page

### What changed

- Extracted the source inspector from `workbench-page.js` into
  `components/workbench-sources-inspector.js`, shrinking the page component and
  giving source readiness its own boundary.
- Removed the redundant top-bar shield button. Source readiness is now opened
  from the composer-owned `What's allowed` affordance, where the source choice
  is actually made.
- Removed the primary `Memory` rail item while preference/memory writes remain
  backend-blocked. The prototype component still exists, but it is no longer a
  top-level destination pretending to be usable.
- Replaced the inspector's static `Can do privately` / `Needs your approval`
  boilerplate blocks with:
  - live connector readiness rows;
  - real setup/reconnect actions;
  - one concise boundary note that external sends/posts/shares/files/durable
    memory still need explicit Chat approval.

### Why this matters

This removes another layer of unnecessary product complexity. The old Workbench
had three separate trust affordances saying roughly the same thing: the source
picker, the composer boundary line, and a top-bar shield that opened generic
policy copy. Loop 11 makes the source inspector an evidence panel again: what is
ready, what is blocked, what needs setup, and which action routes to the real
setup surface.

### Fresh rendered evidence

In-app browser screenshot directory:
`/tmp/ironclaw-workbench-iab-2026-06-20T03-31-loop11/`

Screenshots:

- `00-home-no-top-shield-no-memory.png` — desktop first viewport with no
  top-bar shield and no primary Memory nav item.
- `01-source-readiness-inspector.png` — source inspector opened from
  `What's allowed`; shows live readiness rows and setup actions without static
  `Can do privately` / `Needs your approval` blocks.
- `02-mobile-home-no-memory.png` — 390px viewport with no Memory nav, no top
  shield, and no horizontal overflow.

Browser checks:

- URL: `http://127.0.0.1:1426/v2/workbench`.
- Title: `IronClaw`.
- Not blank: `What do you want handled?` present.
- Framework overlay: absent.
- Console warnings/errors: none.
- `memoryNavCount`: `0`.
- `topShieldCount`: `0`.
- composer `What's allowed` button count: `1`.
- Desktop overflow: `0`; mobile overflow at 390px: `0`.

### Live local-profile evidence

Probe command:

```bash
node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json
```

Evidence file:
`/tmp/ironclaw-workbench-live-wiring-2026-06-20T03-26-05-181Z/probe.json`

Results:

- Sidecar healthy; providers/models/extensions/registry/channels/automations
  routes all 200.
- Active model: `nearai` / `zai-org/GLM-5.1-FP8`.

### Post-change validation

| Check                                                  | Result       |
| ------------------------------------------------------ | ------------ |
| `node --check` changed Workbench modules               | pass         |
| focused Workbench shell/source/mobile Playwright       | 4/4 pass     |
| all Workbench unit tests under `pages/workbench`       | 44/44 pass   |
| full Workbench Playwright (`workbench-static.spec.ts`) | 24/24 pass   |
| static JS unit suite (`npm run test:static`)           | 685/685 pass |
| a11y/static Playwright (`a11y-static.spec.ts`)         | 27/27 pass   |
| `verify:static-frontend`                               | OK           |
| live wiring probe                                      | pass         |
| in-app browser rendered source-inspector QA            | pass         |

### Current truth

The Workbench home is now cleaner and more honest: source readiness is scoped to
the composer flow, Memory is no longer over-promoted before persistence exists,
and the top bar does less decorative trust signaling. Remaining product work is
still substantial: the visual system needs a serious font/theme pass, saved-work
needs richer artifact-specific layouts, and the core feeds still need durable
backend APIs for saved work, approvals, receipts, automation writes, memory, and
global pending work.

## Loop 12/13 — 2026-06-20 ~04:20 local — Visual tokens, dark mode, and mobile composer hardened

### What changed

- Added Workbench-owned font tokens in `styles/tokens.js`:
  `--wb-font-body`, `--wb-font-display`, and `--wb-font-mono`.
- Replaced the Georgia / Times editorial fallback in command, packet, approval,
  and file surfaces with the Workbench font tokens. The surface now reads like a
  professional app shell instead of a legal-document viewer.
- Reintroduced a scoped dark token table for `.wb13` under
  `[data-theme="dark"]`, covering surface, canvas, ink, muted text, rules,
  accent, status tints, rail colors, shadows, placeholder, and drop overlay.
- Tightened the main composer:
  - the primary textarea baseline is larger;
  - browser resize chrome is disabled for the command prompt;
  - mobile reserves enough height for wrapped source/model/attach/cadence/send
    controls without immediately showing an ugly inner textarea scrollbar.
- Added stylesheet regression guards for the font tokens, dark theme selector,
  absence of Georgia / Times, non-resizable prompt, and mobile prompt sizing.

### Why this matters

The previous visual system had become product-confused: half legal memo, half
admin dashboard, and not obviously the private chief-of-staff command surface
the Workbench is meant to be. This pass does not solve every taste problem, but
it removes a major category error. The first screen now centers a serious
command prompt, uses real NEAR AI Cloud model labeling (`GLM 5.1 FP8` in the
rendered proof), has a functioning dark theme, and avoids the worst mobile
composer artifact.

### Fresh rendered evidence

Screenshot directory:
`/tmp/ironclaw-workbench-iab-2026-06-20T04-18-loop13/`

Screenshots:

- `00-light-current-home.png` — desktop light first viewport with command-first
  Workbench, no fake packet, and real model chip.
- `01-dark-current-home.png` — desktop dark first viewport using the restored
  `.wb13` dark token table.
- `02-mobile-dark-current-home.png` — 390px dark viewport with wrapped controls,
  no inner resize strip, and no horizontal overflow.

Rendered checks from the screenshot capture:

- Light main background: `rgb(247, 248, 246)`.
- Dark main background: `rgb(11, 16, 22)`.
- Dark composer background: `rgb(17, 24, 33)`.
- Textarea resize: `none`.
- Desktop textarea scroll/client height: `158 / 158`.
- Mobile textarea scroll/client height: `318 / 318`.
- Send control height: `44`.
- Model chip: `GLM 5.1 FP8`.
- Horizontal overflow: `0` on desktop and 390px mobile.
- Console warnings/errors: none.

### Live local-profile evidence

Probe command:

```bash
node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json
```

Evidence file:
`/tmp/workbench-loop12-live-wiring-probe.json`

Results:

- Sidecar healthy.
- Providers, models, extensions, registry, channels, and automations routes all
  returned 200.
- Active model: `nearai` / `zai-org/GLM-5.1-FP8`.
- Active extensions observed in this probe: none.

### Post-change validation

| Check                                                  | Result                                      |
| ------------------------------------------------------ | ------------------------------------------- |
| `node --check` changed Workbench style modules         | pass                                        |
| `npm run prepare:webui-static`                         | pass                                        |
| focused Workbench route/theme/mobile Playwright        | 3/3 pass with `playwright.static.config.ts` |
| full Workbench Playwright (`workbench-static.spec.ts`) | 24/24 pass                                  |
| static JS unit suite (`npm run test:static`)           | 685/685 pass                                |
| static/a11y browser suite (`npm run test:a11y-static`) | 93/93 pass                                  |
| `verify:static-frontend`                               | OK                                          |
| live wiring probe                                      | pass                                        |
| rendered screenshot QA                                 | pass                                        |

Note: an initial ad hoc `npx playwright test tests/static/workbench-static.spec.ts`
attempt failed because it bypassed the repo's Playwright static config and had
no `baseURL`; rerunning through `playwright.static.config.ts` passed. A first
Node REPL screenshot attempt also resolved an old Playwright browser cache path,
so the final screenshots were captured through shell Node using the repo's
Playwright 1.60 install.

### Current truth

This is still not the final product surface, but the obvious visual-system debt
is smaller: the Workbench now has real light/dark tokens, app-grade typography,
and a mobile composer that does not visibly fight the browser. The remaining
front-end work is higher-level product composition: richer saved-work layouts by
artifact type, cleaner active-work scenes from real timeline data, and eventual
first-party feeds for approvals, receipts, saved work, memory, automation writes,
and global pending work.

## Loop 14 — 2026-06-20 ~05:15 local — Pending gate detail reaches the Workbench rail

### What changed

- Added `lib/thread-attention-details.js`, a small browser-side detail store
  keyed by thread id. It stores the live gate headline/body/provider metadata
  separately from the existing `THREAD_STATE.NEEDS_ATTENTION` enum, preserving
  the small state store while letting other surfaces show the actual waiting
  decision.
- Chat now writes that detail when a live approval/auth gate is pending and
  clears it when the run resumes or becomes idle.
- Workbench now consumes `useThreadAttentionDetails()` and passes it into
  `buildWorkbenchStateRail`.
- The rail still falls back to the old generic copy when no detail exists, but
  when a live gate is known it can render specific copy such as:
  `Approve counter to Northwind` and
  `External email with net 45 terms is waiting.`
- Static Workbench fixtures can now return thread rows, which lets browser tests
  prove pending thread attention through the actual `/v2/workbench` route.

### Why this matters

The personal chief-of-staff surface depends on "what needs me?" being precise.
Before this pass, Workbench could show that a thread needed attention, but not
what decision was waiting. That forced the user into Chat for even the basic
question "what am I approving?" Loop 14 moves real gate metadata into the
Workbench first screen without inventing a nonexistent `/approvals` endpoint.
It is still browser-local and current-session/persisted-local only, but it is a
clean adapter boundary for a future durable approvals feed.

### Fresh rendered evidence

In-app Browser screenshot:
`/tmp/ironclaw-workbench-iab-2026-06-20T05-10-loop14/00-gate-detail-home.png`

Browser checks:

- URL: `http://127.0.0.1:1434/v2/workbench`.
- Title: `IronClaw`.
- Not blank: `What do you want handled?` present in DOM snapshot.
- Framework overlay: absent.
- Console warnings/errors: none.
- Dark main background: `rgb(11, 16, 22)`.
- Horizontal overflow: `0`.
- Active rail text includes `Approve counter to Northwind`.
- Main triage text includes `External email with net 45 terms is waiting.`

### Live local-profile evidence

Probe command:

```bash
node scripts/probe-workbench-live-wiring.mjs --probe-oauth-start --json
```

Evidence file:
`/tmp/workbench-loop14-live-wiring-probe.json`

Results:

- Sidecar healthy.
- Providers, models, extensions, registry, channels, and automations routes all
  returned 200.
- Active model: `nearai` / `zai-org/GLM-5.1-FP8`.
- Provider catalog count observed: `26`.

### Post-change validation

| Check                                                  | Result       |
| ------------------------------------------------------ | ------------ |
| `node --check` changed Chat/Workbench/store modules    | pass         |
| thread attention detail unit tests                     | 3/3 pass     |
| focused Workbench rail unit tests                      | 7/7 pass     |
| targeted Workbench/lib unit run                        | 39/39 pass   |
| `npm run prepare:webui-static`                         | pass         |
| focused Workbench route/browser tests                  | 3/3 pass     |
| full Workbench Playwright (`workbench-static.spec.ts`) | 25/25 pass   |
| static JS unit suite (`npm run test:static`)           | 689/689 pass |
| static/a11y browser suite (`npm run test:a11y-static`) | 94/94 pass   |
| `verify:static-frontend`                               | OK           |
| live wiring probe                                      | pass         |
| in-app Browser rendered QA                             | pass         |

### Current truth

The Workbench rail is now more useful with current functionality: if Chat has
seen a real pending gate, Workbench can describe that exact waiting action
instead of showing generic "approval waiting" filler. The durable product gap
remains: there is still no server-backed `GET /approvals` or global pending
work feed, so gates from other devices or never-opened background threads cannot
be recovered authoritatively yet.

## Loop 15 — 2026-06-20 ~00:45 local — Coordinator resume: a11y focus pass + independent QA

Codex's 14-loop run completed and went quiet (~16 min no edits). The coordinator
re-took the tree (Codex had been the live editor; the coordinator had paused all
edits per operator instruction until Codex finished) and resumed.

### Re-baseline on Codex's final tree — ALL GREEN

689 unit, 25 Workbench Playwright, 27 a11y, verify:static-frontend OK,
check:static-bundle OK. No regressions from the 14 loops.

### What changed (coordinator, this loop)

- Carried over two still-open, now-uncontended fixes (Codex had not addressed
  them): inspector Escape-to-close in `workbench-page.js`, and a best-effort
  `.catch` on the model-switch cache `invalidateQueries` in
  `hooks/useWorkbenchStart.js` so a refetch rejection can no longer be
  misreported as a model-switch failure (switch-before-send ordering preserved).
  The earlier `savedArtifactText` base64→allowlist honesty fix survived Codex's
  packet-model split and is intact (`lib/workbench-work-items.js`).
- A11y focus pass (the QA's three confirmed safe fixes):
  - New reusable `hooks/useDialogFocus.js` (mirrors `design-system/modal.js`):
    focus-move-on-open, focus-restore-on-close, optional Tab/Shift+Tab trap;
    targets the first enabled/visible control, falls back to the panel.
  - `ApprovalModal` (true `aria-modal`) now traps + moves + restores focus.
  - Sources / Cadence / Work-mode inspectors now move focus in on open and
    restore to the opener on close (no role change — kept `role=complementary`
    so the 17 spec selectors stay green).
  - `.wb13-inspector-head` close (X) button now has a 44x44 tap target
    (`styles/overlays.js`).

### Independent adversarial QA (workflow over the full post-Codex tree)

4 read-only lanes (regression/correctness, honesty/banned-copy, a11y deep, DoD +
visual) → adversarial verify → synthesis. Verdict: **safe-with-minor-followups,
zero regressions**. 54 of Codex's loop claims independently confirmed against
source. Non-negotiables hold: banned copy only in negative test assertions; the
base64/binary allowlist is real; model/effort are separate surfaces;
approvals/receipts are never fabricated (`PacketAppbar` returns null without real
data). The three a11y items above were the QA's confirmed safe autofixes — now
landed.

### Validation (post-a11y pass)

| Check                                             | Result                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `node --check` whole workbench tree               | clean                                                             |
| full static unit suite (`npm run test:static`)    | 689/689 pass                                                      |
| Workbench Playwright (`workbench-static.spec.ts`) | 28/28 pass (added Escape + inspector-focus + approval-trap tests) |
| a11y (`a11y-static.spec.ts`)                      | 27/27 pass                                                        |
| `npm run prepare:webui-static`                    | pass                                                              |
| `verify:static-frontend`                          | OK                                                                |
| `check:static-bundle`                             | OK (only pre-existing tesseract WARN)                             |

### Rendered evidence (outside repo)

- `/tmp/ironclaw-workbench-final-002218/` — dark-mode home (bg rgb(11,16,22)),
  blank home mounts no empty packet/files panels, 0 overflow desktop+mobile,
  work-mode inspector closes on Escape in the live render.
- `/tmp/ironclaw-workbench-a11y-004401/` — sources inspector open; close button
  measured 44x44; focus confirmed inside the inspector on open.

### Current truth

The Workbench scaffold is internally consistent, honest, and a11y-complete for
its overlays, and the QA gate says it is safe to bring toward main. The remaining
work is product/back-end, not correctness: (1) artifact-type-specific saved-work
BODY layouts (labels already adapt; body does not); (2) decide drawer-vs-dialog
semantics for the inspectors (promoting to `role=dialog` would require updating
17 spec selectors in the same change) and add the inspector Tab trap if promoted;
(3) the durable backend feeds from the wiring map (saved-Work read, approvals,
receipts, automation writes, memory, global pending) plus Google OAuth setup —
all currently shown honestly as staged/empty/unavailable.

## Loop 16 — 2026-06-20 ~07:00 local — Saved Work source boundary and G1 honesty pass

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Added `readSavedWorkSnapshot()` in
  `crates/ironclaw_webui_v2_static/static/js/pages/chat/lib/work-product-save.js`.
  It preserves the existing `readSavedWorkItems()` API but now exposes source
  metadata for local, unavailable, and corrupt storage states.
- Threaded the snapshot through Workbench and Work:
  - Workbench keeps `savedWorkSnapshot` state and passes it to Library.
  - Library renders a small `Local profile` source strip:
    "Showing artifacts saved from this desktop profile. Server-backed Work
    history is not wired yet."
  - Work route shows the same source truth in its saved-work rail and empty state.
- Added focused tests so this does not regress back into a silent fake library:
  - `work-product-save.test.mjs` covers local/unavailable/corrupt snapshots.
  - `workbench-static.spec.ts` asserts the Library source strip.
  - `work-product-static.spec.ts` asserts the Work reader source strip.
- Updated `workbench-backend-wiring-map-2026-06-20.md`: G1 is now a partial
  local-source honesty boundary, not a solved backend read.

### Rendered evidence

- In-app Browser flow:
  `/v2/workbench?token=workbench-static-token` -> click `Library` ->
  `workbench-library-source` visible.
- Browser checks:
  - URL: `http://127.0.0.1:1435/v2/workbench?token=workbench-static-token`.
  - Title: `IronClaw`.
  - Not blank: Workbench navigation + command surface present.
  - Framework overlay: absent.
  - Console warnings/errors: none in the in-app Browser validation.
  - Interaction proof: Library opened and source text exactly included
    `Local profile` plus `Server-backed Work history is not wired yet.`
- Screenshot evidence:
  `/tmp/ironclaw-workbench-loop15-library-source-seeded.png`
  - Seeded saved item: `Northwind services amendment`.
  - Width/scrollWidth: `1440/1440`.
  - Console errors in the mocked screenshot run: none.
  - In-app Browser screenshot capture itself timed out at the CDP capture layer,
    so the image file was captured with a one-off Playwright pass using the same
    local static server and mocked API responses.

### Validation

| Check                                                                    | Result       |
| ------------------------------------------------------------------------ | ------------ |
| `node --check` changed saved-work/workbench/work modules                 | pass         |
| `node --test .../work-product-save.test.mjs`                             | 12/12 pass   |
| targeted Workbench unit run                                              | 45/45 pass   |
| `npm run prepare:webui-static`                                           | pass         |
| focused Workbench Library route test                                     | 1/1 pass     |
| focused Work route test                                                  | 1/1 pass     |
| combined Workbench + Work-product Playwright specs                       | 34/34 pass   |
| full static JS unit suite (`npm run test:static`)                        | 691/691 pass |
| static/a11y/browser suite (`npm run test:a11y-static`, standalone rerun) | 97/97 pass   |
| `npm run verify:static-frontend`                                         | OK           |

### Current truth

Saved Work now clearly tells the user that the visible library is the local
desktop profile, and it has explicit unavailable/corrupt read states. The real
G1 product work remains: add a durable server-backed `GET /work` reader, then
make `readSavedWorkSnapshot()` merge or replace local profile data with the
authoritative Work history.

## Loop 17 — 2026-06-20 ~08:00 local — Thread-list pending gate adapter for G2

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Extended `threadAttentionDetailFromGate()` so it accepts backend-style
  snake_case gate fields (`tool_name`, `run_id`, `gate_ref`, `provider_id`,
  `account_label`) as well as the existing camelCase live-gate shape.
- Added a Workbench rail adapter in `workbench-state.js`:
  - Direct thread `attention_detail` / `attentionDetail` is normalized.
  - Thread `pending_gate`, `pending_gates`, `approval_gate`, and `auth_gate`
    fields are converted into the same attention-detail shape.
  - Backend/thread-list detail wins over browser-local fallback detail; the
    local `thread-attention-details` map remains the fallback for current-session
    gates when `/threads` is thin.
- Added unit coverage for backend pending gates and direct thread attention
  detail precedence.
- Added a static browser regression:
  `/v2/workbench` renders `Approve Slack reply to finance` from the mocked
  `/api/webchat/v2/threads` payload without localStorage-seeded attention detail.
- Updated the backend wiring map: G2 now has partial browser-local plus embedded
  `/threads` row coverage, but still no authoritative `GET /approvals` list or
  resolve feed.

### Important bug caught during validation

The first unit run caught that `normalizeThreadAttentionDetail()` defaulted to
`{}`, so a missing thread detail became a generic `Decision waiting` row and
masked better fallback data. Fixed by making missing input return `null`; the
same focused test run then passed.

### Validation

| Check                                                    | Result       |
| -------------------------------------------------------- | ------------ |
| `node --check` changed attention/workbench state modules | pass         |
| focused attention + Workbench rail unit tests            | 13/13 pass   |
| `npm run prepare:webui-static`                           | pass         |
| focused browser gate-detail tests                        | 2/2 pass     |
| full Workbench Playwright spec                           | 29/29 pass   |
| full static JS unit suite (`npm run test:static`)        | 694/694 pass |
| static/a11y/browser suite (`npm run test:a11y-static`)   | 98/98 pass   |
| `npm run verify:static-frontend`                         | OK           |

### Current truth

Workbench can now show a specific waiting decision from either current-session
Chat gate memory or from pending gate fields embedded in the thread list. This is
still not a complete approvals product: the backend must either document and
populate `pending_gates[]` on every relevant `/threads` row or add a dedicated
`GET /approvals` feed with resolve/status metadata.

## Loop 18 — 2026-06-20 ~09:00 local — Pending-gate promotion when thread state is missing/stale

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Tightened the G2 thread-list adapter in
  `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-state.js`.
  A backend `/threads` row that carries `attention_detail`, `pending_gate`,
  `pending_gates[]`, `approval_gate`, or `auth_gate` is now promoted into
  `Needs a decision` even when the coarse `state` is absent or still reports a
  stale running-like value.
- Expanded `normalizeThreadState()` so backend waiting labels normalize to the
  same needs-attention state:
  `needs_approval`, `requires_approval`, `approval_required`,
  `awaiting_approval`, `waiting_for_approval`, `auth_required`,
  `blocked_on_auth`, `needs_input`, `waiting_for_input`, and
  `requires_attention`.
- Added a rail unit regression proving that:
  - a state-less thread with `pending_gates[]` appears in `Needs a decision`;
  - a stale `running` thread with `pending_gate` auth detail is removed from
    `Working` and appears in `Needs a decision`;
  - generic stale rows without pending-gate detail do not pollute the approval
    group.
- Strengthened the browser route regression in `tests/static/workbench-static.spec.ts`
  by removing `state: 'needs_attention'` from the mocked `/threads` row. The
  rendered Workbench now proves the pending gate detail itself is enough to feed
  Active Work and triage.
- Updated `workbench-backend-wiring-map-2026-06-20.md` to make the current G2
  truth explicit: embedded pending gates now group correctly without a trustworthy
  coarse thread state, but there is still no authoritative approvals list/resolve
  feed.

### Validation

| Check                                                            | Result       |
| ---------------------------------------------------------------- | ------------ |
| `node --check crates/.../pages/workbench/lib/workbench-state.js` | pass         |
| `node --test .../workbench-state.test.mjs`                       | 10/10 pass   |
| `node --test .../thread-attention-details.test.mjs`              | 4/4 pass     |
| `npm run prepare:webui-static`                                   | pass         |
| focused Workbench pending-gate Playwright slice                  | 2/2 pass     |
| full Workbench Playwright (`workbench-static.spec.ts`)           | 29/29 pass   |
| full static JS unit suite (`npm run test:static`)                | 695/695 pass |
| static/a11y/browser suite (`npm run test:a11y-static`)           | 98/98 pass   |
| `npm run verify:static-frontend`                                 | OK           |

### Current truth

The Workbench no longer depends on the backend setting the perfect coarse thread
state before surfacing a pending approval/auth/input gate. If the thread row
contains the actual pending-gate object, the rail can show the specific waiting
decision and keep it out of generic Working. This is still a bridge, not the end
state: cross-device, never-opened-thread, and bulk resolve/status behavior still
need a documented `pending_gates[]` contract on `/threads` or a dedicated
`GET /approvals` feed.

## Loop 19 — 2026-06-20 ~10:00 local — Automation read failure honesty

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Tightened the route-backed Scheduled/Active Work rail path. Workbench already
  reads the real `/api/webchat/v2/automations?limit=50&run_limit=5` route, but a
  read failure previously collapsed to the normal empty scheduled state. That
  could imply "nothing scheduled" when the gateway simply could not be checked.
- `WorkbenchPage` now passes `automationsQuery.isError` into
  `buildWorkbenchStateRail`.
- `workbench-state.js` now renders a blocked row:
  `Scheduled work unavailable` / `Could not check` /
  `The automations feed could not be checked, so scheduled items may be missing.`
- The static Workbench mock fixture can now intentionally return a 500 from
  `/api/webchat/v2/automations`.
- Added a rendered route regression proving a failed automation read does not
  masquerade as empty Scheduled work, while preserving the existing successful
  scheduled-automation read test.
- Updated `workbench-backend-wiring-map-2026-06-20.md` to record the failure mode
  and test coverage. G4 remains unsolved for writes: cadence is still prompt-only
  until writable automation actions exist.
- Read-only backend sidecar reconfirmed there are no hidden server routes for
  saved Work, global approvals, receipts/audit/provenance, durable memory, or
  automation CRUD in this repo. It also confirmed Workbench should use timeline
  and SSE/WS for run status rather than the stale bare
  `GET /threads/{id}/runs/{runId}` probe path.

### Validation

| Check                                                  | Result       |
| ------------------------------------------------------ | ------------ |
| `node --check .../workbench-state.js`                  | pass         |
| `node --check .../workbench-page.js`                   | pass         |
| `node --test .../workbench-state.test.mjs`             | 11/11 pass   |
| `npm run prepare:webui-static`                         | pass         |
| focused Workbench automation-read Playwright slice     | 2/2 pass     |
| full Workbench Playwright (`workbench-static.spec.ts`) | 30/30 pass   |
| full static JS unit suite (`npm run test:static`)      | 696/696 pass |
| static/a11y/browser suite (`npm run test:a11y-static`) | 99/99 pass   |
| `npm run verify:static-frontend`                       | OK           |

### Current truth

The Scheduled rail is now honest in both directions: when `/automations` works,
real scheduled/running/failed/completed runs appear; when it fails, Workbench
does not pretend the user has no scheduled work. This improves read integrity
only. Creating, toggling, deleting, or directly running automations from
Workbench remains a G4 backend gap and must stay disclosed as unavailable.

## Loop 20 — 2026-06-20 ~11:00 local — Thread-list read failure honesty

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Closed the matching silent-empty hole for the shared `/api/webchat/v2/threads`
  read. The sidebar already distinguishes thread load failure from an actually
  empty thread list, but Workbench was only consuming `threadsState.threads`.
  If the list failed, the Active Work rail could imply nothing was waiting or
  recent.
- `WorkbenchPage` now passes `threadsState.isError` into
  `buildWorkbenchStateRail`.
- `workbench-state.js` now renders a blocked row:
  `Conversation list unavailable` / `Could not check` /
  `The thread list could not be checked, so waiting decisions and recent work may be missing.`
- The rail builder keeps cached thread rows visible alongside that warning, so
  a stale but still useful pending gate does not disappear when a refresh fails.
- The static Workbench mock fixture can now intentionally return a 500 from
  `/api/webchat/v2/threads`.
- Added a rendered route regression proving a failed thread read does not
  masquerade as "nothing waiting."
- Updated `workbench-backend-wiring-map-2026-06-20.md` to record the failure mode
  and test coverage. This does not solve G2 or G6; it only keeps the current
  thread-list adapter honest when the route is unavailable.

### Validation

| Check                                                  | Result       |
| ------------------------------------------------------ | ------------ |
| `node --check .../workbench-state.js`                  | pass         |
| `node --check .../workbench-page.js`                   | pass         |
| `node --test .../workbench-state.test.mjs`             | 12/12 pass   |
| `npm run prepare:webui-static`                         | pass         |
| focused Workbench feed-failure Playwright slice        | 2/2 pass     |
| full Workbench Playwright (`workbench-static.spec.ts`) | 31/31 pass   |
| full static JS unit suite (`npm run test:static`)      | 697/697 pass |
| static/a11y/browser suite (`npm run test:a11y-static`) | 100/100 pass |
| `npm run verify:static-frontend`                       | OK           |

### Current truth

The Active Work rail now treats both major read-backed feeds honestly: thread
list failures show `Conversation list unavailable`, and automation failures show
`Scheduled work unavailable`. Workbench still cannot recover cross-device
approvals or a global changed-work feed without the G2/G6 backend contracts, but
it no longer claims those feeds are empty when the gateway simply could not be
checked.

## Loop 21 — 2026-06-20 ~12:00 local — Saved Work source-state rail honesty

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`. A new background delivery note,
`workbench-mcp-delivery-2026-06-20.md`, reports a proposed future
`POST /api/webchat/v2/connectors/read` Composio read bridge. I did **not** wire
that into Workbench because the desktop repo does not currently expose that
route; the Workbench must not imply connected Gmail/Slack/Docs reads until a real
adapter can call a real endpoint.

### What changed

- Closed the matching silent-empty hole for the local Saved Work reader.
  `readSavedWorkSnapshot()` already reports `local`, `unavailable`, and
  `corrupt` source states, and Library/Work already displayed that source truth.
  The Active Work rail, however, only consumed the item array. If local storage
  was corrupt or unavailable, it could still imply there was simply no saved work.
- `WorkbenchPage` now passes the full `savedWorkSnapshot` into
  `buildWorkbenchStateRail` as `savedWorkSource`.
- `workbench-state.js` now renders blocked rail rows for local source failures:
  `Saved Work unreadable` / `Needs recovery` for corrupt storage, and
  `Saved Work unavailable` / `Unavailable` when browser storage cannot be read.
- The normal `Local profile` state remains quiet in the rail, so the UI does not
  add noise when local-only Saved Work is functioning as designed.
- Added a state-unit regression for corrupt, unavailable, and local-only source
  states.
- Added a rendered route regression that corrupts `ironclaw-work-items` in
  `localStorage` and proves `/v2/workbench` renders `Saved Work unreadable` in
  both the Active Work rail and the triage card, then proves the Library source
  strip shows the same recovery copy.
- Updated `workbench-backend-wiring-map-2026-06-20.md` to record the failure mode
  and coverage. This does not solve G1; it only keeps the local source boundary
  honest until a durable saved-work backend reader exists.

### Validation

| Check                                                   | Result       |
| ------------------------------------------------------- | ------------ |
| `node --check .../workbench-state.js`                   | pass         |
| `node --check .../workbench-page.js`                    | pass         |
| `node --test .../workbench-state.test.mjs`              | 13/13 pass   |
| `npm run prepare:webui-static`                          | pass         |
| focused Workbench feed/storage-failure Playwright slice | 3/3 pass     |
| full Workbench Playwright (`workbench-static.spec.ts`)  | 32/32 pass   |
| full static JS unit suite (`npm run test:static`)       | 698/698 pass |
| static/a11y/browser suite (`npm run test:a11y-static`)  | 101/101 pass |
| `npm run verify:static-frontend`                        | OK           |

### Current truth

The rail now treats all three currently wired local/read-backed inputs honestly:
thread list failures show `Conversation list unavailable`, automation failures
show `Scheduled work unavailable`, and corrupt/unavailable Saved Work storage
shows `Saved Work unreadable` or `Saved Work unavailable`. The product still
needs a real G1 saved-work read path before this can be cross-device or
background-run complete.

## Loop 22 — 2026-06-20 ~13:00 local — Read-only connector bridge adapter guard

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`. A newer
`workbench-mcp-delivery-2026-06-20.md` update reports the route-enabled Reborn
dev build can now return real Composio-backed inbox data through the proxy, but
Workbench still has not consumed those routes in the rail/cards/source model.

### What changed

- Preserved the background-added connector adapter surface in `lib/api.js`:
  `connectorsConnected()` and `connectorRead({ toolkit, tool, arguments })`.
- Added a client-side read-only guard to `connectorRead` so mutating Composio tool
  slugs such as `GMAIL_SEND_EMAIL` are rejected before a network request. The
  gateway still owns the hard server-side allowlist; this browser guard is a
  second contract line for future Workbench cards.
- Normalized `toolkit` and `tool` before sending to `/connectors/read`.
- Added API contract tests proving:
  - `connectorsConnected` targets `/api/webchat/v2/connectors/connected` with
    the bearer token and abort signal;
  - `connectorRead` posts the trimmed read-only body to
    `/api/webchat/v2/connectors/read`;
  - mutating tools and missing toolkits reject locally without touching `fetch`.
- Updated `workbench-backend-wiring-map-2026-06-20.md` to record the connector
  bridge as WIP, guarded, and **not yet** a Workbench source. The next safe step
  is a Workbench connector-row adapter with explicit unavailable/error states,
  then real-data browser validation through the proxy.

### Validation

| Check                                                      | Result       |
| ---------------------------------------------------------- | ------------ |
| `node --check .../lib/api.js`                              | pass         |
| `node --check .../lib/api.test.mjs`                        | pass         |
| `npx prettier --check .../lib/api.js .../lib/api.test.mjs` | pass         |
| `node --test .../lib/api.test.mjs`                         | 10/10 pass   |
| `npm run prepare:webui-static`                             | pass         |
| full Workbench Playwright (`workbench-static.spec.ts`)     | 32/32 pass   |
| full static JS unit suite (`npm run test:static`)          | 700/700 pass |
| static/a11y/browser suite (`npm run test:a11y-static`)     | 101/101 pass |
| `npm run verify:static-frontend`                           | OK           |

### Current truth

The browser now has a tested, read-only adapter boundary for deterministic MCP
reads, but the Workbench UI still does not show connector-read cards. That is
intentional for this loop: the product should only start rendering live
inbox/calendar/Slack/Docs data after it has a first-class adapter for success,
empty, blocked, unavailable, stale, and permission-denied states.

## Loop 23 — 2026-06-20 ~14:00 local — Connector read allowlist mirror fixed for live calendar

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Ingested the background Workbench connector build now present in the tree:
  `workbench-connectors.js`, `useWorkbenchConnectors.js`, and
  `workbench-arrived.js` wire the route-enabled connector bridge into the
  Workbench home surface:
  - ACTIVE Composio accounts render source readiness chips;
  - Gmail reads render the Arrived inbox card;
  - Google Calendar reads render the Upcoming card;
  - no-account, empty, and read-failure states do not fabricate data.
- Found a real client mirror bug before shipping the connector surface: the
  `connectorRead` allowlist still did not accept `FIND`/`READ` and could allow a
  mixed read+write slug such as `GMAIL_LIST_AND_DELETE_EMAILS`.
- Replaced the regex guard in `lib/api.js` with a segment classifier:
  - read verbs: `FETCH`, `LIST`, `GET`, `SEARCH`, `FIND`, `READ`;
  - write verbs reject anywhere in the slug before any network request;
  - empty segments and malformed names reject.
- Expanded `api.test.mjs` to prove:
  - `GMAIL_FETCH_EMAILS` still works;
  - suffix-verb calendar reads like `GOOGLECALENDAR_EVENTS_LIST` work;
  - `GOOGLECALENDAR_EVENTS_FIND` and `GOOGLEDOCS_DOCUMENT_READ` work;
  - `GMAIL_SEND_EMAIL`, `GMAIL_LIST_AND_DELETE_EMAILS`,
    `GOOGLECALENDAR_EVENTS_INSERT`, and `GMAIL__FETCH_EMAILS` reject without
    touching `fetch`.
- Updated `workbench-backend-wiring-map-2026-06-20.md`: the connector bridge is
  now dev-proven and consumed by Workbench, with the caveat that the packaged
  desktop sidecar still needs the route-enabled Reborn build.

### Validation

| Check                                                      | Result                                         |
| ---------------------------------------------------------- | ---------------------------------------------- |
| `node --check .../lib/api.js`                              | pass                                           |
| `node --check .../lib/api.test.mjs`                        | pass                                           |
| `npx prettier --check .../lib/api.js .../lib/api.test.mjs` | pass                                           |
| focused API + Workbench connector units                    | 20/20 pass                                     |
| `npm run prepare:webui-static`                             | pass                                           |
| full Workbench Playwright (`workbench-static.spec.ts`)     | 37/37 pass                                     |
| full static JS unit suite (`npm run test:static`)          | 710/710 pass                                   |
| static/a11y/browser suite (`npm run test:a11y-static`)     | 106/106 pass                                   |
| `npm run verify:static-frontend`                           | OK                                             |
| local connector proxy reachability                         | `/connectors/connected` 200, 8 active accounts |

### Current truth

The Workbench scaffold now has real connector-read surfaces in theory and in the
local route-enabled proxy: source readiness, Arrived inbox, and Upcoming calendar
all consume deterministic read-only connector routes. The open packaging work is
to ship the route-enabled Reborn build through the official desktop sidecar path;
until then, packaged builds without `/connectors/*` should keep these surfaces in
their hidden/error states rather than showing fake mail or events.

## Loop 24 — 2026-06-20 ~15:00 local — Manual source gate now honors live connector readiness

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Found a real split-brain path after Loop 23: the home surface could show
  `Gmail`, `Drive`, `Notion`, and `Slack` as `Ready · via Composio`, while the
  manual source picker still used only the older extension-registry readiness
  rows and could block `Slack`/`Email`/`Docs` as "not connected".
- Added `connectorFamiliesToSourceReadiness()` in `useWorkbenchStart.js`:
  - `gmail` -> `gmail`;
  - `drive` -> `google-drive`;
  - `notion` -> `notion`;
  - `slack` -> `slack`;
  - rows are marked `ready` only when the connector family itself is ready.
- Passed `connectedAccounts.families` from `workbench-page.js` into
  `useWorkbenchStart()`, so the actual `Ask` blocker and the visible connector
  chips now consume the same Composio readiness signal.
- Added unit coverage proving manual `email`, `slack`, and `docs` source
  selections unblock from active connector families without weakening the
  existing unavailable/needs-setup behavior.
- Added rendered route coverage proving:
  - no active Slack connector still blocks and does not send;
  - active Gmail/Slack/Drive connector accounts render chips, unblock manual
    Slack, and reach the existing Chat runtime request path.

### Validation

| Check                                                  | Result                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `node --check .../useWorkbenchStart.js`                | pass                                                                |
| `node --check .../workbench-page.js`                   | pass                                                                |
| `node --check .../useWorkbenchStart.test.mjs`          | pass                                                                |
| `npx prettier --check` touched Workbench files         | pass                                                                |
| focused Workbench start + connector units              | 21/21 pass                                                          |
| `npm run prepare:webui-static`                         | pass                                                                |
| focused rendered regression                            | 1/1 pass                                                            |
| full Workbench Playwright (`workbench-static.spec.ts`) | 44/44 pass                                                          |
| full static JS unit suite (`npm run test:static`)      | 725/725 pass                                                        |
| static/a11y/browser suite (`npm run test:a11y-static`) | 113/113 pass                                                        |
| `npm run verify:static-frontend`                       | OK                                                                  |
| live route-enabled proxy `/connectors/connected`       | 200, 8 active accounts                                              |
| live Workbench browser state                           | Slack selected, `Ask` enabled, blocker absent, 0 app console issues |

### Render proof

- In-app browser control loaded
  `http://127.0.0.1:1474/v2/workbench?token=wbdev`, selected manual `Slack`,
  and verified:
  - page title `IronClaw`;
  - one `workbench-page`;
  - `Ask` enabled;
  - `Slack is not connected yet` absent;
  - source readiness chips: Gmail, Calendar, Drive, Notion, Slack all
    `Ready · via Composio`;
  - no app warnings/errors.
- The in-app browser screenshot command timed out twice on
  `Page.captureScreenshot`, so screenshot capture used the repo Playwright
  fallback after the browser state check. The waited screenshot is:
  `/tmp/workbench-live-connector-ready-waited.png`.

### Current truth

The connector-backed Workbench surface is now internally consistent for manual
source starts: if a family is ready via the read-only connector bridge, the
source picker can use it. A cold live page may briefly show the older
extension-registry blocker while React Query settles; waiting for the source
readiness condition clears it and enables `Ask`. The remaining product gap is
not this gate, but durable backend breadth: saved Work reader, global approvals,
automation writes, receipts, and memory/preferences still need real routes.

## Loop 25 — 2026-06-20 ~16:00 local — Slack blocker action now has read-only rendered QA

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Ingested the background Slack blocker path now present in the Workbench tree:
  `workbench-slack.js`, `workbench-slack-blockers.js`, and
  `useConnectorSlackBlockers()` route the `Find Slack blockers` action through
  the read-only connector bridge when Slack is connected.
- Hardened the static connector fixture so tests can assert the exact
  `/api/webchat/v2/connectors/read` request body even when the route returns an
  error.
- Added rendered route coverage proving the Slack blocker action:
  - calls `SLACK_SEARCH_MESSAGES`;
  - sends the specific read query
    `blocked OR blocker OR stuck OR waiting OR unblock`;
  - renders real Slack message text and permalinks;
  - labels the result as `Read-only · nothing posted`;
  - does not start Chat or post a message;
  - degrades to an explicit Slack search error instead of fabricating an
    all-clear.
- Adjusted the manual-source readiness regression prompt so it continues to
  exercise the normal Chat runtime path rather than unintentionally triggering
  the new deterministic Slack blocker shortcut.

### Validation

| Check                                                             | Result       |
| ----------------------------------------------------------------- | ------------ |
| `node --check` Workbench connector/start/Slack modules            | pass         |
| `npx prettier --check` touched Workbench test/fixture/Slack files | pass         |
| focused Workbench start + connector + Slack units                 | 27/27 pass   |
| focused rendered Slack blocker regression                         | 2/2 pass     |
| focused readiness + Slack blocker rendered regression             | 3/3 pass     |
| `npm run prepare:webui-static`                                    | pass         |
| full Workbench Playwright (`workbench-static.spec.ts`)            | 46/46 pass   |
| full static JS unit suite (`npm run test:static`)                 | 731/731 pass |
| static/a11y/browser suite (`npm run test:a11y-static`)            | 115/115 pass |
| `npm run verify:static-frontend`                                  | OK           |

### Current truth

The Workbench can now perform a narrow, deterministic, read-only Slack blocker
lookup through the connector bridge without pretending it posted or started a
general assistant run. This is the right pattern for source-specific
"what needs me?" affordances: small, inspectable reads can render directly in
Workbench, while broader analysis still starts the normal Chat runtime with the
selected model, effort, source scope, timing, and approval boundaries.

## Loop 26 — 2026-06-20 ~17:00 local — General catch-up briefing now has GitHub, Drive, and Notion rendered QA

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Found the broader chief-of-staff briefing path already present in the tree:
  `useConnectorGithub()`, `useConnectorDrive()`, and `useConnectorNotion()`
  feed `buildBriefing()` when the user asks a catch-up question such as
  `What needs me today?`.
- Added rendered route coverage proving the deterministic briefing:
  - waits for ACTIVE GitHub, Drive, and Notion connector families;
  - calls `GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER`,
    `GOOGLEDRIVE_LIST_FILES`, and `NOTION_SEARCH_NOTION_PAGE`;
  - sends the expected read-only arguments for each connector;
  - renders real GitHub notification, Drive file, and Notion page rows;
  - preserves real external links to GitHub, Drive, and Notion;
  - labels the result as `Read-only · nothing sent`;
  - does not start Chat or fabricate an assistant answer.

### Validation

| Check                                                    | Result       |
| -------------------------------------------------------- | ------------ |
| `node --check` Workbench briefing/connector modules      | pass         |
| `npx prettier --check` touched Workbench rendered test   | pass         |
| focused briefing + connector normalizer units            | 40/40 pass   |
| focused rendered GitHub/Drive/Notion briefing regression | 1/1 pass     |
| full Workbench Playwright (`workbench-static.spec.ts`)   | 47/47 pass   |
| full static JS unit suite (`npm run test:static`)        | 750/750 pass |
| static/a11y/browser suite (`npm run test:a11y-static`)   | 116/116 pass |
| `npm run verify:static-frontend`                         | OK           |

### Current truth

The Workbench now has rendered proof that `What needs me today?` can be a
generalizable personal-chief-of-staff briefing rather than a legal-only or
email-only surface. With the route-enabled connector bridge, it can summarize
real items from GitHub, Drive, Notion, Gmail, Calendar, and active-work rails
without invoking an LLM run. Open-ended work still routes through the normal
Chat runtime with model, effort, sources, timing, and approval boundaries.

## Loop 27 — 2026-06-20 ~18:00 local — Catch-up briefing no longer turns source read failures into a false all-clear

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Found an honesty bug in the deterministic briefing path: source readiness
  comes from `/connectors/connected`, but GitHub/Drive/Notion/Gmail/Calendar
  reads can still fail independently. Before this loop, a ready-but-failing
  source could leave the briefing with empty rows and produce an all-clear
  message.
- Added `sourceProblems` to `buildBriefing()` so the model can carry read
  failures explicitly.
- Updated `WorkbenchBriefing` to render a `Could not read` section for those
  sources, while preserving the `Read-only · nothing sent` provenance.
- Threaded each connector query's `isError` state from `workbench-page.js` into
  the briefing model for Gmail, Calendar, GitHub, Drive, and Notion.
- Added unit and rendered coverage proving that failed GitHub/Drive/Notion reads
  show `3 sources could not be read`, list the failing sources, do not show
  `You're all clear` / `Inbox is clear`, and do not start Chat.

### Validation

| Check                                                  | Result       |
| ------------------------------------------------------ | ------------ |
| `node --check` touched Workbench briefing/page modules | pass         |
| focused briefing model units                           | 8/8 pass     |
| focused rendered catch-up briefing regressions         | 2/2 pass     |
| `npm run prepare:webui-static`                         | pass         |
| full Workbench Playwright (`workbench-static.spec.ts`) | 48/48 pass   |
| full static JS unit suite (`npm run test:static`)      | 757/757 pass |
| static/a11y/browser suite (`npm run test:a11y-static`) | 117/117 pass |
| `npm run verify:static-frontend`                       | OK           |

### Current truth

The deterministic briefing can now distinguish "nothing needs you" from "some
connected sources could not be read." That matters for the product's core
promise: the surface should be calm and helpful, but it cannot be falsely
reassuring when MCP/connector reads are degraded.

## Loop 28 — 2026-06-20 ~19:00 local — Reading panel can create a gated Gmail draft without sending

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Found the Workbench now had a first gated-write path in the tree:
  `workbench-draft.js` builds editable `GMAIL_CREATE_EMAIL_DRAFT` arguments,
  `WorkbenchApprove` renders the "Gated write · draft" review modal, and
  `workbench-page.js` calls `connectorWrite()` from the reading panel.
- Hardened the static connector fixture with
  `/api/webchat/v2/connectors/write`, request capture, tool-keyed responses, and
  forced-error support so rendered tests can prove write routing directly.
- Added API tests proving `connectorWrite()`:
  - posts to `/api/webchat/v2/connectors/write`;
  - sends the exact Gmail draft payload;
  - rejects off-allowlist write tools before any network request.
- Added rendered route coverage proving the reading-panel draft flow:
  - opens from a real Gmail decision card after fetching the full message body;
  - shows `Gmail · create draft (no send)`;
  - validates editable recipient, subject, and body;
  - calls `GMAIL_CREATE_EMAIL_DRAFT` through `/connectors/write`;
  - does not call `/connectors/read` for the draft tool;
  - does not start Chat or send a message;
  - renders `Draft created`, the returned draft id, and `Nothing was sent`.
- Updated the backend wiring map so the connector-read bridge and the gated
  draft-write bridge are explicitly separate. Read-only source actions remain
  read-only; outbound send still requires separate gateway authority and UI.

### Validation

| Check                                                         | Result       |
| ------------------------------------------------------------- | ------------ |
| `node --check` API / Workbench draft / approve / page modules | pass         |
| focused API + draft helper unit tests                         | 19/19 pass   |
| focused rendered Gmail draft regression                       | 1/1 pass     |
| `npm run prepare:webui-static`                                | pass         |
| full Workbench Playwright (`workbench-static.spec.ts`)        | 49/49 pass   |
| full static JS unit suite (`npm run test:static`)             | 759/759 pass |
| static/a11y/browser suite (`npm run test:a11y-static`)        | 118/118 pass |
| `npm run verify:static-frontend`                              | OK           |

### Current truth

The Workbench can now prove one safe, user-reviewable external write in the UI:
create a Gmail draft from a message the user has opened. It still does not send
mail from the Workbench, does not expose generic write tools, and does not blur
the read-only briefing/source surfaces with write behavior. This is the right
bridge from "personal chief of staff reads what needs me" into "prepare the next
action for my review" without overclaiming autonomous execution.

## Loop 29 — 2026-06-20 ~20:00 local — Decision-card draft action now uses the gated in-app flow

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Found a stale product mismatch after Loop 28: the reading panel could create a
  reviewable Gmail draft through the gated `/connectors/write` route, but the
  top-level decision-card action still said `Draft in Gmail` and opened an
  external Gmail thread link.
- Updated `WorkbenchDecisions` so the card action is now a `Draft reply` button
  that opens the same in-app `WorkbenchApprove` gated draft modal.
- Kept the explicit Gmail external link only on the inbox/reading surfaces where
  the user is plainly choosing `Open in Gmail`.
- Carried parsed `fromEmail` through `normalizeInboxMessages()`, so the
  card-level modal can prefill the recipient from real Gmail sender metadata
  instead of leaving the user to retype it.
- Updated rendered route tests to prove the decision card no longer has an
  external `href`, opens the reviewable draft modal, pre-fills recipient/subject,
  and leaves the create button disabled until the user writes body text.
- During final source hygiene, removed an embedded control byte from the email
  body sanitizer by routing C0/C1 stripping through an ASCII-only helper. This
  keeps the Workbench connector source text-safe while preserving the existing
  email-body cleanup behavior.

### Validation

| Check                                                            | Result       |
| ---------------------------------------------------------------- | ------------ |
| `node --check` Workbench connector/decision/page modules         | pass         |
| NUL-byte source scan for `workbench-connectors.js`               | clean        |
| focused connector/draft/API unit tests                           | 34/34 pass   |
| focused rendered decision-card + reading-panel draft regressions | 3/3 pass     |
| `npm run prepare:webui-static`                                   | pass         |
| full Workbench Playwright (`workbench-static.spec.ts`)           | 49/49 pass   |
| full static JS unit suite (`npm run test:static`)                | 759/759 pass |
| static/a11y/browser suite (`npm run test:a11y-static`)           | 118/118 pass |
| `npm run verify:static-frontend`                                 | OK           |

### Current truth

The "what needs me?" cards now behave like the product promise: they keep the
user inside IronClaw for a private, reviewable draft and do not bounce into a
separate Gmail compose surface. This removes a confusing old interim path while
preserving the explicit external Gmail open affordance where it belongs.

## Loop 30 — 2026-06-20 ~21:00 local — Failed Gmail draft writes stay retryable and honest

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Tightened the gated draft submit path so each retry clears the previous draft
  result before issuing the next `/connectors/write` call. This prevents a stale
  error/success result from hanging over an in-flight retry.
- Added rendered failure coverage for a `502` from
  `/api/webchat/v2/connectors/write`:
  - the modal stays open;
  - the user's draft body remains editable;
  - the error is visible inside the review modal;
  - `Create draft` remains retryable;
  - no Chat message is sent;
  - the UI does not claim `Draft created`.
- Kept the expected browser-level `Failed to load resource` console line scoped
  to the mocked 502, while still failing the test on unrelated console/page
  errors.
- Updated the backend wiring map so the Gmail draft happy path and failure path
  are both reflected in the coverage matrix.

### Validation

| Check                                                    | Result       |
| -------------------------------------------------------- | ------------ |
| `node --check` Workbench page module                     | pass         |
| focused API + draft helper unit tests                    | 19/19 pass   |
| focused rendered Gmail draft success/failure regressions | 2/2 pass     |
| `npm run prepare:webui-static`                           | pass         |
| full Workbench Playwright (`workbench-static.spec.ts`)   | 50/50 pass   |
| full static JS unit suite (`npm run test:static`)        | 759/759 pass |
| static/a11y/browser suite (`npm run test:a11y-static`)   | 119/119 pass |
| `npm run verify:static-frontend`                         | OK           |

### Current truth

The Workbench draft lane now has rendered proof for both sides of the gated
write contract: it can create a reviewable Gmail draft, and when the connector
write fails it stays in the same review surface with the user's work intact and
nothing sent. That is the behavior this product needs before broader send/post
capabilities can be trusted.

## Loop 31 — 2026-06-20 ~22:00 local — Failed full-message reads still preserve draft context

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Found a subtle fallback bug in the reading panel: when
  `GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID` failed, the drawer still showed the row
  subject honestly, but the `Draft reply` action could pass the failed
  `{ ok:false }` message object into the draft modal instead of the selected
  inbox row.
- Updated `WorkbenchReadingPanel` so the draft source is the full message only
  when `message.ok` is true; otherwise it falls back to the selected row
  metadata.
- Extended the failed-full-message rendered regression to prove the error state:
  - shows the honest panel error and row subject;
  - opens the same gated `Gmail · create draft (no send)` modal;
  - pre-fills `ops@example.com` and `Re: Quarterly numbers` from the inbox row;
  - creates `GMAIL_CREATE_EMAIL_DRAFT` with the preserved `thread-bad`
    `thread_id`;
  - fabricates no full email body.
- Updated the backend wiring map so this is treated as a first-class failure
  mode, not an accidental side effect of the happy-path draft test.

### Validation

| Check                                                             | Result       |
| ----------------------------------------------------------------- | ------------ |
| `node --check` Workbench reading panel module                     | pass         |
| focused rendered Gmail draft success/failure/failed-read fallback | 3/3 pass     |
| `npm run prepare:webui-static`                                    | pass         |
| full Workbench Playwright (`workbench-static.spec.ts`)            | 50/50 pass   |
| full static JS unit suite (`npm run test:static`)                 | 759/759 pass |
| static/a11y/browser suite (`npm run test:a11y-static`)            | 119/119 pass |
| `npm run verify:static-frontend`                                  | OK           |

### Current truth

The Gmail draft lane now survives both important connector degradations: a
failed full-message read and a failed draft write. If the full body cannot be
read, the user sees the error and no invented content, but can still prepare a
safe, reviewable reply draft from known row metadata. If the write fails, the
review modal stays open with the user's text intact. Nothing sends.

## Loop 32 — 2026-06-20 ~23:00 local — Catch-up waits for real connector reads before summarizing

Heartbeat resumed the Workbench overhaul. Re-inspected the dirty tree first and
left unrelated/generated/background changes intact on
`codex/workbench-overhaul-backend-loop`.

### What changed

- Found a timing bug in the deterministic catch-up path: if the user asked
  "What needs me today?" while a ready connector read was still in flight, the
  Workbench could build the briefing from empty arrays and risk a false
  all-clear.
- Extended the connector hooks to expose `isFetching` for Calendar, GitHub,
  Drive, and Notion, matching Gmail's existing fetching signal.
- Added `briefingPending` orchestration in `workbench-page.js`: catch-up asks now
  show an explicit checking state while connected-tool reads are still pending,
  then automatically render the real briefing when those reads settle.
- Added a loading branch to `WorkbenchBriefing` with honest copy:
  "Checking your connected tools before summarizing." It lists the pending
  read-only sources and says nothing is being sent.
- Extended the static Workbench mock fixture with per-tool connector read delays,
  then added a rendered regression that delays the GitHub notification read,
  clicks the catch-up ask during the delay, proves the UI does not show
  "You're all clear", and then proves the real GitHub row appears.
- Updated the backend wiring map so in-flight connector reads are documented as
  a handled failure/timing mode.

### Validation

| Check                                                  | Result       |
| ------------------------------------------------------ | ------------ |
| `node --check` Workbench connector/briefing/page files | pass         |
| focused briefing/GitHub unit tests                     | 12/12 pass   |
| focused rendered catch-up regressions                  | 3/3 pass     |
| `npm run prepare:webui-static`                         | pass         |
| full Workbench Playwright (`workbench-static.spec.ts`) | 51/51 pass   |
| full static JS unit suite (`npm run test:static`)      | 759/759 pass |
| static/a11y/browser suite (`npm run test:a11y-static`) | 120/120 pass |
| `npm run verify:static-frontend`                       | OK           |

### Current truth

The Workbench catch-up surface is now less likely to lie under normal network
latency. It waits on real connected-tool reads before summarizing, shows a calm
checking state while waiting, and still sends nothing to Chat or external tools.
This remains a deterministic browser-side briefing; the larger **G6** gap is
still an authoritative server-side pending/changed feed.

## Loop 33 — 2026-06-21 ~00:00 local — Catch-up includes Slack blocker context on demand

Heartbeat resumed the Workbench overhaul. Re-inspected the tree first. The
active branch is now `workbench-overnight-20260620`, and the tree was clean
before this loop's edits, so no branch switching or cleanup was done.

### What changed

- Found that Slack was only represented through the explicit `Find Slack
blockers` chip or through pending Chat gates. A normal chief-of-staff ask like
  "What needs me today?" did not run Slack, even when Slack was connected.
- Kept Slack read-only and user-triggered: catch-up now enables the same
  `SLACK_SEARCH_MESSAGES` blocker search only after the user asks for a
  briefing. It does not poll Slack on page load.
- Extended the pure briefing model to carry `slack` rows, `counts.slack`, Slack
  provenance, and headline copy such as `1 Slack item`.
- Added a `Slack to check` section in the rendered briefing. Rows deep-link to
  the real Slack permalink and show readable metadata such as `cameron · #gtm`.
- Preserved the standalone `Find Slack blockers` flow. It still renders the
  dedicated blocker panel and does not collide with the general catch-up card.
- Added rendered coverage proving a catch-up ask:
  - starts `SLACK_SEARCH_MESSAGES` only after the user asks;
  - shows the checking state while the read is in flight;
  - renders Slack in the final briefing;
  - does not render the separate Slack blocker panel;
  - sends no Chat message and posts nothing to Slack.
- Updated the backend wiring map to include Slack in deterministic non-mail
  catch-up coverage.

### Validation

| Check                                                  | Result       |
| ------------------------------------------------------ | ------------ |
| `node --check` Workbench briefing/hooks/page files     | pass         |
| focused briefing + Slack unit tests                    | 15/15 pass   |
| focused rendered catch-up + Slack blocker regressions  | 6/6 pass     |
| `npm run prepare:webui-static`                         | pass         |
| full Workbench Playwright (`workbench-static.spec.ts`) | 52/52 pass   |
| full static JS unit suite (`npm run test:static`)      | 760/760 pass |
| static/a11y/browser suite (`npm run test:a11y-static`) | 121/121 pass |
| `npm run verify:static-frontend`                       | OK           |

### Current truth

The Workbench now better matches the personal chief-of-staff promise: when the
user asks what needs them, connected Slack can contribute real blocker-shaped
context alongside Gmail, Calendar, GitHub, Drive, Notion, and active work. This
is still conservative: it is keyword search, read-only, user-triggered, and
framed as "to check" rather than pretending the system has fully understood every
Slack conversation.

## Loop 34 — 2026-06-21 ~01:00 local — Slack blocker results collapse into catch-up

Heartbeat resumed the Workbench overhaul. Re-inspected the tree first on
`workbench-overnight-20260620`; it was clean before this loop's edits, so no
cleanup, staging, or branch switching was done.

### What changed

- Found a surface-coherence bug in the Slack/catch-up handoff: after a user ran
  `Find Slack blockers`, a later `What needs me today?` briefing could reuse the
  same Slack evidence but leave the standalone blocker panel competing with the
  briefing.
- Updated `workbench-page.js` so a catch-up ask dismisses the standalone Slack
  blocker panel before the briefing takes over. The cached Slack rows are still
  passed into the briefing, so no second Chat run or external write is needed.
- Tightened the Slack blocker header copy from the awkward keyword grammar to
  `possible blocker(s) in Slack`, which better reflects that the UI is surfacing
  evidence for review, not issuing a verdict.
- Added a rendered route regression proving the exact transition:
  run `Find Slack blockers`, see real Slack rows, ask `What needs me today?`,
  confirm the briefing contains the Slack row, confirm the standalone panel is
  gone, and confirm no Chat message is sent.
- Regenerated `main.bundle.js` and updated the backend wiring map with the
  duplicate-panel guard.

### Validation

| Check                                                   | Result       |
| ------------------------------------------------------- | ------------ |
| `node --check` Workbench page + Slack blocker component | pass         |
| focused rendered Slack/catch-up regressions             | 4/4 pass     |
| `npm run prepare:webui-static`                          | pass         |
| full Workbench Playwright (`workbench-static.spec.ts`)  | 54/54 pass   |
| full static JS unit suite (`npm run test:static`)       | 760/760 pass |
| static/a11y/browser suite (`npm run test:a11y-static`)  | 123/123 pass |
| `npm run verify:static-frontend`                        | OK           |

### Current truth

The Slack lane is now more coherent as a general chief-of-staff surface: a
source-specific search can be used on its own, but if the user asks for the
broader briefing afterward, Slack evidence folds into that briefing and the
surface does not present duplicate task cards. This is still read-only and
deterministic; the bigger server-side gaps remain G1 saved-work backend reads,
G2 authoritative approvals, G4 automation writes, G5 receipts, and G6 global
changed/pending feeds.
