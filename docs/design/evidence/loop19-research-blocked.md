# Loop #19 — long-horizon research verb: precise diagnosis (BLOCKED on web-search credential) + validation PASS (2026-06-22 05:04 EDT)

## Research verb — diagnosed, BLOCKED on a search-provider credential
Ran real agent turns against the live standalone gateway (:17640) to prove the verb e2e:
- **Plumbing works**: a math turn ("17×4, reply only the number") returned **68** via
  POST /threads → /messages (with `timezone`) → poll /timeline. Confirms agent turns run.
- **Research turn fails**: "Research the EU AI Act … 3 enforcement dates, cite sources" →
  **no reply in ~90s, ZERO tools invoked**.
- **Root cause (gateway source)**: `web-access` IS registered for the agent
  (`register_bundled_web_access_first_party_handlers`, EXA_MCP_HOST) — but it needs a
  search-provider (Exa) credential (cf. test `web_access_projects_activation_message_without_credentials`).
  The standalone has no Exa key, so the agent's web-access call can't run → the research
  turn doesn't converge. Synthesis-only research also didn't reply in the window.
- **BLOCKED on**: provisioning a web-search/Exa credential on the gateway (the user's
  domain — I won't fabricate a key), then re-verify (+ #7 convergence for long turns).
  The research scene's frontend (label/routing/framing) remains done + gate-proven.

## Mandated validation — ALL PASS
- connector suite **14/14** (`connector-live-test.mjs --write`, live Composio).
- profile engine (180 sent / 250 inbox / 98 senders): V1 0 leaked + V2 2 real human threads, 0 bulk.
