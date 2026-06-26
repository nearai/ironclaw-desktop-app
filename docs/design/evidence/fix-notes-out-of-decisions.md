# Fix A — meeting notes / newsletters out of "Needs a decision" (2026-06-22 08:38 EDT)

User feedback: team notes ("Notes: Intents Steering Committee") were shown as "Needs a
decision" with only a "Draft reply" action, but they are context-only.

Root cause: `WorkbenchDecisions` (the "Needs a decision" card) was fed the RAW
`connectorInbox.messages` and only filtered `.unread` — it never applied `messageIsBulk`,
even though the rail's Needs-a-reply group does. So gemini-notes meeting summaries
(correctly classified bulk) still became decision cards.

Fix:
- New pure `selectTriageInbox(messages, { overrides, dismissals })` in workbench-connectors.js
  — the single source of truth for "surfaceable" inbox mail: drops bulk/newsletters/notes,
  ignore-corrected senders, and (forward-looking) dismissed rows. Mutates nothing.
- workbench-page.js: `triageInbox` memo feeds a new `decisionMessages` prop → WorkbenchDecisions
  + the hasDecisions gate. "Arrived" (the recency/context view) keeps the RAW inbox, so notes
  remain viewable as context — just not presented as action items.
- Test #130 updated: it used a newsletter ("The Information") as a decision card, which is no
  longer valid; swapped to a human sender (the test's purpose — click→reading panel — intact).

Live-proven (standalone :17641 /workbench): "Needs a decision" now shows only real human mail
(TDC tax fly-in, GDPR coverage enquiry, Re-Intro); the gemini-notes "Notes:" emails (Intents
Steering Committee / All Hands / Consulting Hour) are gone from it. They still appear in Arrived.

Gate green: test:static 830 (2 new selectTriageInbox tests), a11y 138, design DT-1..6, smoke,
bundle under budget.
