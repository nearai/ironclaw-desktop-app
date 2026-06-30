# P3 (goal pillar #3): newsletters NEVER surface as "needs a reply" — live (2026-06-21 23:37 EDT)

The live Workbench was surfacing The Information / Substack newsletters under "Needs
a reply" (buildBriefing + the rail's connectorReplyRows took every unread message,
no bulk filter). Fixed.

## Change (frontend-only, no gateway change)
- `lib/workbench-connectors.js`: new exported `messageIsBulk(message)` (List-Unsubscribe /
  List-Id / Precedence:bulk|list / Gmail CATEGORY_* / automated local-part — the same
  signals the validated profile engine uses). `normalizeInboxMessages` now stamps `isBulk`
  on every row.
- `lib/workbench-state.js` `connectorReplyRows`: filter `unread && !isBulk` — bulk never
  becomes a needs-reply rail row.
- `lib/workbench-briefing.js` `buildBriefing`: suppress bulk from replies-waiting +
  counts.replies.
- Regression test added (briefing test, 790 total): a newsletter (isBulk) unread message
  is excluded from replies; the human thread is kept.

## Validation
- **Gate green:** test:static 790/790, design DT-1..6, a11y 138, smoke.
- **Live data** (standalone :17641, real Gmail): of the unread inbox sample, every
  newsletter (hello@theinformation.com, inquiry@fundstratdirect.com, newsletter@mail.milkroad.com,
  *.substack.com) was suppressed; **0 surfaced as needs-a-reply**. The "Needs a reply"
  group correctly disappears when all unread is bulk.
- Profile engine V2 (earlier) confirms the inverse: real human reply threads
  (john@salt.org, tjkovacs@fbi.gov) DO surface. Suppression is correct both ways.
- Newsletters still appear in the "Arrived / recent" context area (they did arrive) —
  just never as something that needs a reply.
