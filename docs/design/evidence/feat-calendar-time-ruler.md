# Calendar time-ruler week grid (2026-06-22 13:05 EDT)

Iterated the Calendar from a per-day event list into a true time-ruler week grid (the "looks like
gcal" view) after the user pushed on presentation again ("this is how it presents?").

## What shipped
- `workbench-connectors.js`: `readEventEnd` + an `end` field on normalized events; buildWeekColumns
  now tags each timed event with startMin/endMin (minutes-of-day, end clamped to the day). New pure
  `weekTimeWindow(columns)` (brackets the visible hours to the events, default 08:00–19:00) and
  `layoutDayColumn(events, winStart, winEnd)` (greedy per-cluster lane assignment → topPct/heightPct
  + leftPct/widthPct so overlapping meetings sit side-by-side).
- `components/workbench-calendar.js`: rewritten as a time-ruler grid — left hour axis, 7 day columns
  with hour gridlines, proportionally-tall event blocks, overlap lanes, an all-day band, a "now"
  line on today. Scoped `wb13-tcal-*` styles on the --v2 tokens (blue #1c63d6, dark, Newsreader).
  Horizontally scrollable (min-width) so it degrades to a swipeable week at 375px.
- `workbench-page.js`: the view is **lazy-loaded** (React.lazy + Suspense) so its grid CSS/logic
  stays out of the cold-start bundle.

## Notes from the build (honest)
- Lazy-load first rendered BLANK: React.lazy wants a `default` export but CalendarView is a named
  export — fixed by `.then((m) => ({ default: m.CalendarView }))`. (A transient gateway 502 during
  the first test muddied the diagnosis; the real cause was the named-vs-default export.)
- Cold-start budget: the time-ruler statically pushed cold-start 0.9 KB OVER (401.9/401). Lazy-load
  is the right fix and brought it to **395.5 KB** (5.5 KB headroom) — no budget bump needed.

## Verification (live, preview 17651 → gateway 17640)
- Time-ruler renders live: 7 day columns, hour axis (8a–3p auto-window), all-day band ([ooo] Chris),
  20 event blocks placed proportionally, overlap lanes working (Thu 9:00/9:30, Wed 9:00/9:00 side by
  side), today (Mon 22) accent-highlighted. Desktop + 390px screenshots; v13 fidelity intact.
- Lazy chunk (workbench-calendar-*.js) loads + mounts on first open (verified mounted=true, 7 cols,
  20 blocks).
- Gate: test:static 859 (+2 layout tests), a11y 140, design DT-1..6, smoke, **bundle PASS**
  (cold-start 395.5/401).
