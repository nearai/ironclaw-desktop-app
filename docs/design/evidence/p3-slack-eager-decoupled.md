# Loop #27 (P3) — Slack decoupled to eager/cold-load (2026-06-22 07:35 EDT)

Resolves the loop #24 deferral. Slack is now a first-class eager rail source like
Gmail/Calendar/GitHub/Drive/Notion — the "Slack blockers" group populates on COLD LOAD
(no catch-up needed). All six triage sources now load eagerly.

- `workbench-page.js`: `useConnectorSlackBlockers` `enabled` changed from
  `(slackBlockersActive || briefingSlackActive) && slackReady` to just `slackReady`.
- **The deferral was a false alarm.** Re-running the eager change showed the ONLY broken
  assertion was test #118 line 2056 (`connectorReadRequests == []` before catch-up — a
  laziness assertion). The catch-up briefing's "Reading Slack. Nothing is being sent."
  in-flight banner STILL works: the mock's 500ms SLACK_SEARCH delay keeps the read in-flight
  at catch-up, and the dedicated in-flight test (#119) passed unchanged.
- `tests/static/workbench-static.spec.ts` #118: line 2056 updated to assert the eager read
  is the read-only blocker search (and `sentMessages == []`) rather than that no read
  happened — reflecting that Slack now reads on load like the other sources. All other
  assertions (read-only, "1 Slack item", permalink, exactly one read) unchanged.
- **Live-proven** (standalone :17641 /workbench): cold load (no catch-up) shows **SLACK
  BLOCKERS (8)**. Rail now shows all six on cold load: NEEDS A REPLY · SLACK BLOCKERS ·
  GITHUB · UPCOMING · RECENT IN NOTION · RECENT FILES. No visual change (same group as #24).
- **Gate green:** test:static 827, a11y 138, design DT-1..6, smoke, bundle under budget.
