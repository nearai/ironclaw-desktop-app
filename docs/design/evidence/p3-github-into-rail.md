# Loop #25 (P3) — GitHub notifications as a rail group (2026-06-22 06:53 EDT)

Triage now spans Gmail + Slack + GitHub in the rail. Unlike Slack (lazy), GitHub reads
EAGERLY when connected (same queryKey as the briefing — React-Query dedupes, no extra read,
no test #118-style timing coupling), so the group populates on COLD LOAD.

- `workbench-state.js`: `connectorGithubRows(notifications)` maps
  GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER into rail rows (subject type → badge,
  "<reason> · <repo>" detail with reason de-underscored, html_url → href, 90-char truncation,
  title-less rows dropped). New `github` group after "Ready to review" (icon `spark`, matching
  the briefing). Threaded through `buildWorkbenchStateRail({ githubNotifications })`; page
  passes `connectorGithub.notifications`.
- **Live-proven** (standalone :17641 /workbench, real GitHub): on a cold load (no catch-up)
  the rail shows **GITHUB (6)** with real notifications (Issue mentions in public repos
  thanhtantran/agents-radar, plus nearai/ironclaw CI activity), each linking to the repo.
  Design intact (same group/row component + existing `spark` icon — no new CSS; dark navy +
  blue accent + Newsreader serif preserved).
- **Gate green:** test:static 825 (3 new GitHub-rail tests), a11y 138, design DT-1..6, smoke,
  bundle under budget.

Rail triage breadth now: Needs-a-reply (Gmail, behaviour-ranked) · Slack blockers (post
catch-up) · GitHub (eager) · approvals/blocked/working/review · Upcoming (Calendar).
