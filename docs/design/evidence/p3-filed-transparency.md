# Loop #5 — suppression transparency: "N newsletters filed — not surfaced" (2026-06-22 00:20 EDT)

Suppression was silent (newsletters just vanished from needs-a-reply). Now the
deterministic briefing OWNS the filing — the v12 "handled, not surfaced" trust touch.

- `buildBriefing`: `counts.filed` = suppressed bulk count; `briefingHeadline` appends
  "N newsletters filed — not surfaced." on every branch. Suppression regression test
  extended to assert the count + headline.
- **Live-verified** (standalone :17641, "what needs me today?"): briefing headline
  "Good morning. 5 Slack items, 5 GitHub items, and 5 events on your calendar.
  6 newsletters filed — not surfaced." — **0 replies-waiting** (newsletters suppressed),
  real Slack/GitHub/calendar still counted, filing shown transparently.
- **Mandated validation re-run (PASS):** profile engine on 180 sent / 250 inbox / 98
  senders — V1 newsletter suppression 0 leaked, V2 surfaces 2 real human threads
  (john@salt.org, tjkovacs@fbi.gov), 0 bulk. Suppression stays PASS.
- **Gate green:** test:static 790, design DT-1..6, a11y 138, smoke. Frontend-only.
