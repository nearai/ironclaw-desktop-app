# Fix — standalone chat-readiness shim unblocks live chat-bar verbs (2026-06-22 10:18 EDT)

Loop #30 found the standalone can't fire chat turns: the staged sidecar 404s
`/api/gateway/status` (the Tauri desktop app answers it via its native bridge). The frontend's
non-Tauri fallback (api.js desktopGatewayStatusFallback) returns a BARE status with no
model_readiness → modelExecutionReadiness = UNVERIFIED → the composer can't send. So the
standalone — the frontend's live test harness — couldn't exercise the P2 chat-bar verbs.

Fix (dev harness only): `scripts/serve-webui-static.mjs` now answers `/api/gateway/status` with
the booted gateway's real readiness (engine_v2_enabled, llm_backend nearai, llm_model from
NEARAI_MODEL, model_readiness 'ready', model_execution_verified true — the model is verified 14/14
by connector-live-test). Only the standalone web tier; the bundle/app and the Tauri build are
untouched (they get the real bridge status).

Live-proven (standalone web tier :17641 → gateway :17640 → GLM):
- /api/gateway/status now returns model_readiness 'ready' (was 404).
- Full chat turn end-to-end: POST /threads (client_action_id) → /threads/{id}/messages
  (content+timezone+client_action_id) → run Queued → timeline poll → **ASSISTANT: "pong"** at 6s.
  The chat composer/data path the bar-verbs ride on works live on the standalone.

Gate green: test:static 849, a11y 140, design DT-1..6, smoke (exercises serve-webui-static), bundle
under budget. No app/bundle change — serve-webui-static is the dev harness.
