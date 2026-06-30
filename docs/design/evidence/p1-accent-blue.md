# P1 tick — kill the teal divergence: accent → v13 signal blue (2026-06-21 22:58 EDT)

First v13-fidelity increment on the standalone web Workbench. The live page was teal
(#0d7d6f light / #2dd4bf dark) via TWO token systems; both retargeted to v13 blue.

- **Global** `styles/app.css` `--v2-accent*` (light+dark) teal → blue (#1c63d6 / #5b9bf2).
  Verified WCAG AA holds: contrast.test "readable text meets AA (light)" + "(dark)" PASS.
- **Workbench-scoped** `pages/workbench/styles/tokens.js` `--wb-accent*` + `--wb-rail-accent`
  (light+dark) teal → blue. This is the Workbench's own token system (the Ask button,
  wb13 dots, active-nav indicator all read it).
- **Live verified** (standalone :17641 /workbench, real auth + data): Ask button
  rgb(91,155,242)=#5b9bf2, reply-dots blue, active-nav blue, **0 teal backgrounds remain**,
  no console errors.
- **Gate green:** test:static 789/789 (incl. AA contrast light+dark), design DT-1..6,
  smoke PASS, a11y pass. Geist font untouched (design contract intact).

Not yet (later ticks): Newsreader serif for display (needs the font asset); the
logo/avatar brand gradient is still teal-green (brand mark, separate from accent).
