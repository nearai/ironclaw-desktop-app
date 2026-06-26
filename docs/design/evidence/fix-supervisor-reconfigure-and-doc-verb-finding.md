# Standalone supervisor self-heal (Composio) + document-verb live finding (2026-06-22 10:42 EDT)

## Fix — gateway respawn now re-configures Composio (loop #21 gap)
The loop #21 supervisor respawned the sidecar on crash, but the Composio configure lived only
in the one-time first-boot IIFE — so a self-healed gateway came back with ZERO connectors and the
rail went dark. Extracted `waitForGatewayReady()` + `configureComposio()` and run them after EVERY
(re)spawn.
- Live-proven (isolated alt ports 17646): first boot configures Composio (8 toolkits); `kill -9`
  the sidecar → "respawn #1" → **Composio re-configured (200) + all 8 connectors back** (~4s).
- Gate green: test:static 849, smoke (exercises serve-webui-static); launcher is a dev script
  (not bundled), so a11y/design/bundle are unchanged.

## Finding — document/research chat-bar verbs blocked live by #7 (longer-turn wedge)
With the chat now firing (loop #33: "pong" in 6s), I drove the document verb live. A short turn
completes; a ~100-word memo turn (with OR without tools, on a FRESH gateway) wedges at
status:'submitted' indefinitely — it never transitions to running. This is the known #7
agent-loop convergence/HostUnavailable issue in the staged sidecar — a GATEWAY-side problem, not
frontend. So the document/research verbs cannot be proven live on the standalone until #7 is
fixed (rebuild/restage a newer sidecar, or fix the agent loop in the gateway repo). The document
verb's docx-OUTPUT half (markdown → openable .docx with Sources) is separately unit-tested +
python-docx-validated; the agent-produces-the-doc half is what's blocked.
