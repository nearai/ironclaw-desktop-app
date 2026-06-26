// Deterministic "Recent Drive files".
//
// Like the inbox/calendar surfaces, this is a read-only connector read: a single
// GOOGLEDRIVE_LIST_FILES call returns the user's most recently modified files,
// and we render the real rows with a deep link to each file. No agent, no model
// round-trip. Honest framing: these are the files Drive actually returned —
// surfaced for the user to open — never a fabricated listing.

import { formatInboxWhen } from './workbench-connectors.js';

export const DRIVE_FILE_LIMIT = 6;

// Google Drive mimeType -> a short, friendly kind label. Anything we do not
// recognise degrades to the generic 'File' rather than leaking the raw mime.
const DRIVE_KIND_BY_MIME = Object.freeze({
  'application/vnd.google-apps.document': 'Doc',
  'application/vnd.google-apps.spreadsheet': 'Sheet',
  'application/vnd.google-apps.presentation': 'Slides',
  'application/vnd.google-apps.folder': 'Folder',
  'application/vnd.google-apps.form': 'Form',
  'application/pdf': 'PDF'
});

// Map a Drive mimeType to its friendly label; unknown/missing mimes -> 'File'.
export function driveKind(mimeType) {
  const mime = String(mimeType || '').trim();
  return DRIVE_KIND_BY_MIME[mime] || 'File';
}

// Resolve a usable web link for a Drive file: prefer the provided webViewLink
// when it is a real http(s) url, else synthesize the canonical open-by-id link
// when an id is present. Returns '' when there is nothing to link to (so the UI
// omits a dead link rather than fabricating one).
function driveLink(webViewLink, id) {
  const link = String(webViewLink || '').trim();
  if (/^https?:\/\//i.test(link)) return link;
  const fileId = String(id || '').trim();
  return fileId ? `https://drive.google.com/open?id=${fileId}` : '';
}

// Normalize a GOOGLEDRIVE_LIST_FILES read into recent-file rows:
// `{ id, name, kind, when, link }`. Honest contract: [] on any
// unsuccessful/empty/malformed payload; never fabricates a file; drops rows
// that have neither id nor name.
export function normalizeDriveFiles(result, { limit = 6 } = {}) {
  if (!result || result.successful === false) return [];
  const data = result.data || result;
  const files = data?.files;
  if (!Array.isArray(files)) return [];
  const rows = [];
  for (const file of files) {
    if (!file || typeof file !== 'object') continue;
    const id = String(file.id || '').trim();
    const rawName = String(file.name || '').trim();
    if (!id && !rawName) continue;
    rows.push({
      id,
      name: rawName || '(untitled)',
      kind: driveKind(file.mimeType),
      // Raw mime so the rail can route a Google Doc into the in-app viewer
      // (GOOGLEDOCS_GET_DOCUMENT_BY_ID) while other types open externally.
      mimeType: String(file.mimeType || '').trim(),
      when: formatInboxWhen(file.modifiedTime),
      link: driveLink(file.webViewLink, id)
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

// The Drive mimeType for a native Google Doc — the only Drive type with a
// read-only body tool wired here (Sheets toolkit is not connected; binaries
// can't render as text), so only Docs open in the in-app viewer.
export const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

const sdoc = (v) => (v == null ? '' : String(v));

// Normalize a GOOGLEDOCS_GET_DOCUMENT_BY_ID read into renderable blocks for the
// in-app viewer (same block model as Notion). The Google Docs API returns
// `response_data.body.content[]`; each paragraph carries `elements[].textRun.content`
// and a `paragraphStyle.namedStyleType` (TITLE / HEADING_n / NORMAL_TEXT). We
// flatten runs to plain text — no raw HTML, so no XSS surface. Honest contract:
// `{ ok:false, error }` on a failed read; never fabricates text.
export function normalizeGoogleDocContent(result) {
  if (!result || result.successful === false) {
    return {
      ok: false,
      error: sdoc(result && result.error) || 'Could not load this document.',
      blocks: []
    };
  }
  const data = result.data || result;
  const rd = (data && data.response_data) || data || {};
  const content = (rd.body && rd.body.content) || [];
  if (!Array.isArray(content)) return { ok: true, error: '', blocks: [] };
  const blocks = [];
  for (const el of content) {
    const para = el && el.paragraph;
    if (!para) continue;
    const text = (Array.isArray(para.elements) ? para.elements : [])
      .map((e) => sdoc(e && e.textRun && e.textRun.content))
      .join('')
      .replace(/\f/g, '')
      .trim();
    if (!text) continue;
    if (para.bullet) {
      blocks.push({ kind: 'bullet', text });
      continue;
    }
    const style = sdoc(para.paragraphStyle && para.paragraphStyle.namedStyleType);
    const headingMatch = /^HEADING_(\d)$/.exec(style);
    if (style === 'TITLE') blocks.push({ kind: 'heading', level: 1, text });
    else if (headingMatch)
      blocks.push({ kind: 'heading', level: Math.min(3, Number(headingMatch[1])), text });
    else if (style === 'SUBTITLE') blocks.push({ kind: 'heading', level: 3, text });
    else blocks.push({ kind: 'para', text });
  }
  return { ok: true, error: '', blocks };
}
