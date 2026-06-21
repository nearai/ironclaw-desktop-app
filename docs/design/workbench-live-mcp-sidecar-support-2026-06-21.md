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
`--require-direct-connector-chat` passes. As of the 2026-06-21 13:22 EDT
probe, this gate passes against the rebuilt sidecar with `connected-sources.read`
activated, OpenRouter `openai/gpt-4o-mini`, one durable `/timeline` tool signal,
live SSE tool activity, and fresh post-run SSE replay of the same connector
invocation.
```

## Current Truth

The old sidecar task files in
`/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-agent-worktrees/`
are stale v8 visual implementation prompts. As of this update, Claude Code
processes are still running/resumed, but the active `claude` processes report
`cwd = ~/openclaw-knowledge`; the agent worktree reports under
`ironclaw-agent-worktrees/claude` and `ironclaw-agent-worktrees/cursor` are stale
11:24 EDT handoff notes. The worktrees have no tracked desktop edits.

Use the main desktop repo branch above as the source of truth.

Recent branch heads before this diagnostic support note:

- `6590d94 test(workbench): count timeline tool preview envelopes`
- `361e4e3 feat(workbench): replay live tool activity in run preview`
- `4bf3907 docs(workbench): refresh live wiring replay evidence`

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
- Workbench now preflights the active provider model catalog when the provider
  advertises model-list support. A NEAR AI Cloud catalog failure disables Ask
  before a doomed Chat send; providers that do not advertise model-list support
  are not blocked by this guard.
- Connector writes remain gated; Gmail send attempts must reject unless the
  backend explicitly enables send authority.
- Direct freeform Chat can now call `connected-sources.read` as a model-visible
  read-only first-party capability, route through the existing Composio
  connector proxy, and receive a successful tool result.

Resolved direct Chat bridge work:

- The earlier missing lifecycle bridge diagnosis has been addressed in
  `/tmp/gw-unify`: `connected-sources.read` is now a host-bundled,
  model-visible, read-only first-party capability that delegates to the
  existing Composio connector proxy and does not expose write methods.
- The local-dev approval gate now exempts only `connected-sources.read`, because
  the handler remains read-only and mutating provider tools are rejected by the
  connector allowlist before upstream calls.
- The local-dev lifecycle network policy now gives `connected-sources.read` a
  narrow `https://backend.composio.dev` target even though it has no runtime
  credential declarations. This is required because its credentials are resolved
  host-side through the connector proxy.
- Gateway unit/integration tests now prove:
  - the handler delegates only to `ConnectorReadPort::read`
  - activation publishes `connected-sources.read` through
    `active_model_visible_capabilities()`
  - host-runtime invocation reaches the connected-sources capability instead
    of failing as missing runtime
  - a controlled model turn can see `connected-sources.read`, register a
    provider tool call, receive a model-visible tool-result replay, and finish
- Live OpenRouter probes now prove:
  - the real model calls `connected-sources__read`
  - host runtime authorizes the dispatch without an approval block
  - the capability dispatch succeeds
  - the model returns `DIRECT_CONNECTOR_PROBE_DONE tool_used=yes reason=success`

Current non-blocking caveats:

- The live SSE event stream surfaces `connected-sources.read` as structured
  tool activity, and a fresh post-run SSE subscription replays the same
  connector activity for newly opened sessions. The Workbench run preview now
  subscribes to that same replayable event stream and merges it with durable
  `/timeline` user/assistant rows. Completed connector activity also lands in
  `/timeline` as a `capability_display_preview` envelope; the probe now parses
  that envelope so timeline, live SSE, and replay SSE all prove the same
  invocation path.
- First-party Gmail/Calendar/Drive/Notion/GitHub lifecycle packages remain
  blocked by setup in the disposable probe profile. The direct Chat proof uses
  `connected-sources.read`, which is the intended bridge to the user's existing
  Composio-backed connected data.
- OpenRouter does not advertise model-list support through the current provider
  route, so the probe verdict is `WARN` even with zero failed checks.
- The persisted user-default provider currently points at `nearai` /
  `zai-org/GLM-5.1-FP8` with `api_key_env = "NEARAI_API_KEY"`. This shell has
  `OPENROUTER_API_KEY` but no `NEARAI_API_KEY`, so the user-default provider
  probe is expected to fail the model turn with `model_credentials_unavailable`
  even though connected data remains live.

Fresh artifacts from the 2026-06-21 13:24 EDT support pass:

- Latest full Workbench + direct Chat required gate after Workbench SSE-preview
  wiring and timeline-envelope probe parsing:
  `/tmp/ironclaw-workbench-live-wiring-2026-06-21T17-22-12-969Z/probe.json`
  - verdict `WARN`, with zero failed checks
  - ready families `gmail/calendar/drive/notion/slack/github`
  - live row counts:
    `inboxMessages=3`, `calendarEvents=3`, `driveFiles=3`,
    `notionPages=3`, `githubNotifications=3`, `slackBlockers=0`
  - Workbench Ask completed, preserved live source status, and preserved the
    live source packet
  - direct Chat required gate passed with assistant marker `tool_used=yes`
  - `tool_activity_seen=true`, `tool_signal_count=5`
  - durable `/timeline` parsing returned `timeline_tool_signal_count=1`
  - `sse_tool_signal_count=2` and `replay_sse_tool_signal_count=2`
- Baseline disposable OpenRouter path:
  `/tmp/ironclaw-workbench-live-wiring-2026-06-21T15-21-19-252Z/probe.json`
  - verdict `WARN` only for OpenRouter model-list support and missing shell
    `COMPOSIO_API_KEY`
  - `8` live accounts; ready families
    `gmail/calendar/drive/notion/slack/github`
  - live row counts `3/3/3/3/3/0`
  - Workbench Ask completed with assistant reply, live source status, and live
    row packet preserved
