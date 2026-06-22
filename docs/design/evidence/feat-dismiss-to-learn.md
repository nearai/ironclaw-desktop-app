# Feature C — dismiss-with-reason ("X it out + tell it why, so it learns") (2026-06-22 08:54 EDT)

User's #1 ask: on a "Needs a decision" item the only action was "Draft reply"; they want to
X it out AND give a reason, so IronClaw learns and stops surfacing similar items.

- New `workbench-dismissals.js` (localStorage `workbench:dismissed-rows`, parallel to
  tier-overrides): `readDismissals`, `dismissRow(key, { reason, sender })`, `restoreRow`,
  `isDismissed`, and `dismissalSignalsBySender` — aggregates count + distinct reasons per
  sender (the learn-loop signal the profile engine/ranking can consume to file a
  chronically-dismissed sender by default). Pure + storage-guarded.
- `selectTriageInbox` (the shared triage filter) now also drops dismissed rows, so a dismissal
  removes the item from BOTH the "Needs a decision" cards AND the rail's Needs-a-reply (the rail
  is fed the same `triageInbox`).
- UI: each decision card has a "Not for me" (ghost) button beside "Draft reply"; clicking it
  reveals an inline reason picker ("Why? IronClaw learns from this." + Just context / Already
  handled / Not relevant / Not for me / Cancel). Picking a reason files the row + persists.
  New `is-ghost` button + `.wb13-card-dismiss` styles in styles/workspace.js (wb-* tokens; no
  new colors; NOT app.css).
- **Live-proven** (standalone :17641 /workbench): clicked "Not for me" → reason picker → "Already
  handled" → the card disappeared (3→2), localStorage recorded
  `{"<msgId>":{"reason":"Already handled","sender":"harshit.tiwari@near.foundation","ts":…}}`,
  and it stayed gone across a reload. Screenshot confirms v13 fidelity (Newsreader serif, blue
  accent, dark dock — the dismiss UI blends in).
- Gate green: test:static 836 (4 new dismissals tests), a11y 138, design DT-1..6, smoke, bundle
  under budget.

Note: the captured reason+sender are stored for the profile to learn from (dismissalSignalsBySender);
auto-filing a chronically-dismissed sender is the next step (wire into the profile/ranking).
