# Loop #6 — needs-a-reply reads the Primary tab (real human mail, not noise) (2026-06-22 00:34 EDT)

needs-a-reply was empty/flooded: the inbox read was `in:inbox` (newsletters rank
first → after suppression, nothing human surfaced in the top results).

- `useWorkbenchConnectors.js`: inbox query → `in:inbox -category:promotions
  -category:updates -category:forums -category:social` (Gmail's own classification →
  Primary-tab human correspondence). `messageIsBulk` still suppresses any automated
  sender that slips into Primary.
- `workbench-connectors.js` BULK_LOCALPARTS: added app-notification senders
  (gemini-notes, calendar-notification, drive-shares, via-google) + hyphen boundary —
  these reach Primary without List-Unsubscribe/category labels.
- **Live-verified** (standalone :17641): needs-a-reply now shows a REAL human thread —
  "Re: Re-Intro - Abhi and Sidney — From Harshit Tiwari" (harshit.tiwari@near.foundation);
  **gemini-notes suppressed, The Information gone**; human mail present. No console errors.
- Probe (12 Primary msgs): 6 unread, 5 unread&non-bulk surface (anelda/harshit/jonathan@digitalchamber
  real work mail incl. "Coverage Enquiry — DPO Appointment / GDPR"); only notifications@github.com +
  gemini-notes suppressed.
- **Gate green:** test:static 790, design DT-1..6, a11y 138, smoke. Frontend-only.
