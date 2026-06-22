# Feature — native in-app Google Doc viewer (Drive) (2026-06-22 09:58 EDT)

Finishes the doc-viewer ask. The earlier "Drive blocked at the gateway" was a WRONG TOOL NAME:
`GOOGLEDOCS_GET_DOCUMENT_BY_ID{id}` is a read-only GET that passes the read-route guard and
returns the full document — NO gateway change needed.

- `workbench-drive.js`: `normalizeGoogleDocContent` (response_data.body.content[] paragraphs →
  same block model as Notion: TITLE/HEADING_n → heading, NORMAL_TEXT → para, bullet → list;
  plain text only, no XSS) + `GOOGLE_DOC_MIME`; `normalizeDriveFiles` now carries raw `mimeType`.
- `useConnectorDriveDoc(fileId)` hook → GOOGLEDOCS_GET_DOCUMENT_BY_ID.
- `connectorDriveRows`: a Google Doc → `kind:'drivedoc'` + docId/docUrl, opens in-app; other
  Drive types (Sheets — toolkit not connected; PDFs/binaries) keep the external href.
- `DockRow`: `drivedoc` routes via onOpenMessage (in-panel); `WorkbenchReadingPanel`
  generalized so the doc branch serves BOTH Notion + Drive Docs (shared NotionBlocks renderer,
  "Open in Notion"/"Open in Drive"). Email path byte-identical.

Live-proven (standalone :17641): fetched "IronClaw - Use Cases to test" through the app's own
connector call → 200, ok, 59 paragraphs of text (first line "Staging Hosted IronClaw Setup:").
normalizeGoogleDocContent (unit-tested on the real shape) + the panel's doc branch (identical to
the live-proven Notion render) display it. The drivedoc rail row is in the overflow today (the
one Doc is 5th of 6 recent files; rail shows 4) — data ordering, not code.

Gate green: test:static 846 (5 new drive tests), a11y 140, design DT-1..6, smoke, bundle.

## Doc-viewer ask: COMPLETE
- ✅ Native email rendering (sandboxed iframe + DOMPurify)
- ✅ Native Notion page reading in-app
- ✅ Native Google Doc reading in-app
Drive Sheets/PDFs remain external (no read-only body tool wired: googlesheets toolkit not
connected; binaries can't render as text) — a future gateway/Composio task if wanted.
