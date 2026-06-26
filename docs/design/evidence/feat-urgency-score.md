# Composite urgency score — within-tier reply ranking (2026-06-22 11:57 EDT)

Rec #2 from the daily-briefing skill mining (its score.mjs scorer). Fast-follow on the same
selectTriageInbox/reply-ranking chokepoint as the reply-state gate.

## What changed
- `workbench-connectors.js`: `urgencyScore(message, { now, weights })` — a deterministic 0..1
  weighted sum over named signals (ask 0.30, deadline 0.25, age 0.20 ramped over 72h, proximity
  0.15, blocking 0.10). Pure; reads only the message's own subject/preview/timestamp/importance.
- `workbench-state.js`: `connectorReplyRows` carries `urgency`; `compareReplyRank` now sorts
  tier (VIP/Respond/Important/Unread) → **urgency** → recency. The tier stays PRIMARY, so a high
  regex score can NEVER jump the categorical lane (the skill's safety rationale) — it only reorders
  same-tier mail so "can you sign off by Friday?" beats "thanks!".
- `workbench-briefing.js`: the briefing's replies bucket gets the same tier→urgency tiebreak.

## Validation
- Unit: +1 test (urgencyScore: each signal raises the score, age ramps, bounded 0..1, pure on
  empty/null). Gate: test:static **855**, a11y 140, design DT-1..6, smoke, bundle.
- LIVE (preview 17651 → gateway 17640): scored the real inbox (20 msgs) with the shipped signal
  regexes — **3/20 carry an ask signal and float to the top** (0.54 / 0.54 / 0.37 vs the 0.245
  passive baseline). Reply rail renders 4 Important-tier items reordered by urgency-then-recency;
  no console errors; v13 fidelity intact (Newsreader serif, blue #1c63d6, dark dock — screenshot).
- Profile engine: V1 newsletter suppression 0 leaked PASS, V2 2/0 bulk PASS (urgency is a pure
  reorder WITHIN a tier — it changes order, never WHAT is surfaced, so suppression is unaffected).
- Connector reads proven live (all 7, this tick's screenshot + evals). Skipped the draft-creating
  write-test this tick: the write-gate code is untouched and re-running it clutters the mailbox with
  a draft each tick; it was 14/14 the prior tick.

Remaining fast-follow on this chokepoint: Rec #3 (content-level ask/FYI/noise classification with
self-promo demotion) — riskier (it HIDES human mail), so it lands with a file-don't-drop + audit.
