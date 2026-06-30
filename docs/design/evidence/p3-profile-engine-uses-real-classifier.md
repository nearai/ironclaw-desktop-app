# Loop #23 (P3) — validation gauntlet now tests the REAL bulk classifier (2026-06-22 06:19 EDT)

The profile-engine gauntlet (the user's "run a shitton of validation testing so you're
not surfacing newsletters") previously reimplemented bulk detection (a parallel
`BULK_LOCALPARTS` regex + `bulkMarkers`). That risked drift: the gauntlet could PASS while
the UI surfaced differently. Fixed.

- `scripts/workbench-profile-engine.mjs` now imports the UI's `messageIsBulk` from
  `workbench-connectors.js` (dependency-free, Node-importable; reads payload.headers +
  labelIds + sender — exactly the raw GMAIL_FETCH_EMAILS shape the engine pulls). A sender
  is bulk iff the UI would classify any of their mail as bulk. `bulkMarkers` is kept only
  for the diagnostic breakdown of which signals fired. If the UI's newsletter logic changes,
  the gauntlet validates the new logic automatically — no manual sync.

**Live run (standalone gateway :17640, real Gmail — 250 sent + 250 inbox):**
- **V1 newsletter suppression** — bulk senders leaked into VIP/Respond: **0 → PASS ✅**
  (validated against the actual surfaced classifier; bulk senders e.g. substack/docusign/
  perplexity/linklaters correctly land in `ignore` via list-unsubscribe/list-id/cat:updates).
- **V2 "what needs you" surfaced** — 2 items, of which bulk: **0 → PASS ✅** (both human
  senders; no newsletter surfaced as needing a reply).
- **V3 reply-prediction backtest** — temporal holdout (train-only signal, no leakage):
  train=124 test=124 (cold-start=58), tp=0 fp=0 fn=1 tn=123. Sparse positives in the window;
  no suppression failure. (Backtest is informational; V1/V2 are the suppression gates.)

**Gate green:** test:static 819 (unchanged — the engine is a script, not bundled). Profile
output (/tmp/wb-profile/, real sender data) NOT committed, per guardrail.
