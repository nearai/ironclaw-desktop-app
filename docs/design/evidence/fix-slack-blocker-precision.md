# Fix B — Slack "blockers" precision (no more QA status updates) (2026-06-22 08:42 EDT)

User feedback: "QA updates etc are black [Slack] blockers? why is that the case?"

Root cause: the Slack group is a keyword search (SLACK_BLOCKER_QUERY = "blocked OR blocker OR
stuck OR waiting OR unblock"). A multi-line "IronClaw QA Update … What's Working … Blocked: …
Waiting on staging" status report MENTIONS those words, so it matched and surfaced as a blocker.

Fix: new pure `textLooksLikeBlocker(rawText)` filter in workbench-slack.js, applied in
`normalizeSlackBlockers` before a row is built. A genuine blocker is terse + conversational;
a status report is long, multi-line, or report-titled. Drops:
- bodies with >= 3 non-empty lines, or > 280 chars (status reports);
- report titles even on one line ("… QA Update:", "Weekly status update", "What's Working").
Keeps short, directed asks ("blocked on X — can you unblock?", "stuck on the deploy, who can help?").

Live-proven (standalone :17641 /workbench, real Slack): SLACK BLOCKERS went from **8** (dominated
by "IronClaw QA Update" / "What's Working" / Bug Bash reports) to **1 genuine blocker** — a real
PR-review request ("Hey, can I get reviews on …/pull/3101" from @mikalai.pismiankou). No QA
updates remain.

Gate green: test:static 832 (2 new precision tests), a11y 138, design DT-1..6, smoke, bundle
under budget. No visual change.
