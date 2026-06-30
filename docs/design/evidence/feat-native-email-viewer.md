# Feature D1 — native email viewer (emails no longer render weirdly) (2026-06-22 09:08 EDT)

User feedback: "emails render weirdly can we have native email and doc viewer etc?"

Root cause: `normalizeFullMessage` ran `cleanEmailBody` which strips ALL HTML to plain text,
but the live GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID response carries a full `text/html` part in
`payload.parts[]` (base64) that was ignored — so rich HTML mail (tables, quoted threads,
links, images) collapsed into mangled text.

Fix (native + XSS-safe):
- `workbench-connectors.js`: `decodeBase64Part` (base64url → UTF-8) + `extractHtmlBody`
  (recurses payload parts for text/html); `normalizeFullMessage` now returns `htmlBody`
  alongside the plain-text `body` (kept as fallback).
- `workbench-reading-panel.js`: `sanitizeEmailHtml` runs `window.DOMPurify.sanitize`
  (WHOLE_DOCUMENT; FORBID script/iframe/object/embed/form/input/button; FORBID srcdoc) and the
  result renders in a **sandboxed <iframe srcdoc sandbox="allow-popups allow-popups-to-escape-sandbox">**
  — NO allow-scripts, NO allow-same-origin. Defense in depth: sanitized AND script-isolated AND
  CSS-isolated from the app. Plain-text-only mail falls back to the existing paragraph render.
- `styles/overlays.js`: `.wb13-reader-frame` (white sheet, since email HTML is authored for
  light bg; fills the reader, scrolls internally).

Live-proven (standalone :17641): opened "Re: Re-Intro - Abhi and Sidney" → renders the native
HTML in the sandboxed iframe (10.7KB sanitized; sandbox has no allow-scripts) — faithful
paragraphs, indented quoted-reply thread, a real clickable calendar link. Panel chrome stays
v13 (dark, Newsreader serif subject, blue Draft reply). Plain-text mocks still use the text
fallback (existing reading-panel tests stay green).

Gate green: test:static 839 (3 new extraction tests), a11y 138, design DT-1..6, smoke, bundle
under budget.

Follow-up (queued): in-app Notion page + Drive doc viewers. Notion content tool (NOTION_FETCH_DATA)
inferred; Drive export tool/params need a live confirmation (probe returned 503 / unconfirmed) —
will verify the exact tool before building, to avoid shipping on an unconfirmed API.
