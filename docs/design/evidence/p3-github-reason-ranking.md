# Loop #28 (P3) — GitHub rail ranks by reason (2026-06-22 07:53 EDT)

Behaviour-ranked triage extended to GitHub. The rail surfaced GitHub notifications in raw
recency order, so bot/digest @-mentions (GitHub's version of newsletters) sat alongside
genuine action items. Now ranked by how much each reason actually needs you.

- `workbench-state.js`: `GITHUB_REASON_RANK` (review_requested/assign/security_alert=5,
  ci_activity=4, mention/team_mention=3, comment/author/state_change/invitation=2,
  subscribed/manual=1, default 1). `connectorGithubRows` stamps `githubRank`; new
  `compareGithubRank` (rank desc, then API recency within a band) set as the `github` group
  sort. Objective "needs-you-ness", not a per-user preference.
- **Live-proven** (standalone :17641 /workbench, real GitHub): the group reordered from
  recency to reason. **Before** (loop #25): "Bản tin hàng ngày" digest @-mentions
  (reason=mention, third-party agents-radar repo) appeared first. **Now**: the two CI
  failures on **nearai/ironclaw** (reason=ci_activity, rank 4) rank first; the digest
  mentions (rank 3) sink below them. Real work surfaces above GitHub-newsletter noise.
- Design unchanged (same group/row component; only the sort changed — no new CSS).
- **Gate green:** test:static 828 (1 new ranking test), a11y 138, design DT-1..6, smoke,
  bundle under budget.
