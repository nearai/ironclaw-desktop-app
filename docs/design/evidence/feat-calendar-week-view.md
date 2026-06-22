# Calendar week-grid view (2026-06-22 12:37 EDT)

Built in response to the user's direct ask ("why can't I see my calendar view … a gcal view from
within here?"). They chose the **native week/grid** over an embedded Google Calendar iframe
(rationale: the embed only renders private events in a browser already signed into Google — blank in
the packaged desktop app — and it's Google's white UI, not our dark theme; the native grid uses the
connector data we already pull and works everywhere on-theme).

## Why it wasn't already there / why a list first
The Workbench reads the calendar through the Composio API connector (a token), NOT a signed-in
Google session — so it only gets structured event data and must render it itself. The first pass
rendered an agenda LIST; the user wanted a real calendar, so this replaces it with a 7-day week grid.

## What shipped
- `workbench-connectors.js`: `buildWeekColumns(events, { now, days })` — lays normalized calendar
  rows into a rolling 7-day week (today first), placing each event in its start-date column, sorting
  timed events chronologically, splitting all-day events, and dropping anything outside the window
  (today-onward by construction — no stale "yesterday"). Pure; `now` injectable. Replaces the
  agenda-only `groupEventsByDay`.
- `components/workbench-calendar.js`: `CalendarView` — a week grid (7 day columns, today
  accent-highlighted, all-day chips + blue time-blocks per day, weekend dimmed, empty days "—").
  Scoped `wb13-cal-*` styles using the --v2 tokens (blue #1c63d6 accent, dark surfaces, Newsreader
  day numbers). Responsive: at ≤900px the columns become a horizontal snap-scroll (works at 375px).
- `components/workbench-shell.js`: a "Calendar" dock item (+ breadcrumb).
- `workbench-page.js`: the `view==='calendar'` case; calendar read bumped 6→25 events for the week.
- `workbench-state.js`: rail "Upcoming" capped at 6 so the wider read doesn't flood it.

## Verification (live, preview 17651 → gateway 17640)
- Week grid renders live: 22 events placed across Mon 22 (1 all-day + 4) · Tue 23 (4) · Wed 24 (5) ·
  Thu 25 (5) · Fri 26 (3) · weekend empty. Today (Mon 22) accent-highlighted. Clean headers, no clip.
  (A direct connector read confirmed the placement math: today's events map to the in-window day key.)
- Desktop + 390px screenshots captured; v13 fidelity intact (serif "Your week", blue time-blocks,
  dark dock). Note: an earlier screenshot showed an empty grid — that was a cold-load (the whole rail
  was empty too); after the reads settled, all 22 events placed.
- Gate: test:static 857 (+2 buildWeekColumns tests, −2 old), a11y 140, design DT-1..6, smoke, bundle.
