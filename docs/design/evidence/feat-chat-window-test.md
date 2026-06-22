# Chat-window streaming test (2026-06-22 09:28 EDT)

User asked: "did you run tests of the chat window?" Honest answer was no live streaming test.
Closed that gap.

- New `tests/static/chat-streaming-static.spec.ts` (2 tests, run by test:a11y-static → 140):
  1. The chat window renders an assistant reply from the timeline (kind:'assistant' content).
  2. Typing + Enter sends the typed message to the gateway (POST /threads/{id}/messages captured
     with the content) AND the reply renders.
- Modeled on the PROVEN mermaid-static contract (timeline messages carry content; the /events
  SSE is a keep-alive) — discarded the first-draft's guessed SSE frame shapes (accepted/running/
  projection_update/final_reply) which didn't match the app. Targets the real composer (the
  textarea inside data-testid 'chat-composer'; Enter-without-shift submits).
- Ran in isolation: 2/2 passed. Full gate green: test:static 839, **a11y 140**, design DT-1..6,
  smoke, bundle under budget.

## Live drive finding (honest)
Driving a real chat turn on the standalone (:17641 /chat) did NOT render a model reply. Network
shows the chat polling `GET /api/gateway/status` → **404** in a tight loop: the STAGED sidecar
binary the standalone boots does not serve that readiness endpoint, so the chat gates its send on
a readiness signal it never gets. This is a standalone/sidecar-version gap (the Tauri desktop app
ships the native bridge + a newer sidecar), NOT a chat-window UI defect — the UI is proven by the
deterministic E2E (which mocks /api/gateway/status → ready) and by the earlier API-level live
agent turn (connector-live-test "live agent turn replied"). Follow-up: either stage a sidecar that
serves /api/gateway/status, or have serve-webui-static answer it, so the standalone can drive a
live chat turn.
