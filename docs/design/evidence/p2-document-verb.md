# Loop #12 (P2) — the "Draft" (Document) chat-bar verb (2026-06-22 02:34 EDT)

Third P2 verb. Doc-product asks were MISLABELED as "Research" (memo|brief were in the
research matcher). Now they route to a dedicated Document scene → chat → the existing
assistant work-product .docx export (chat/lib/work-product-export.js, real, 28 tests).

- New `document` scene (workbench-scenes-registry.js), ordered before research; removed
  `memo|brief` from the research matcher. Matches "draft a memo", "write a one-pager",
  "prepare a brief", "compose a letter", "as a .docx / work product". Honest framing:
  "a formatted document (headings + Sources) you can review, edit, and export to .docx —
  nothing is sent"; sharing stays gated. `commandActionLabel` → "Draft".
- Precedence preserved: contract/MSA → packet (Review), board → investor, watch/weekly →
  monitor, scheduling → Schedule, research/vendors → Research.
- **Live-verified** (standalone :17641): action label — "Draft a memo on the Q3 roadmap" →
  **Draft**; "Write a one-pager…" → **Draft**; "Redline the MSA agreement counter" → Review;
  "Research … TEE vendors" → Research; "Every weekday at 9am…" → Schedule. No console errors.
- **Gate green:** test:static 803 (new document-scene test), design DT-1..6, a11y 138, smoke.

P2 verbs now: Ask / **Draft (Document → .docx)** / Schedule / Research / Review. Next:
long-horizon research verb proof; the "You" surface.
