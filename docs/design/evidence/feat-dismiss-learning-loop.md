# Feature — the dismiss-to-learn loop closes (auto-file repeatedly-dismissed senders) (2026-06-22 10:07 EDT)

Loop #20/#24 added dismiss-with-reason; #32 makes it actually LEARN. The user's words: "x it
out and provide a comment on why so it learns."

- `workbench-dismissals.js`: `SENDER_LEVEL_DISMISS_REASONS` (Just context / Not relevant / Not
  for me — vs "Already handled", which is per-item) + `learnedIgnoreSenders(dismissals, {minCount=2})`
  → Set of lowercased emails the user has filed for sender-level reasons ≥2×.
- `selectTriageInbox` takes `learnedIgnore`: new mail from a learned sender is suppressed from
  triage (decisions + rail Needs-a-reply) — UNLESS an explicit VIP/Respond/FYI correction on the
  You surface overrides it (explicit beats learned).
- `workbench-page`: `learnedIgnore = learnedIgnoreSenders(dismissals)` (memoized) → both
  triage builders.

Live-proven (standalone :17641 /workbench): injected 2 sender-level dismissals for
jonathan@digitalchamber.org → on reload his "TDC Capitol Hill" email auto-filed from BOTH
Needs-a-decision and the rail Needs-a-reply (count 3→2), without dismissing that specific email.
Reversible: an explicit correction re-surfaces the sender (unit-tested).

Gate green: test:static 849 (4 new tests: learnedIgnoreSenders + selectTriageInbox learned-ignore
+ override precedence), a11y 140, design DT-1..6, smoke, bundle under budget.
