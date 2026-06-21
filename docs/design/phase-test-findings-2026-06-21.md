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
- **Real app is unaffected by the `auto` artifact:** its `config.toml` pins
  `[llm.default] model = "zai-org/GLM-5.1-FP8"` (a valid model); `auto` only hit
  the profile-less test HOME. (Verify GLM-5.1-FP8 has working credentials; if
  not, switch the default to `z-ai/glm-5.2`, which is confirmed working.)
- **Agent tool use is GATED, not broken.** The Gmail-tool turn stalls in a
  headless test because the Composio capability is `default_permission = "ask"`
  → the agent's tool call raises an approval gate with no approver to resolve it.
  That is the designed, safe behavior; in the real app the in-place approval
  gates surface it for the user to approve. (Precise gate-appears verification is
  the next test to add.)
- **Test harness fixed:** `scripts/connector-live-test.mjs` now uses a real
  model (`z-ai/glm-5.2`, override via `TEST_MODEL`) and asserts a real reply
  ("17×4=68" in an assistant message), not a prompt-echo false positive.

## In progress
- Phase 5: poller worker runs; NEXT = create/pause webui routes → create a due
  trigger → verify it FIRES end-to-end → then an honest "runs while IronClaw is
  open" create UI.
