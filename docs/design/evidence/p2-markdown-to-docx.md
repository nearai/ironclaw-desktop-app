# Loop #11 (P2) — markdown → real .docx (any drafted memo/brief) + full validation (2026-06-22 02:16 EDT)

Generalizes DOCX work product beyond the briefing: ANY drafted markdown (agent output
or a paste) becomes a real, editable Word doc — the reusable core for the document verb.

- `markdownToWorkProduct(md)` (workbench-docx.js, pure + tested): #→title, ##/###→section
  headings, -/*/1.→paragraphs, a "Sources/References/Citations" heading routes its items
  into the editable Sources section; inline markdown (**bold**, *italic*, `code`,
  [label](url)→label) stripped to the run model.
- **Validated openable** (python-docx): a sample memo markdown → .docx → paragraphs read
  back ['Memo','Summary','Hello world with a link.','Sources','1. Gmail thread']
  (bold/link markers stripped, Sources routed). Sample: `evidence/wb-memo-from-markdown.docx`.
- **Gate green:** test:static 802 (3 new parser tests; 12 docx tests total), design DT-1..6,
  a11y 138, smoke, bundle-size under budget.
- **Mandated validation (does it still work for HIM after 11 ticks) — ALL PASS:**
  - connector suite **14/14** (`connector-live-test.mjs --write`, live Composio): 8 accounts,
    all 6 families read, write-gate (send rejected / delete forbidden / draft 200), agent turn.
  - profile engine (180 sent / 250 inbox / 98 senders): V1 newsletter suppression 0 leaked,
    V2 surfaces 2 real human threads (john@salt.org, tjkovacs@fbi.gov), 0 bulk.

Next: a 'document' scene that drafts via the agent then exports through markdownToWorkProduct
(one-click .docx for any memo/brief); long-horizon research verb; the "You" surface.