- Direct Chat required gate:
  `/tmp/ironclaw-workbench-live-wiring-2026-06-21T15-26-20-272Z/probe.json`
  - deterministic Workbench path still completed
  - direct Chat thread/send accepted, but no assistant/tool result after `32`
    polls and `tool_signal_count = 0`
  - `summary.diagnostic_hints` includes
    `connector_proxy_not_model_visible_lifecycle_tool`
  - first-party source activation remained blocked by setup in the disposable
    profile
- User-default provider truth:
  `/tmp/ironclaw-workbench-live-wiring-2026-06-21T17-24-24-154Z/probe.json`
  - connected data still live
  - `8` accounts; ready families `gmail/calendar/drive/notion/slack/github`
  - live row counts `3/3/3/3/3/0`
  - active `nearai` / `zai-org/GLM-5.1-FP8` failed the assistant turn with
    `model_credentials_unavailable`
  - Workbench request, live source status, and live source packet still landed
    in the timeline
- Connected Sources bridge probe after rebuilding the staged sidecar:
  `/tmp/ironclaw-workbench-live-wiring-2026-06-21T16-06-00-180Z/probe.json`
  - deterministic connector reads still worked with `8` live accounts and
    ready families `gmail/calendar/drive/notion/slack/github`
  - Workbench Ask still completed with assistant reply and preserved the live
    source packet
  - `connected-sources` installed and activated for Chat source tools
  - direct Chat accepted the run but produced no assistant reply or tool
    activity after `32` attempts
  - `summary.diagnostic_hints` now includes
    `connected_sources_visible_but_not_invoked`
- Model retry probe with `OPENROUTER_MODEL=openai/gpt-4o-mini`:
  `/tmp/ironclaw-workbench-live-wiring-2026-06-21T16-08-20-170Z/probe.json`
  - `connected-sources` again activated
  - direct Chat still produced no assistant/tool activity after `40` attempts
  - model choice alone did not close the direct Chat gap
- Debug probe after approval-gate exemption but before network-policy fix:
  `/tmp/ironclaw-workbench-live-wiring-2026-06-21T16-38-03-797Z/probe.json`
  - direct Chat called `connected-sources__read`
  - host runtime authorized dispatch
  - capability failed during network obligation preparation because
    `connected-sources.read` had no explicit Composio network target
  - assistant returned
    `DIRECT_CONNECTOR_PROBE_DONE tool_used=no reason="network failure"`
- Direct Chat gate after network-policy fix and rebuilt sidecar:
  `/tmp/ironclaw-workbench-live-wiring-2026-06-21T16-43-16-056Z/probe.json`
  - no failed checks
  - `connected-sources.read` dispatch succeeded with a live Composio-backed
    output
  - assistant returned
    `DIRECT_CONNECTOR_PROBE_DONE tool_used=yes reason=success`
- Full Workbench + direct Chat gate after network-policy fix:
  `/tmp/ironclaw-workbench-live-wiring-2026-06-21T16-43-48-699Z/probe.json`
  - verdict `WARN`, with zero failed checks
  - `8` live connected accounts
  - ready families `gmail/calendar/drive/notion/slack/github`
  - live row counts:
    `inboxMessages=3`, `calendarEvents=3`, `driveFiles=3`,
    `notionPages=3`, `githubNotifications=3`, `slackBlockers=0`
  - Workbench Ask completed, preserved live source status, and preserved the
    live source packet
  - direct Chat accepted the message and assistant returned
    `DIRECT_CONNECTOR_PROBE_DONE tool_used=yes reason=success`
- SSE-aware direct connector activity and replay probe:
  `/tmp/ironclaw-workbench-live-wiring-2026-06-21T17-05-00-689Z/probe.json`
  - verdict `WARN`, with zero failed checks
  - direct Chat accepted the message, completed, and assistant returned
    `DIRECT_CONNECTOR_PROBE_DONE tool_used=yes`
  - `tool_activity_seen=true`, `tool_signal_count=4`
  - `sse_tool_signal_count=2` for `connected-sources.read`
    `started` and `completed`
  - fresh post-run SSE replay returned `replay_sse_tool_signal_count=2`
  - later corrected by the 13:22 probe parser fix: durable timeline envelopes
    were present but this earlier probe did not count them

Gateway validation now green in `/tmp/gw-unify`:

```bash
cargo fmt --all --check
cargo test -p ironclaw_reborn_composition --features webui-v2-beta,slack-v2-host-beta,root-llm-provider connected_sources -- --nocapture
cargo test -p ironclaw_reborn_composition --features webui-v2-beta,slack-v2-host-beta,root-llm-provider connected_sources_read_gets_composio_backend_network_target_without_credentials -- --nocapture
cargo test -p ironclaw_reborn_composition --features webui-v2-beta,slack-v2-host-beta,root-llm-provider bundled -- --nocapture
cargo check -p ironclaw_reborn_cli --features webui-v2-beta,slack-v2-host-beta,root-llm-provider --bin ironclaw-reborn
```

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
node scripts/probe-workbench-live-wiring.mjs --llm-backend=openrouter --activate-chat-source-tools --require-direct-connector-chat --chat-max-attempts=40 --json
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

Goal: prove direct freeform Chat can call the read-only connected-sources bridge.

Actions:

- Treat deterministic Workbench reads as working.
- Inspect how `connected-sources.read` activates and becomes visible to Chat
  tools.
- Confirm it delegates to the existing Composio connector proxy and never calls
  the connector write path.
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
cargo build -p ironclaw_reborn_cli --features webui-v2-beta,slack-v2-host-beta,root-llm-provider --bin ironclaw-reborn
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
