# Phased test findings — 2026-06-21 (autonomous, against real connectors)

Honest "does it actually work?" matrix. Evidence via scripts/connector-live-test.mjs
and the real `npm run tauri dev` run (real-app-e2e-evidence.md).

## ✅ Works (proven live)
- **Real app boots + Workbench populates.** `npm run tauri dev` → Tauri shell spawns
  the sidecar; frontend drives 5 connector reads + connected + llm + threads +
  extensions + automations, all 200, against the real `~/.ironclaw/reborn` profile.
- **Connector suite 14/14** — all 6 families read live, write-gate (send rejected /
  delete forbidden / draft created), approvals route, simple agent turn ("pong").
- **Phase 4 cross-tool gated writes** — Slack post / Calendar create / Notion create
  reach Composio when sends enabled (empty-arg probe), deletes forbidden. Proven.
- **Phase 6 read-route hardening** — widened write-verb denylist; bypass-tested.
- **Phase 5 infra** — `IRONCLAW_TRIGGER_POLLER_ENABLED=1` → readiness reports
  `trigger_poller: true` (the native scheduler worker spawns + runs; off by default).
- **Design overhaul** — Geist, teal/gold, Cmd+K palette, keyboard layer, unified
  shell; both themes; 138 playwright + 787 unit + a11y + DT-1..6 green.

## ⚠️ GAP found (needs work — do NOT overclaim)
- **Agent-driven connector-tool turns produce no output.** Asking the agent to
  "use your Gmail tool to read my latest email and reply with sender+subject"
  yielded an empty turn — the thread timeline stayed `[user]` only for 3.5 min
  (no assistant, no tool_activity, no gate), while a trivial "pong" turn replies
  fine. So the *deterministic* Workbench surfaces (Arrived/Upcoming/Decisions,
  drafts) populate and work, but the *agent autonomously using a connector tool*
  via "Ask" does not complete in test.
  - Likely cause: the Composio capability isn't exposed into the agent loop's
    toolset in a fresh profile (the extension is configured for the deterministic
    read route, but the agent-tool registration is separate), OR a tool-calling
    model-path stall. NEXT: trace agent-loop tool registration for the composio
    capability; confirm whether `Ask` is meant to route deterministically vs via
    agent tools.

## In progress
- Phase 5: poller worker runs; NEXT = create/pause webui routes → create a due
  trigger → verify it FIRES end-to-end → then an honest "runs while IronClaw is
  open" create UI.
