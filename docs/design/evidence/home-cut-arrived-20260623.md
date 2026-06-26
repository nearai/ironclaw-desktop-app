# Home cruft cut — surface 2 of 3: Arrived removed (2026-06-23 08:38 EDT)

Second of the three home surfaces the user named as cruft ("arrived? why do i need this?"). The
"Needs a decision" cards already surface what needs a reply (unread mail), and the reading panel
already exposes the full message + the Gmail deep-link — so a separate read-only Arrived inbox list
was redundant. Removed it cleanly; also swept the dead WorkbenchUpcoming/EventRow components the
surface-1 commit left orphaned in the same file.

## Removed
- `WorkbenchArrived` component + its `InboxRow` helper (the Arrived surface).
- HomeView `<WorkbenchArrived>` render + the now-dead `inboxMessages`/`inboxLoading`/`inboxError`
  HomeView props (the inbox read still feeds Decisions + the briefing via connectorInbox.messages).
- DEAD ORPHANS from the surface-1 (Upcoming) commit: `WorkbenchUpcoming` + `EventRow` components
  (no longer imported or rendered) and the now-unused imports (`cn`, `gmailMessageHref`,
  `unreadInboxCount`) in workbench-arrived.js.

## Kept (re-homed guarantees, not dropped)
- "real inbox renders + click opens the reading panel" → repurposed the inbox test onto the
  **Decisions** surface (unread → card; read mail does NOT become a card; click → reading panel).
- "INITIATED account is not shown as Ready" → kept in the same repurposed readiness test.
- "no Gmail → no surface" + "empty inbox → no fabricated cards" → re-homed onto Decisions count-0.
- "connector read failure → no fabricated mail" → re-homed onto Decisions count-0 (the briefing
  separately carries the honest source-read-failure notice — briefing source-problems test).
- "Open in Gmail deep-link exists" → already covered by the reading-panel `open-gmail` test (2715).
- "decision drafts stay in-app (gated modal, not external compose)" → kept verbatim.

## Note: lingering dead 'upcoming' config (own cleanup task)
The Upcoming removal left an internally-consistent dead chain — `WORKBENCH_FEED_GROUPS` admits
'upcoming', `workbench-feed-api.js` maps backend calendar/upcoming feeds → group 'upcoming',
`TRIAGE_EXCLUDED_GROUPS` excludes it, the shell colors it — but no rail group renders it, so such
rows render nowhere. Removing only part changes behavior, so it's deferred as its own bounded
cleanup tick (not folded into the Arrived cut). Only the comment that lied about the deleted
`WorkbenchUpcoming` was corrected.

## Proof
- Full gate GREEN: test:static 869/0, test:a11y-static 138 passed, test:design-static DT-1..6,
  smoke:webui-static PASS, bundle cold-start 396.1 KB < 401 (shaved 0.7 KB).
- Live standalone (gateway :17640, webui :17651): DOM = arrived 0, upcoming 0, decisions 1,
  sources-ready 1, coldstart 0 (live connectors), headline "What do you want handled?".
- Screenshot confirms v13 fidelity: Newsreader serif headline, blue #1c63d6 accent (Ask, rail dots,
  Draft reply), dark dock, real rail (NEEDS A REPLY 5 / SLACK BLOCKERS 1 / GITHUB 6), amber "Needs a
  decision · 5" cards, read-only posture line. No Arrived/Upcoming, no teal/Geist drift.
