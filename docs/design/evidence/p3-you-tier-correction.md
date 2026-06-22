# Loop #20 (P3) — editable perspective: correct a sender's tier (2026-06-22 05:16 EDT)

The "You" surface is now observed AND correctable — the v13 editable-perspective. A
correction pins a sender to a tier; it re-ranks immediately and persists.

- `lib/workbench-profile-overrides.js` (pure + tested, 6/6): localStorage-backed
  per-sender tier overrides; `applyTierOverrides(people, overrides)` overrides + flags +
  re-ranks (pure, case-insensitive, non-mutating); `recountTiers`; `setTierOverride`.
- `you-page.js`: each person row has a tier <select> (VIP/Respond/FYI/Filed) →
  `setTierOverride` persists + re-renders; the stats strip recounts; corrected rows show
  "you set this". Read-only to the world — nothing is sent (per-device store for now;
  gateway-memory sync is a later step).
- **Live-verified** (standalone :17641 /you): set mara@theblockchainassociation.org → VIP →
  row **moved to the top**, badge "VIP", meta "you set this"; override **persisted to
  localStorage and survived a reload** (`{"mara@…":"vip"}`).
- **Gate green:** test:static 814 (6 new override tests), a11y 138, design DT-1..6, smoke,
  bundle under budget.

Observed (P4 follow-up): the long-running standalone gateway (:17640) crashed twice under
sustained multi-tick load — a stability/hardening item, not a regression in this change.
