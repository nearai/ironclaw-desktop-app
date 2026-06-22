# Loop #7 — needs-a-reply ranked by behaviour (IMPORTANT first) (2026-06-22 00:55 EDT)

needs-a-reply surfaced human mail but in raw recency order. Now it ranks by Gmail's
IMPORTANT signal (derived from how you engage a sender — clean since bulk is excluded),
the v12/Superhuman "what matters floats up" behaviour.

- `normalizeInboxMessages`: stamp `important` (IMPORTANT label) on each row.
- `connectorReplyRows`: carry `important` onto the row; badge "Important" vs "Unread".
- needs-reply group `sort: compareReplyRank` = IMPORTANT-first, then most-recent.
  (The rail re-sorts each group, so the rank lives on the group, not the row map.)
- Inbox read bumped maxResults 6 → 12 so more Primary human threads surface.
- Regression test: buildWorkbenchStateRail orders IMPORTANT human mail first, badges it,
  excludes bulk even when the bulk item is newer + "important".

**Live-verified** (standalone :17641, real Gmail): needs-a-reply order —
1. [Important] "Re: Re-Intro - Abhi and Sidney" — Harshit Tiwari
2. [Important] "Coverage Enquiry — DPO Appointment / GDPR Regulatory Exposure: NEAR AI"
3. [Important] "Coverage Enquiry — DPO … Liability: NEAR Foundation/NEAR AI"
4. [Unread]    "TDC Capitol Hill Tax Fly-In June 24th" — Jonathan Rufrano
The GDPR/regulatory + re-intro float above the tax fly-in invite; gemini-notes
suppressed, newsletters gone, no console errors.

**Gate green:** test:static 791 (new ranking test), design DT-1..6, a11y 138, smoke. Frontend-only.
