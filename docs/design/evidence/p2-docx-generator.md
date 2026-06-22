# Loop #9 (P2) — real .docx work-product generator (zero-dependency) (2026-06-22 01:32 EDT)

The DOCX pillar's hard part: produce a REAL, editable Word document the user can edit
and add sources to. Built dependency-free (no JSZip → no bundle-budget impact).

- `pages/workbench/lib/workbench-docx.js`: pure-JS OOXML + a hand-rolled STORED zip
  (CRC32 + local/central headers + EOCD). `buildDocxBytes(doc)` / `buildDocxBlob(doc)`
  from a structured doc { title, subtitle, sections:[{heading,paragraphs}], sources:[] }.
  Formatting per [[feedback_legal_doc_formatting]]: Arial throughout, bold headings,
  title, and an explicit numbered **Sources** section (citations are first-class + editable).
  XML-escaped so unsafe content never breaks the package.
- **Validated it actually opens as Word:** generated /tmp/wb-sample.docx (2999 bytes) →
  `unzip -l` shows the 4 OPC parts; **python-docx opened it** and read back all 6
  paragraphs (title / subtitle / section / body / Sources / "1. Gmail thread"), with the
  first heading **bold + font Arial**. Sample committed: `evidence/wb-sample-workproduct.docx`.
- **Gate green:** test:static 797 (5 new docx tests), design DT-1..6, a11y 138, smoke,
  **bundle-size under budget** (pure JS, no library).

Next: wire it to the bar — a 'document' scene that produces structured content + a
"Download .docx" via lib/save-file.js — so DOCX work product is one click from the bar.
