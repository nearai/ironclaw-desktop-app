# Loop #24 (P3) — Slack blockers as a first-class rail group (2026-06-22 06:42 EDT)

Triage now spans Gmail AND Slack in the always-visible rail (not only the on-demand
briefing). The user's "triage across these sources + autosurfacing."

- `workbench-state.js`: `connectorSlackRows(slackBlockers)` maps the SLACK_SEARCH_MESSAGES
  blocker read into rail rows (channel → badge, "From @who in #channel" detail, permalink →
  href, long text truncated to 90 chars, empty-text rows dropped). New `slack` group in
  WORKBENCH_STATE_GROUPS (after "Needs a reply"), recency-order preserved. Threaded through
  `buildWorkbenchStateRail({ slackBlockers })`; `workbench-page` passes `slackBlockers.rows`.
- **Live-proven** (standalone :17641 /workbench, real Slack): before catch-up the group is
  correctly hidden (empty); after a catch-up the rail shows **SLACK BLOCKERS (8)** with real
  blocker-language messages from team channels (#gtm, #x-ai-product-feedback), each linking
  to the Slack permalink. The group then persists in the rail (vs. only the transient
  briefing). Design intact (same group/row component, dark navy + blue accent + Newsreader
  serif; screenshotted at 1180px).
- **Gate green:** test:static 822 (3 new Slack-rail tests), a11y 138, design DT-1..6, smoke,
  bundle under budget.

## Deferred (logged, not done)
An always-ON eager Slack read (so the rail shows Slack on cold load, no catch-up needed)
was implemented and reverted: it changes the catch-up briefing's in-flight read timing
(test #118 asserts the "Reading Slack…" banner while the read is in-flight at catch-up).
Making Slack eager requires decoupling the rail's Slack read from the briefing summarize
flow + redesigning that test — a deliberate change, not a one-line gate fix. The rail Slack
group works today after the first catch-up; eager-on-load is the next step.
