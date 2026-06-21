# Workbench Live MCP Sidecar Support

Date: 2026-06-21

Repo:
`/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main`

Dedicated branch:
`workbench-overnight-20260620`

Audience: Claude Code, Cursor, or any sidecar agent supplementing the
Workbench overhaul.

## Paste This Into The Sidecar

```text
You are supporting the IronClaw Desktop Workbench overhaul.

Repo:
/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main

Branch:
workbench-overnight-20260620

Read first:
- docs/design/workbench-live-mcp-sidecar-support-2026-06-21.md
- docs/design/workbench-buildout-STATUS.md
- scripts/probe-workbench-live-wiring.mjs
- crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/useWorkbenchConnectors.js
- crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/useWorkbenchStart.js
- crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-plan.js
- tests/static/workbench-static.spec.ts

Mission:
Keep advancing the Workbench toward real use with live connected data. Do not
do another speculative visual redesign. Prove and improve the path where the
Workbench reads live connected sources, carries bounded source rows into Chat,
renders honest state, and refuses to claim direct freeform MCP/tool invocation
until it is actually proven.

Loop:
1. Inspect `git status --short --branch` and preserve unrelated changes.
2. Pull/rebase only if the coordinator explicitly asks; otherwise work on the
   current branch state.
3. Run the live wiring probe and record the artifact path.
4. If the probe reveals an honest product gap, fix the smallest scoped frontend,
   test, or probe issue that closes that gap.
5. Run focused tests before broad tests.
6. Commit only if green and only if the change is complete.
7. Write `AGENT_REPORT.md` with exact commands, artifact paths, changed files,
   and remaining blockers.
8. Repeat every hour until stopped.

Hard rule:
Do not claim "live MCP/direct tool use works" unless
`--require-direct-connector-chat` passes. Today the proven path is deterministic
Workbench connector reads plus a bounded live-row packet into Chat.
```

## Current Truth

The old sidecar task files in
`/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-agent-worktrees/`
are stale v8 visual implementation prompts. As of this file, the Claude sidecar
process is still running from `ironclaw-agent-worktrees/claude`, but that
worktree has no recent file writes and no `AGENT_REPORT.md`.

Use the main desktop repo branch above as the source of truth.

Current local branch head when this file was written:

- `995d652 feat(overhaul M3): Cmd+K command palette on the Workbench`
- `cd65baf test(workbench): diagnose chat source tool activation`

Current proven behavior:

- The staged sidecar can serve `/api/webchat/v2/llm/*`.
- The staged sidecar can serve live connector routes.
- `/connectors/connected` returns live Composio-backed accounts in the user
  environment when credentials are present.
- Workbench maps live connector accounts into source families:
  Gmail, Calendar, Drive, Notion, Slack, GitHub.
- Workbench reads bounded live rows through deterministic connector calls:
  Gmail inbox, Calendar events, Drive files, Notion pages, GitHub notifications,
  and Slack search.
- Workbench Ask builds a Chat draft that includes:
  - the user's original ask
  - model and effort preference
  - source scope
  - approval boundary
  - live source readiness
  - bounded live connector rows already loaded in the Workbench
- With a working provider profile, the Workbench Ask handoff reaches the real
  Chat runtime and receives an assistant reply.
- Connector writes remain gated; Gmail send attempts must reject unless the
  backend explicitly enables send authority.

Current explicit gap:

- Direct freeform Chat does not yet invoke connected-data tools by itself.
- The diagnostic currently sees `tool_used=no` and no connector tool activity.
- First-party Gmail/Calendar/Drive/Notion/GitHub extensions require their own
  OAuth or manual-token setup and are not satisfied by the Composio account.
- Slack is not present as a first-party lifecycle extension in this build.

## Required Probe Commands

Run from the desktop repo root.

Baseline live Workbench path with a disposable OpenRouter profile:

```bash
node scripts/probe-workbench-live-wiring.mjs --llm-backend=openrouter --json
```

Full diagnostic with direct Chat measurement:

```bash
node scripts/probe-workbench-live-wiring.mjs --llm-backend=openrouter --activate-chat-source-tools --probe-direct-connector-chat --chat-max-attempts=32 --json
```

Future red/green gate for direct freeform Chat tool exposure:

```bash
node scripts/probe-workbench-live-wiring.mjs --llm-backend=openrouter --activate-chat-source-tools --require-direct-connector-chat --chat-max-attempts=32 --json
```

User-default provider truth:

```bash
node scripts/probe-workbench-live-wiring.mjs --json
```

Do not run destructive auth cleanup. Do not mutate the user's persisted Reborn
profile unless explicitly instructed. The OpenRouter probe path copies the
profile to a temporary Reborn home and cleans it up.

## Sidecar Work Lanes

### Lane A: Probe And Evidence

Goal: keep the live-data proof honest and repeatable.

Actions:

- Run the baseline OpenRouter probe.
- Run the direct connector diagnostic.
- Record artifact paths from `/tmp/ironclaw-workbench-live-wiring-*/probe.json`.
- Summarize:
  - verdict
  - failed checks
  - warnings
  - connected account count
  - ready Workbench families
  - live row counts
  - Workbench Ask assistant result
  - direct Chat tool activity
