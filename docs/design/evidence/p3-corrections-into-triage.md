# Loop #22 (P3) — tier corrections drive the live triage (2026-06-22 06:01 EDT)

A correction on the "You" surface now changes the day. The per-sender tier overrides
(localStorage, from loop #20) feed BOTH triage paths, so a correction reorders/suppresses
"Needs a reply" — closing the editable-perspective → triage loop the user asked for
("rank by behaviour and figure out what I need to do").

- `workbench-state.js` `connectorReplyRows(inbox, overrides)`: a VIP/Respond correction
  outranks Gmail IMPORTANT (replyRank VIP=3, Respond=2, IMPORTANT=1, else 0); an Ignore
  correction drops the sender entirely; badge reflects the tier (VIP/Respond). Threaded
  through `buildWorkbenchStateRail({ tierOverrides })`; `compareReplyRank` now sorts on
  `replyRank`.
- `workbench-briefing.js` `buildBriefing({ tierOverrides })`: same ranking + ignore-drop on
  the morning replies bucket; ignored senders also leave `counts.replies`.
- `workbench-page.js`: re-reads corrections on mount (`readTierOverrides`) and passes them
  to both builders.

**Live-proven** (standalone :17641 /workbench, real Gmail inbox):
- Correct jonathan@digitalchamber.org → **VIP**: "TDC Capitol Hill Tax Fly-In June 24th"
  jumps to **row #1 of NEEDS A REPLY, badged VIP**, above three IMPORTANT-flagged threads
  (Simon Vuille, Harshit Tiwari, Anelda Grove Dempster). Captured rail order:
  `[TDC/VIP, Coverage/Important, Re-Intro/Important, Coverage/Important]`.
- Correct the same sender → **Ignore**: the count drops **5 → 4** and the TDC row is gone;
  only the IMPORTANT threads remain.
- Design fidelity intact (Newsreader serif "What do you want handled?", blue accent, dark
  dock — no teal/Geist), 375px + 1280px both clean.

**Gate green:** test:static 819 (5 new tests: 3 rail + 2 briefing), a11y 138, design DT-1..6,
smoke, bundle under budget. Newsletter (bulk) suppression untouched — `messageIsBulk` and
its tests unchanged, so the validated suppression invariant holds by construction.
