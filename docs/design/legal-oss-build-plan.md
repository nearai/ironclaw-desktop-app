# IronClaw Workbench — Legal-OSS build plan (research-derived)

LICENSE POSTURE: MikeOSS (Open-Legal-Products/mike) + LexNLP + MikeRust are **AGPL-3.0** → REIMPLEMENT patterns, never copy code into the Workbench (Rust gateway + preact, network-served → AGPL §13). Reuse-OK (MIT/Apache, with attribution): preflight-mike, spreadsheet-ai, docassemble, Blackstone, Accord (cicero/ergo), OpenLaw, ContextGem, OpenContracts, claude-legal-skill.

## Sources researched

- **Open-Legal-Products/mike — github.com/Open-Legal-Products/mike (mikeoss.com), cloned to /private/tmp/claude-501/-Users-a** — license: AGPL-3.0-only (confirmed: backend/package.json "license":"AGPL-3.0-only" and root LICENSE is GNU AGPLv3). COPYLEFT + NET — 7 features
- **MikeOSS notable forks, cloned and read at /private/tmp/claude-501/-Users-abhishekvaidyanathan-openclaw-knowledge/d8ad36a** — license: Mixed per fork — MikeRust: AGPL-3.0 (reimplement patterns, do NOT copy source into the Rust gateway, which would force A — 5 features
- **Survey of 10 open-source legal-tech repos cloned and read under /private/tmp/claude-501/-Users-abhishekvaidyanathan-open** — license: Mixed — per feature below. Reuse-OK (MIT/Apache-2.0): docassemble (MIT), Blackstone (Apache-2.0), Accord Project cicero/ — 8 features

## Ranked build plan

All load-bearing claims verified against source: AGPL-3.0-only license, the `applyTrackedEdits`/`resolveTrackedChange` w:ins/w:del + fast-diff mechanics, the per-document `queryTabularAllColumns` SSE `cell_update` streaming with `column_index`/`flag`/`status`, the trailing `<CITATIONS>` JSON contract with chat-local `doc-0` labels, and the provider-agnostic `streamChatWithTools` abstraction. The research findings are accurate. Producing the build plan.

---

# IronClaw Workbench → CLO Build Plan

**Source:** Open-Legal-Products/mike (`github.com/Open-Legal-Products/mike`), cloned and read at `/private/tmp/.../scratchpad/legal-oss/mike`. **License: AGPL-3.0-only** (confirmed: root `LICENSE` is GNU AGPLv3, `backend/package.json` → `"AGPL-3.0-only"`). The Workbench is a Rust gateway + preact frontend served over a network, so AGPL §13 (network copyleft) would force the entire Workbench source open if Mike's code were copied. **Every item below is REIMPLEMENT-the-pattern, not copy-the-code.** Prompts-as-design, JSON contracts, schema shapes, and architecture are free to learn from; verbatim TS source is not.

Ranking is value × workbench-fit ÷ effort. The Workbench already has the hard parts (connector reads, SSE streaming, a gated-write checkpoint, a bounded agent loop). What it lacks is the document layer. These features bolt onto infrastructure that already exists.

---

## 1. Tabular Review — extract fields across many docs into a live grid `[HIGHEST LEVERAGE]`

**What it is + the win.** Pick a set of documents (rows), define columns (each a named extraction prompt), and the agent fills an N-docs × M-columns grid. Each cell is `{summary, flag (green/yellow/red/grey), reasoning}` with inline evidence. This converts the Workbench from a chat surface into a structured analyst. The CLO's single most recurring job is "tell me X across all these contracts" — governing law, term, change-of-control, assignment, indemnity caps across 50 NDAs at once — and the Workbench cannot do it today. This is the feature that makes a CLO open the Workbench daily.

**Source/pattern + license posture.** Mike's flagship. `backend/src/routes/tabular.ts` → `queryTabularAllColumns` (line 1648) makes **one LLM call per document covering all columns**, instructs the model to emit one minified JSON line per column (`{column_index, summary, flag, reasoning}`), buffers the stream, splits on newlines, and emits a `cell_update` SSE event per completed line (verified at tabular.ts:884/922/944 with `status: generating|done|error`) so the grid fills progressively. `formatPromptSuffix` (line 35) coerces output (`yes_no`, `date → DD Month YYYY`, `tags`) to keep cells sortable/filterable. Schema: `tabular_reviews(columns_config jsonb, document_ids jsonb)` + `tabular_cells(review_id, document_id, column_index, content jsonb, status)`. **REIMPLEMENT** — learn the contract, write fresh Rust.

**Integration point.**

- _Frontend_ (`crates/ironclaw_webui_v2_static`): new **Review** surface — a grid where rows are documents pulled from connectors the Workbench already reads (a Drive folder, Gmail attachments, a GitHub repo of agreements) and columns are extraction prompts. Subscribe to the gateway's existing SSE channel; render cells progressively with the risk-color flag.
- _Backend_ (ironclaw-reborn gateway): new route `POST /review/generate` that, per document, calls a NEAR AI Cloud model emitting one JSON line per column, streamed over the existing SSE channel. Reuse the Workbench's connector fetch + text-extraction path for inputs. Persist cells in the gateway DB with the `{summary, flag, reasoning}` + `status` contract verbatim as a design. Truncate doc text to ~120k chars as Mike does.

**Effort: M.** The grid UI is the bulk of the work; the per-doc-streaming-JSON loop is small and rides existing SSE. **First slice that ships value:** one hardcoded document set (a Drive folder) + 5 built-in NDA columns (Parties, Governing Law, Term, Termination, Change of Control) + read-only grid with risk flags. No custom-column editor, no export yet. That alone answers the CLO's most common ask.

**Why now.** It is the highest value × fit and the connector + SSE plumbing already exists, so effort is M not L. Nothing else on this list matters as much to a CLO's daily work.

---

## 2. Gated tracked-changes redlining — Accept/Reject per clause

**What it is + the win.** The agent proposes edits to an uploaded `.docx` as **real Word tracked changes** (`w:ins`/`w:del`), each rendering as an Accept / Reject / View chip. Nothing commits until the human clicks. Output is a downloadable, Word-compatible redline — not a regenerated doc. For a CLO this is the killer second feature: the agent marks up an inbound contract and the CLO accepts/rejects clause-by-clause.

**Source/pattern + license posture.** `backend/src/lib/docxTrackedChanges.ts` (verified: imports `fast-diff`, builds `w:ins`/`w:del` runs, presents pre-existing changes in "accepted view" before matching so anchors stay stable — header comment lines 4-13). The `edit_document` tool (chatTools.ts:427) takes precise `{find, replace, context_before, context_after, reason}` substitutions. `resolveTrackedChange` collapses **only the one w:id** (accept keeps ins/drops del; reject inverts). The per-edit `w:id` registry + accept-only-this-change collapse is the load-bearing detail. **REIMPLEMENT** in Rust: jszip → a `zip` crate, fast-xml-parser → `quick-xml`, fast-diff → a `diff` crate.

**Integration point.**

- _Frontend_: render `EditCard`-style accept/reject chips wired to the **same optimistic-then-confirm pattern the Workbench email-reply checkpoint already uses** — this is the document version of the gated write it already does.
- _Backend_: add an `edit_document` tool to the gateway tool set; `POST /documents/:id/edits/:editId/{accept|reject}` mutates the current version in place (one w:id collapse), no version-per-click. System prompt enforces legal correctness (renumber downstream clauses, fix cross-refs in the same edit).

**Effort: M (Rust docx XML surgery is the cost).** **First slice:** support find/replace substitutions on a single uploaded `.docx`, render chips, accept/reject one change at a time, download the redline. Skip multi-version history initially.

**Why now.** It generalizes the Workbench's existing gated-write checkpoint from email to documents — same UX primitive, same approval model, new artifact type. High value, and it reuses the checkpoint pattern already shipped.

---

## 3. Document Q&A with inline verbatim citations

**What it is + the win.** Chat that reads connector-fetched documents and answers with `[1][2]` markers, each backed by an exact verbatim quote + page. Click a citation → jump and highlight the passage. The model is forbidden from fabricating document content — citations are evidence, not vibes. The Workbench already triages Gmail/Slack/Notion/Drive; this adds "ask questions across those documents and get cited answers."

**Source/pattern + license posture.** Verified `<CITATIONS>` trailing-JSON contract in `chatTools.ts:115-136`: `{"ref":1,"doc_id":"doc-0","quotes":[{"page":3,"quote":"exact verbatim text"}]}`, chat-local `doc-0` labels (never filenames/UUIDs), ≤25-word quotes, one entry per marker. Tools `read_document`/`find_in_document` (chatTools.ts:304/322). Frontend `highlightQuote.ts` does fuzzy match by stripping to lowercased alphanumerics then remapping to original offsets so punctuation differences don't break the highlight. The provider-agnostic `streamChatWithTools` abstraction (llm/index.ts:10) unifies Anthropic/Gemini/OpenAI. **REIMPLEMENT** — the contract is the asset.

**Integration point.**

- _Backend_: adopt the **trailing-`<CITATIONS>`-JSON block as the gateway's standard for any evidence-backed answer** — it's provider-agnostic and survives streaming because it's appended last (works cleanly with NEAR AI Cloud). Add `read_document`/`find_in_document` tools against connector-fetched docs. Reuse the existing bounded agent loop (Mike caps at ≤10 tool rounds + replays prior read/edit events so the model knows what it did — good guardrail to mirror).
- _Frontend_: the `onlyLetters` fuzzy-match-then-remap highlight technique is directly reusable for "click to source" in any Workbench doc viewer.

**Effort: S–M.** Mostly a system-prompt contract + two tools + a parser; rides the existing agent loop. **First slice:** single-document Q&A with clickable citations in a side viewer.

**Why now.** Cheapest of the three document features and it raises trust on everything else — the CLO won't accept tabular flags or redlines from a system that can't show its sources. Ships fast; de-risks 1 and 2.

---

## 4. Workflows — saved, shareable review/prompt templates

**What it is + the win.** Saved templates capturing a tabular column-set or an assistant prompt, scoped to a practice area, shareable with the team. A CLO codifies "my standard NDA review grid" once and re-runs it on any new doc set. Turns one-off requests into repeatable, team-shareable agent playbooks — exactly what a chief-of-staff agent should accumulate.

**Source/pattern + license posture.** `workflows(type, prompt_md, columns_config jsonb, practice, is_system)`; `builtinWorkflows.ts` ships defaults; `get_workflows_overview` Postgres RPC UNIONs owned + shared-by-email and computes `allow_edit`/`is_owner`/sort in SQL so the frontend gets one flat ordered list. Tool convention: when the user selects `[Workflow: <title> (id)]`, the agent reads it first and obeys it. **REIMPLEMENT** the pattern (the SQL RPC is the elegant part — keep the frontend dumb).

**Integration point.** _Backend:_ store Workbench playbooks (a saved triage rule, a review grid, a reply-drafting prompt) as workflow rows; one query returns ownership/sharing/sort resolved. _Frontend:_ a workflow picker; "select workflow → agent reads it first" lets a CLO steer without prompt-engineering.

**Effort: S** (but only meaningful **after** #1 exists — a workflow is an instantiation of a review). **First slice:** save a Review's column config as a named template, re-apply to a new doc set.

**Why now.** Low effort, but it's a multiplier on #1, not standalone value. Build right after Tabular Review lands so the CLO's second review costs one click.

---

## Sequencing

Ship **#3 (citations) first or in parallel with #1** — it's small, de-risks trust, and #1's cells reuse the same evidence contract (Mike's tabular cells already use a parallel inline `[[page:N||quote:...]]` form). Then **#1 (Tabular Review)** as the flagship. Then **#2 (redlining)** reusing the existing checkpoint UX. Then **#4 (Workflows)** to make #1 repeatable. The MCP-connector-with-confirmation-gating pattern (item 5 in the research, truncated) maps onto the Workbench's existing Composio + gated-write model and is the lowest priority — the Workbench already has connectors; Mike's only net-add there is per-tool `requires_confirmation` derived from MCP annotations + SSRF guards on user-supplied server URLs, worth lifting as hardening when custom connectors are exposed to CLOs.

**Net:** four document-layer features, all REIMPLEMENT (AGPL), all bolting onto plumbing the Workbench already has. The CLO's core daily work — review many contracts for specific terms, mark up an inbound draft, ask cited questions across a corpus — moves from "can't do" to "core surface."

---

## Server-side follow-ups (post-overnight)

The overnight build shipped the client surfaces for #1 (Tabular Review) and #2 (Redline) on the static frontend branch (`workbench-overnight-20260620`). Two pieces genuinely need the **gateway** and were deliberately left out of the browser — both are honest, scoped, and stay behind the existing human send/export checkpoint. See `docs/design/workbench-evening-build-STATUS.md` for the slice-by-slice record (Tabular Review v1+v2; Redline D1–D4).

1. **Word-native tracked-changes `.docx` export for the Redline.** The client ships a portable, XSS-escaped **HTML** redline artifact + "Copy resolved text" (the decided final document). A true Word redline is OOXML `w:ins`/`w:del` inside a zipped `.docx`; a browser OOXML writer + zip would blow the `< 401KB` cold-bundle budget. **Gateway path:** accept `{ clauses }` (the same `redlineClauses` shape the client already produces) or `{ original, revised }`, build the `w:ins`/`w:del` document server-side, return the `.docx`. The export is an outbound artifact, so it stays behind the per-action approval gate — never auto-sent. Reuses the reviewed, reconstruction-locked diff core (`lib/workbench-redline.js`); the server only renders OOXML from segments it is handed.

2. **Non-Google-Doc text extraction for Tabular Review.** The client reads native Google Docs (`GOOGLEDOCS_GET_DOCUMENT_BY_ID`); the picker honestly marks PDFs/`.docx`/sheets as not-yet-reviewable rather than producing a wall of "couldn't read". Two reasons the browser can't do more: the read-only connector allowlist (`FETCH`/`LIST`/`GET`/`SEARCH`/`FIND`/`READ`) blocks Drive download/export tools, and a PDF/`.docx` parser is far too heavy for the bundle. **Gateway path:** a read-only tool (e.g. `*_GET_TEXT`) that downloads the Drive blob, extracts plain text server-side (PDF text layer / docx XML), and returns it — the extractor then runs unchanged, still token-gated and never-fabricate. Until then the picker's honest gating is the correct behavior.

Both are additive: the client contracts (the `redlineClauses` segment shape; the `extractDoc` text input) already match what the gateway would feed/consume, so neither needs a client rewrite.
