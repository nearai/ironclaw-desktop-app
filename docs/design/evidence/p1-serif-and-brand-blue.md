# P1 tick — serif display + brand mark/avatar → blue (2026-06-21 23:14 EDT)

Second v13-fidelity increment. Completes "zero teal" and adds the editorial serif display.

- **Display font** `--wb-font-display` (pages/workbench/styles/tokens.js): Geist sans →
  Newsreader-first serif stack (`"Newsreader", "Iowan Old Style", "Palatino Linotype",
  Palatino, Georgia, "Times New Roman", serif`). Body stays Geist sans. The real
  Newsreader woff2 is a dedicated later tick (bundle-size budget) — falls back to a
  system serif now, which reads editorial + faithful to v13.
- **Brand mark** `.wb13-mark` gradient + **avatar** `.wb13-avatar`: teal → v13 blue
  (#4a86db→#1c63d6→#1654b8 gradient; avatar #2f5aa8).
- **Updated the design-contract test** workbench-static.spec.ts:13 — it asserted the old
  "no serif / display is Geist" decision (and banned Georgia/Times). Rewritten to encode
  the v13 serif-display intent (body still Geist sans). This is an intentional design move
  per the goal, not a silenced regression.
- **Live-verified** (standalone :17641 /workbench, real auth+data): "What do you want
  handled?" renders serif; brand mark + avatar + active-nav blue; **0 teal anywhere**; no
  console errors; layout intact.
- **Gate green:** test:static 789, design DT-1..6, a11y 138, smoke, bundle-size under budget.
