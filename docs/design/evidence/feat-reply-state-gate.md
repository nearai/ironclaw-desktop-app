# Reply-state gate: stop surfacing threads you've already answered (2026-06-22 11:46 EDT)

Adopted from the downloaded daily-briefing skill (its replystate.mjs "bias-to-silence" gate) —
the highest-leverage idea from that skill's analysis. Turns the Workbench's "Needs a reply /
Needs a decision" from an UNREAD view into a real OPEN-LOOP queue.

## What changed
- `workbench-connectors.js`: `toEpochMs` (parse internalDate/ISO -> ms, 0 on garbage),
  `answeredThreadIndex(sentRows)` (threadId -> latest sent ts), `isAnsweredThread(msg, index)`
  (the shared rule), and `selectTriageInbox` now drops a row when there's a sent message in its
  thread dated AFTER the inbound. **Positive evidence only** — absent a later sent ts the row stays
  surfaced (hiding a real open loop is worse than one extra row).
- `useWorkbenchConnectors.js`: `useConnectorSent` — read-only `in:sent newer_than:30d` (gated on
  Gmail), used solely to build the index.
- `workbench-briefing.js`: buildBriefing takes `sentThreadIndex` and applies the same gate, so
  "Catch me up" stays consistent with the cards/rail (no thread whose card is filed is still
  narrated as waiting).
- `workbench-page.js`: wires the sent read, builds the index (useMemo), passes it to both
  selectTriageInbox and buildBriefing.

## Validation
- Unit: +4 tests (toEpochMs, answeredThreadIndex, isAnsweredThread positive-evidence-only,
  selectTriageInbox files-answered/keeps-open/backward-compatible). Gate: test:static **854**,
  a11y 140, design DT-1..6, smoke, bundle.
- LIVE (preview 17651 -> gateway 17640): the sent read fires (7th connector read, 200; **26 sent
  threads** indexed/30d), no console errors, v13 fidelity intact (screenshot). Reply-state effect
  computed on the REAL mailbox: top-12 surfaced inbox -> 0 already-answered (correctly files
  nothing — no false drops); widening to 40 inbox threads -> **1 already-answered thread correctly
  filed** (thread 19edbe6950aa4b96; user replied **~2.08h after** the inbound — inboundTs
  1781805776000, sentReplyTs 1781813269000). The mechanism is proven; it's conservative by design.
- Connector suite 14/14 (last tick) + profile engine this tick: V1 newsletter suppression 0 leaked
  PASS, V2 2/0 bulk PASS (the gate is orthogonal to bulk suppression).

This is Rec #1 from the daily-briefing skill mining. Fast-follows on the same selectTriageInbox
chokepoint: composite urgency score (Rec #2), content-level ask/FYI/noise classification (Rec #3).