- If a probe says PASS but the artifact lacks a real assistant reply or live-row
  packet preservation, fix the probe first.

Allowed files:

- `scripts/probe-workbench-live-wiring.mjs`
- probe tests under `scripts/*.test.mjs` if present
- `docs/design/workbench-buildout-STATUS.md`

Validation:

```bash
node --check scripts/probe-workbench-live-wiring.mjs
npm run test:scripts
```

### Lane B: UI Honesty Against Live Data

Goal: make the Workbench display what the live connector path actually knows,
and nothing more.

Actions:

- Verify the source inspector shows ready families from `useConnectedAccounts`,
  not stale first-party OAuth package state.
- Verify the command send path includes live source status and bounded source
  rows only when rows were actually loaded.
- Verify disconnected sources do not render as available.
- Verify deterministic source cards degrade to hidden, empty, or error states
  without fake counts.
- Add or tighten Playwright tests where the UI could overclaim.

Allowed files:

- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/useWorkbenchConnectors.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/useWorkbenchStart.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/workbench-plan.js`
- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/workbench-sources-inspector.js`
- focused tests under `crates/.../workbench/**/*.test.mjs`
- `tests/static/workbench-static.spec.ts`

Validation:

```bash
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/*.test.mjs
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --grep "source|connector|Chat send|model|direct route" --reporter=line
```

### Lane C: Direct Chat Tool Exposure Investigation

Goal: find the backend/tool-surface reason direct freeform Chat cannot call the
Composio connector tool.

Actions:

- Treat deterministic Workbench reads as working.
- Inspect how active extensions become visible to Chat tools.
- Inspect why the active/configured Composio extension is not exposed as a
  callable tool inside a plain Chat turn.
- Do not "fix" this in frontend copy.
- Produce either:
  - a small backend patch with tests, or
  - a precise blocker note naming the missing route/registry/tool-surface hook.

Useful external source repo if present:

- `/tmp/gw-unify`
- `/Users/abhishekvaidyanathan/Documents/Playground/ironclaw`

Do not disturb unrelated gateway branches. If the gateway tree is dirty, record
that and stop before applying a patch.

Validation for any backend change must include:

```bash
cargo build -p ironclaw_reborn_cli --features webui-v2-beta
```

And then, back in the desktop repo after staging any binary intentionally:

```bash
node scripts/probe-workbench-live-wiring.mjs --llm-backend=openrouter --activate-chat-source-tools --require-direct-connector-chat --chat-max-attempts=32 --json
```

### Lane D: Provider Truth

Goal: make "works for me" explicit for the user's real provider profile.

Actions:

- Run the default provider probe without `--llm-backend=openrouter`.
- If it fails with model credentials or model catalog issues, do not hide it.
- Confirm whether Settings can switch to a working provider/model.
- If frontend can expose the provider blocker more clearly in Workbench, make a
  narrow, tested copy or state fix.

Allowed files:

- `crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/useWorkbenchStart.js`
- Workbench model/settings tests
- status docs

Validation:

```bash
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/useWorkbenchStart.test.mjs
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --grep "model|provider|Ask" --reporter=line
```

### Lane E: Render QA And Screenshots

Goal: prove the app surface renders after each meaningful UI change.

Actions:

- Use the existing static Playwright harness.
- Capture desktop and mobile screenshots only after source tests pass.
- Do not regenerate broad screenshots for doc-only changes.
- If screenshots show overlap, unreadable text, stale dummy content, or false
  connector claims, fix the source and rerun.

Validation:

```bash
npm run prepare:webui-static
npm run verify:static-frontend
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --reporter=line
```

## Hourly Loop

For a manual long-running sidecar, repeat this sequence:

```bash
date
git status --short --branch
node scripts/probe-workbench-live-wiring.mjs --llm-backend=openrouter --json
node scripts/probe-workbench-live-wiring.mjs --llm-backend=openrouter --activate-chat-source-tools --probe-direct-connector-chat --chat-max-attempts=32 --json
npm run test:scripts
node --test crates/ironclaw_webui_v2_static/static/js/pages/workbench/hooks/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/lib/*.test.mjs crates/ironclaw_webui_v2_static/static/js/pages/workbench/components/*.test.mjs
npx playwright test --config playwright.static.config.ts tests/static/workbench-static.spec.ts --grep "direct route|source|connector|Chat send|model" --reporter=line
```

Then either implement one scoped fix and rerun focused validation, or write
`AGENT_REPORT.md` saying no safe fix was available.

## Definition Of Done

Do not mark the Workbench overhaul complete until all of this is true:

- The real desktop app launches with the staged sidecar.
- User-default provider profile can complete a Workbench Ask run, or Settings
  clearly guides the user to a working provider/model without pretending it is
  usable.
- `/connectors/connected` shows the user's connected accounts.
- Workbench renders live connected source readiness accurately.
- Workbench deterministic reads produce bounded live rows where available.
- Workbench Ask carries the live source status and bounded row packet into Chat.
- The assistant returns a real response.
- External sends/posts/shares remain approval-gated and are proven rejected when
  disabled.
- Direct freeform Chat connector use either passes
  `--require-direct-connector-chat` or is explicitly documented as not yet
  available.
- Static, focused unit, route/render, and broad smoke gates pass.
- Screenshots of the main Workbench surface and active run surface exist.
