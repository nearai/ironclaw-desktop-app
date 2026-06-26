# Home cruft cut — surface 1 of 3: Upcoming removed (2026-06-22 15:11 EDT)

The user named three home surfaces as cruft: "connector health? why is it in here? arrived? why do
i need this? upcoming? it's a fucking calendar?". A single big-bang cut of all three broke 13 a11y +
1 static test at once (too much to land green safely), so per NO-REGRESSIONS this is done ONE clean
surface per tick. **This tick: Upcoming** (the clearest — "it's a calendar", and the Calendar tab now
owns the schedule).

## Removed
- HomeView `<WorkbenchUpcoming>` card (workbench-page.js).
- The rail 'upcoming' group (workbench-state.js WORKBENCH_STATE_GROUPS) + its row-builder
  (connectorUpcomingRows) + the now-orphaned compareByTimestampAsc — dead code, all removed.
- Tests for the removed surface: `workbench-state.test` upcoming-rail-group test (static),
  `Upcoming card renders…` + `rail Upcoming items link out…` (a11y). The `no calendar account hides
  Upcoming` test stays green (Upcoming testid is now always count-0).

## Kept
- The Calendar tab (time-ruler week grid) — the schedule lives there now, not duplicated on the home.
- The calendar connector read (still feeds the Calendar tab; window unchanged).
- Arrived + connector-health (SourceReadinessStrip) — their cuts come in their own bounded ticks.

## Proof
- Full gate GREEN: test:static 869/0, test:a11y-static 138 passed, test:design-static DT-1..6,
  smoke:webui-static, check-static-bundle-size all pass.
- Live (standalone :17641): rail groups now = [NEEDS A REPLY, SLACK BLOCKERS, GITHUB, RECENT IN
  NOTION, RECENT FILES] — NO Upcoming; Calendar tab present. Screenshot confirms v13 fidelity
  (Newsreader serif, blue #1c63d6, dark dock; no teal/Geist drift).
