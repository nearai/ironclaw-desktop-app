# Calendar Join-link affordance (2026-06-22 13:36 EDT)

The "next-meeting / join-link affordance on the blocks" follow-up the user asked for ("ok please do
that"), on the time-ruler calendar.

## What shipped
- `workbench-connectors.js`: `readEventJoinUrl(event)` — extracts the one-click video URL from
  `hangoutLink`, a conferenceData video entry point, or a known meeting URL (Meet/Zoom/Teams/Webex)
  in the location; returns '' otherwise. `normalizeCalendarEvents` now carries `joinUrl` when present.
- `components/workbench-calendar.js`: a meeting block with a `joinUrl` links to the video call (the
  dominant action) and shows an inline accent "JOIN" pill next to the time; non-video events keep
  linking to the event page. Single anchor (valid HTML, no clutter), opens in a new tab.

## Verification (live, preview 17651 → gateway 17640)
- The live read carries join links on **20 of 25** events (Google Meet `hangoutLink`).
- Rendered: **17 of 20** visible blocks show the "JOIN" pill and link to a real meet.google/zoom URL;
  non-video events (Hume Dental, Block, [Remote] NFC June 2026) show time only. Screenshot captured;
  v13 fidelity intact (blue #1c63d6 accent pill, dark, Newsreader). No console errors.
- Gate: test:static 860 (+1 join-URL extraction test), a11y 140, design DT-1..6, smoke, bundle PASS.
