# Feature — "You" surface shows + restores learned-filed senders (2026-06-22 10:59 EDT)

Closes the visibility/control gap in the dismiss-to-learn loop (#32): the system auto-files
chronically-dismissed senders, but the user couldn't see WHICH or undo it. Now the "You" surface
(observed + correctable) also shows what it LEARNED.

- `workbench-dismissals.js`: `clearSenderDismissals(sender)` — drops all of a sender's dismissals
  so they fall below the learned-ignore threshold and surface again. (Pairs with the existing
  `learnedIgnoreSenders` + `dismissalSignalsBySender`.)
- `you-page.js`: a new gated "Auto-filed from your dismissals" section lists each learned sender
  ("filed N×") with a "Surface again" button → `clearSenderDismissals` → un-files + re-renders.
  Reuses the verified `.wb13-you-row` markup + an accent-token `.wb13-you-restore` button (same
  family as `.wb13-you-select`); section is hidden when there's nothing learned, so the default
  view is unchanged.

Verification: bundle compiles (prepare:webui-static); gate green — test:static 850 (1 new
clearSenderDismissals test), a11y 140, design DT-1..6, smoke, bundle under budget. Section logic
rests on unit-tested pure helpers (learnedIgnoreSenders/dismissalSignalsBySender). Live screenshot
deferred: the preview tool can't attach to the custom standalone since loop #33 (no env in
launch.json schema) — design fidelity preserved by construction (gated section, reused components,
no new colors).

## Mandated validation (this tick)
Profile engine re-run after the learning-loop + viewer changes: V1 newsletter suppression **0
leaked → PASS**; V2 surfaced 2 items / 0 bulk → **PASS**. Profile output (real sender data) not
committed.

The behaviour-ranked triage is now fully transparent + reversible: observed (IMPORTANT + sent
profile) → correctable (You tiers) → self-teaching (dismiss-to-learn) → and now visible + undoable
(this section).
