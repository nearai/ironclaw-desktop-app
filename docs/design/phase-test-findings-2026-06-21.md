# Phased test findings — 2026-06-21 (autonomous, against real connectors)

Honest "does it actually work?" matrix. Evidence via scripts/connector-live-test.mjs
and the real `npm run tauri dev` run (real-app-e2e-evidence.md).

## ✅ Works (proven live)
- **Real app boots + Workbench populates.** `npm run tauri dev` → Tauri shell spawns
  the sidecar; frontend drives 5 connector reads + connected + llm + threads +
  extensions + automations, all 200, against the real `~/.ironclaw/reborn` profile.
- **Connector suite 13/13** (14/14 with `--write`) — all 6 families read live,
  write-gate (send rejected / delete forbidden / draft created with `--write`),
  approvals route, and a **real agent turn** ("17×4" → "68", answer not in the
  prompt, valid model `z-ai/glm-5.2`). No false positives.
- **Phase 4 cross-tool gated writes** — Slack post / Calendar create / Notion create
  reach Composio when sends enabled (empty-arg probe), deletes forbidden. Proven.
- **Phase 6 read-route hardening** — widened write-verb denylist; bypass-tested.
- **Phase 5 infra** — `IRONCLAW_TRIGGER_POLLER_ENABLED=1` → readiness reports
  `trigger_poller: true` (the native scheduler worker spawns + runs; off by default).
- **Design overhaul** — Geist, teal/gold, Cmd+K palette, keyboard layer, unified
  shell; both themes; 138 playwright + 787 unit + a11y + DT-1..6 green.

## Agent — CORRECTED (the earlier "gap" was a test artifact)
- **The agent works with a valid model.** Root cause of the earlier empty turns:
  the throwaway-HOME tests set `NEARAI_MODEL=auto`, and `auto` is NOT a valid
  NEAR AI model — every LLM call returned `HTTP 400 "Model 'auto' not found"`,
  retried 3×, produced nothing. AND the old "pong" check was a false positive
  (it matched "pong" in the *user's own prompt*). Re-tested with a real model
  (`z-ai/glm-5.2`) and an answer NOT in the prompt: "17×4" → **"68"** — a genuine
  agent reply. So reasoning turns work.
- **Real app is unaffected by the `auto` artifact, VERIFIED:** its `config.toml`
  pins `[llm.default] model = "zai-org/GLM-5.1-FP8"`, and re-running the suite
  with `TEST_MODEL=zai-org/GLM-5.1-FP8` also passes the agent turn ("68", 13/13).
  So the model the real app actually uses completes turns — the earlier
  "model_credentials_unavailable" concern was the `auto` artifact, now resolved.
  No config change needed (`z-ai/glm-5.2` is a confirmed-working fallback).
- **SSE turn infra + the gate/approve/resume loop WORK (proven).** Earlier
  REST-polling tests were structurally blind to the live turn: the agent loop
  streams over SSE (`GET /threads/{id}/events`); the approval `gate` and
  `final_reply` are SSE frames, never REST-timeline rows. `scripts/agent-sse-e2e.mjs`
  consumes the stream like the app does and confirms: turn accepted → tools run
  (`capability_activity completed`) → `gate` raised → test POSTs
  `.../gates/{ref}/resolve {resolution:"approved"}` → **200** → run CONTINUES.
  Gate + approve + resume is real and works end-to-end. (The in-place approval
  UI consumes the same `gate` frame + resolve route.)

## ⚠️ REAL GAP: agent-driven connector use is not wired (do NOT overclaim)
- **The agent cannot directly call the configured Composio connectors.** When
  asked to "use your Gmail tool", the agent's actual tool calls are
  `builtin.extension_search` and `builtin.extension_install` — it tries to *find
  and install* the Gmail extension at runtime instead of calling a registered
  `GMAIL_FETCH_EMAILS` tool. It loops (search → install → gate → approve →
  search → install …) and never reaches a Gmail call or a `final_reply`, even at
  300s. So the connector config done via `/extensions/composio/setup` registers
  the connector for the **deterministic** read/write route (which works, 6/6
  reads) but **not** into the agent loop's capability registry.
- **Impact:** the deterministic Workbench (Arrived/Upcoming/Decisions reads,
  drafts, briefing) works without this. But agent-driven cross-tool execution
  ("do this on the Workbench" / Phase 3–4) depends on the agent having the
  connectors as callable tools — which it does not yet. This is the next real
  build item (gateway-side capability registration), exactly as plan Phase 1
  noted ("the agent-tool registration is separate from the read route").
- **NOT a model problem:** reasoning turns finish fast ("68"); the loop is the
  agent reaching for extension_install meta-tools because Gmail isn't in its
  toolset.
- **Test harness fixed:** `scripts/connector-live-test.mjs` now uses a real
  model (`z-ai/glm-5.2`, override via `TEST_MODEL`) and asserts a real reply
  ("17×4=68" in an assistant message), not a prompt-echo false positive.

## In progress
- Phase 5: poller worker runs; NEXT = create/pause webui routes → create a due
  trigger → verify it FIRES end-to-end → then an honest "runs while IronClaw is
  open" create UI.
