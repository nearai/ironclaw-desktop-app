// Dependency-free .docx (OOXML) generator for Workbench work product.
//
// Produces a REAL, editable Word document the user can open, edit, and add
// sources to — with NO third-party library (no JSZip), so nothing is added to
// the bundle budget. A .docx is an OPC package: a ZIP of XML parts. We build the
// minimal valid part set and a STORED (uncompressed) ZIP by hand; Word, Google
// Docs, and python-docx all open STORED OPC packages.
//
// Formatting follows the user's document conventions ([[feedback_legal_doc_formatting]]):
// Arial throughout, bold headings, a clear title, and an explicit Sources section
// so citations are first-class and editable.

const enc = new TextEncoder();

function xmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// One <w:p> paragraph. Arial via direct run fonts so we need no styles part.
// opts: { bold, size (half-points), heading } — heading adds spacing before.
function paragraph(text, opts = {}) {
  const size = opts.size || 22; // 11pt default (half-points)
  const runProps =
    `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>` +
    `${opts.bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`;
  const spacing = opts.heading
    ? '<w:spacing w:before="240" w:after="80"/>'
    : '<w:spacing w:after="120"/>';
  const pProps = `<w:pPr>${spacing}</w:pPr>`;
  const run =
    text === '' ? '' : `<w:r>${runProps}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
  return `<w:p>${pProps}${run}</w:p>`;
}

// Build the word/document.xml body from a structured doc:
//   { title, subtitle?, sections:[{ heading?, paragraphs:[string] }], sources?:[string] }
export function buildDocumentXml(doc = {}) {
  const parts = [];
  if (doc.title) parts.push(paragraph(doc.title, { bold: true, size: 36, heading: true })); // 18pt
  if (doc.subtitle) parts.push(paragraph(doc.subtitle, { size: 24 })); // 12pt
  for (const section of Array.isArray(doc.sections) ? doc.sections : []) {
    if (!section || typeof section !== 'object') continue;
    if (section.heading)
      parts.push(paragraph(section.heading, { bold: true, size: 28, heading: true })); // 14pt
    for (const para of Array.isArray(section.paragraphs) ? section.paragraphs : []) {
      parts.push(paragraph(para));
    }
  }
  const sources = Array.isArray(doc.sources) ? doc.sources.filter(Boolean) : [];
  if (sources.length) {
    parts.push(paragraph('Sources', { bold: true, size: 28, heading: true }));
    sources.forEach((src, i) => parts.push(paragraph(`${i + 1}. ${src}`)));
  }
  if (!parts.length) parts.push(paragraph(''));
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${parts.join('')}` +
    `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>` +
    `</w:body></w:document>`
  );
}

const CONTENT_TYPES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `</Types>`;

const ROOT_RELS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `</Relationships>`;

const DOC_RELS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

