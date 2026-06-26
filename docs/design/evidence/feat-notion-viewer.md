# Feature — native in-app Notion page viewer (2026-06-22 09:42 EDT)

User: "can we have native email and doc viewer etc?" Email shipped earlier; this adds the
Notion half (Drive remains gateway-blocked).

- `workbench-state.js` `connectorNotionRows`: dropped the external `href`; now carries `pageId`
  (for the read) + `pageUrl` (for "Open in Notion"). So a Notion rail row opens the in-app panel.
- `workbench-shell.js` DockRow: `notion` rows route through `onOpenMessage` (button), like inbox
  rows — additive branch, email/external paths untouched.
- `workbench-reading-panel.js`: kind-switch. For `selected.kind === 'notion'` it calls
  `useConnectorNotionPage(pageId)` (NOTION_FETCH_BLOCK_CONTENTS) and renders `NotionBlocks`
  (headings/paragraphs/bullets/numbers/todos/quote/code/divider — plain text only, no raw HTML,
  no XSS surface) with an "Open in Notion" fallback. The email path is byte-identical (both hooks
  are called unconditionally; the idle one gets '').
- `styles/overlays.js`: `.wb13-notion-*` block styles on the dark v13 reader (wb-* tokens).

Live-proven (standalone :17641 /workbench): clicked the Notion rail row "Use guaranteed
quote_status delivery in CEX-solver" → the panel opened (aria "Notion page") and rendered the real
page content (Description heading, body, a bulleted "What changed" list) with "Open in Notion".
Screenshot confirms v13 fidelity (Newsreader serif title, blue accent, dark dock).

Gate green: test:static 841 (notion-rows test updated to pageId/pageUrl), a11y 140, design DT-1..6,
smoke, bundle under budget.

Drive doc-body viewer still BLOCKED at the gateway (no read-only body tool — needs a reviewed
gateway PR). Drive rows stay external-link.
