# Loop #26 (P3) — Notion + Drive as rail awareness groups (2026-06-22 07:12 EDT)

Rail triage now spans Gmail · Slack · GitHub · Notion · Drive · Calendar. Notion/Drive are
awareness rows (recently edited/modified, not "needs you"), placed low in the rail (after
Upcoming). Both read EAGERLY when connected (same queryKeys as the briefing — deduped, no
extra read, no test-timing coupling), so they populate on COLD LOAD.

- `workbench-state.js`: `connectorNotionRows` (title, "Edited <when>" detail, page url → href,
  icon `file`) and `connectorDriveRows` (name, mime-derived kind → badge, "Modified <when>",
  webViewLink → href, icon `folder`). Both: 90-char truncation, empty rows dropped. New
  `notion` ("Recent in Notion") and `drive` ("Recent files") groups after Upcoming. Threaded
  through `buildWorkbenchStateRail({ notionPages, driveFiles })`; page passes
  `connectorNotion.pages` / `connectorDrive.files`.
- **Live-proven** (standalone :17641 /workbench, real data): cold load shows **RECENT IN
  NOTION (6)** (a real research page, "Edited 6:55") and **RECENT FILES (6)** (a real Sheet,
  "Modified 7:06"), each linking out. Design intact (reuses group/row component + existing
  file/folder icons — no new CSS; dark navy + blue accent + Newsreader serif preserved).
- **Gate green:** test:static 827 (2 new tests), a11y 138, design DT-1..6, smoke, bundle
  under budget.

Rail breadth: Needs-a-reply (Gmail, behaviour-ranked) · Slack blockers (post catch-up) ·
GitHub (eager) · Upcoming (Calendar) · Recent in Notion (eager) · Recent files (Drive, eager)
· approvals/blocked/working/review/scheduled/receipts. Empty groups stay hidden (dense rail).