/* ── minimal STORED zip (no compression, no dependency) ───────────────── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n) {
  return [n & 0xff, (n >>> 8) & 0xff];
}
function u32(n) {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

// files: [{ name, data:Uint8Array }] → Uint8Array of a STORED zip.
export function storedZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;
    const local = [
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      ...u16(0)
    ];
    chunks.push(Uint8Array.from(local), nameBytes, file.data);
    central.push([
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...Array.from(nameBytes)
    ]);
    offset += local.length + nameBytes.length + size;
  }
  const centralBytes = central.flat();
  const centralStart = offset;
  const eocd = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(files.length),
    ...u16(files.length),
    ...u32(centralBytes.length),
    ...u32(centralStart),
    ...u16(0)
  ];
  const total = offset + centralBytes.length + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  out.set(Uint8Array.from(centralBytes), pos);
  pos += centralBytes.length;
  out.set(Uint8Array.from(eocd), pos);
  return out;
}

// Build the full .docx package as a Uint8Array.
export function buildDocxBytes(doc = {}) {
  const files = [
    { name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES_XML) },
    { name: '_rels/.rels', data: enc.encode(ROOT_RELS_XML) },
    { name: 'word/document.xml', data: enc.encode(buildDocumentXml(doc)) },
    { name: 'word/_rels/document.xml.rels', data: enc.encode(DOC_RELS_XML) }
  ];
  return storedZip(files);
}

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Browser-only convenience: a Blob ready for download (see lib/save-file.js).
export function buildDocxBlob(doc = {}) {
  return new Blob([buildDocxBytes(doc)], { type: DOCX_MIME });
}

// Map a deterministic Workbench briefing (buildBriefing output) into the doc
// model — so "what needs me today?" can be saved as a real editable work product.
// Pure + defensive: any missing section degrades to nothing, never throws.
export function briefingToWorkProduct(briefing = {}) {
  const b = briefing || {};
  const titles = (rows, format) =>
    (Array.isArray(rows) ? rows : []).map(format).filter((line) => line && line.trim());
  const sections = [];
  const reply = titles(b.replies, (m) =>
    m && m.subject ? `${m.subject}${m.sender ? ` — ${m.sender}` : ''}` : ''
  );
  if (reply.length) sections.push({ heading: 'Replies waiting', paragraphs: reply });
  const events = titles(b.events, (e) =>
    e && e.title ? `${e.title}${e.when ? ` — ${e.when}` : ''}` : ''
  );
  if (events.length) sections.push({ heading: 'On your calendar', paragraphs: events });
  const decide = titles(b.attention, (r) => (r ? r.title : ''));
  if (decide.length) sections.push({ heading: 'Needs a decision', paragraphs: decide });
  const slack = titles(b.slack, (r) => (r ? r.title : ''));
  if (slack.length) sections.push({ heading: 'Slack', paragraphs: slack });
  const github = titles(b.github, (r) => (r ? r.title : ''));
  if (github.length) sections.push({ heading: 'GitHub', paragraphs: github });

  const sources = (Array.isArray(b.sources) ? b.sources : []).map(
    (s) => `${s.label}${typeof s.count === 'number' ? ` (${s.count})` : ''}`
  );
  const filed = b.counts && b.counts.filed;
  if (filed) sources.push(`${filed} newsletter${filed === 1 ? '' : 's'} filed — not surfaced`);

  return {
    title: 'IronClaw Daily Brief',
    subtitle: b.headline || '',
    sections: sections.length
      ? sections
      : [{ heading: 'Summary', paragraphs: [b.headline || 'Nothing needs you right now.'] }],
    sources
  };
}

// Strip inline markdown to the plain text the .docx run model renders:
// **bold**, *italic*, `code`, and [label](url) → label.
function stripInline(text) {
  return String(text == null ? '' : text)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s*/, '')
    .trim();
}

// Parse drafted markdown (agent output, or a paste) into the work-product doc
// model — so ANY memo/brief becomes a real editable .docx. Pure + defensive:
//   # Title          → title
//   ## / ### Heading  → section heading (a "Sources"/"References" heading routes
//                       its list items into the editable Sources section)
//   - / * / 1. item   → paragraph (bullet kept as text)
//   blank line        → paragraph break
export function markdownToWorkProduct(markdown, { title } = {}) {
  const lines = String(markdown == null ? '' : markdown)
    .replace(/\r\n?/g, '\n')
    .split('\n');
  let docTitle = title || '';
  const sections = [];
  const sources = [];
  let current = null; // { heading, paragraphs }
  let inSources = false;
  let buffer = '';

  const flush = () => {
    const text = buffer.trim();
    buffer = '';
    if (!text) return;
    if (inSources) {
      sources.push(text);
    } else {
      if (!current) current = { heading: '', paragraphs: [] };
      current.paragraphs.push(text);
    }
  };
  const closeSection = () => {
    flush();
    if (current && (current.heading || current.paragraphs.length)) sections.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const h1 = line.match(/^#\s+(.*)$/);
    const h = line.match(/^#{2,6}\s+(.*)$/);
    if (h1 && !docTitle) {
      flush();
      docTitle = stripInline(h1[1]);
      continue;
    }
    if (h1 || h) {
      closeSection();
      const headingText = stripInline((h1 || h)[1]);
      inSources = /^(sources?|references?|citations?)\b/i.test(headingText);
      if (!inSources) current = { heading: headingText, paragraphs: [] };
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const li = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      flush();
      buffer = stripInline(li[1]);
      flush();
      continue;
    }
    buffer = buffer ? `${buffer} ${stripInline(line)}` : stripInline(line);
  }
  closeSection();

  return {
    title: docTitle || 'Untitled work product',
    sections: sections.length ? sections : [{ heading: '', paragraphs: ['(empty document)'] }],
    sources
  };
}
