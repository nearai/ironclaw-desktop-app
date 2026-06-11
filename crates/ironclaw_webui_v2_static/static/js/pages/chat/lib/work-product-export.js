import { renderMarkdown } from '../../../lib/markdown.js';
import { saveBlob } from '../../../lib/save-file.js';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function copyWorkProduct(content) {
  const text = String(content || '');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function downloadMarkdown(content, filename = 'assistant-response.md') {
  return downloadBlob(filename, buildMarkdownBlob(content));
}

export function downloadHtml(content, filename = 'assistant-response.html') {
  return downloadBlob(filename, buildHtmlBlob(content));
}

export function downloadJson(message, filename = 'assistant-response.json') {
  return downloadBlob(filename, buildJsonBlob(message));
}

export function downloadDocx(content, filename = 'assistant-response.docx') {
  return downloadBlob(filename, buildDocxBlob(content));
}

export function downloadPdf(content, filename = 'assistant-response.pdf') {
  return downloadBlob(filename, buildPdfBlob(content));
}

export function buildMarkdownBlob(content) {
  return new Blob([String(content || '')], { type: 'text/markdown;charset=utf-8' });
}

export function buildHtmlBlob(content) {
  const body = renderMarkdown(String(content || ''));
  return new Blob(
    [
      `<!doctype html><html><head><meta charset="utf-8"><title>IronClaw export</title></head><body>${body}</body></html>`
    ],
    { type: 'text/html;charset=utf-8' }
  );
}

export function buildJsonBlob(message) {
  return new Blob(
    [
      JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          role: message?.role || 'assistant',
          content: message?.content || '',
          attachments: message?.attachments || []
        },
        null,
        2
      )
    ],
    { type: 'application/json;charset=utf-8' }
  );
}

export function buildDocxBlob(content) {
  const docXml = documentXmlFromMarkdown(String(content || ''));
  const relsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const bytes = zipStore([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'word/_rels/document.xml.rels', data: relsXml },
    { name: 'word/document.xml', data: docXml }
  ]);
  return new Blob([bytes], { type: DOCX_MIME });
}

export function buildPdfBlob(content) {
  const lines = linesForPdf(String(content || ''));
  const streamText = [
    'BT',
    '/F1 14 Tf',
    '72 760 Td',
    ...lines.map((line, index) =>
      index === 0 ? `(${escapePdfText(line)}) Tj` : `0 -20 Td (${escapePdfText(line)}) Tj`
    ),
    'ET'
  ].join('\n');
  // The content stream is emitted as WinAnsi single-byte so the base-14
  // Helvetica renders it AND one character is exactly one byte. The PDF
  // structure (xref offsets, startxref, /Length) is measured in BYTES, never
  // in JS string .length — a UTF-16 code-unit count would diverge from the
  // UTF-8 bytes a Blob writes and corrupt every offset for non-ASCII text.
  const streamBytes = encodeWinAnsi(streamText);
  const objects = [
    encodeWinAnsi('<< /Type /Catalog /Pages 2 0 R >>'),
    encodeWinAnsi('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    encodeWinAnsi(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>'
    ),
    encodeWinAnsi(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
    ),
    concatBytes([
      encodeWinAnsi(`<< /Length ${streamBytes.length} >>\nstream\n`),
      streamBytes,
      encodeWinAnsi('\nendstream')
    ])
  ];
  const chunks = [];
  let length = 0;
  const push = (bytes) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  push(encodeWinAnsi('%PDF-1.4\n'));
  const offsets = [];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(length);
    push(encodeWinAnsi(`${index + 1} 0 obj\n`));
    push(objects[index]);
    push(encodeWinAnsi('\nendobj\n'));
  }
  const xref = length;
  push(encodeWinAnsi(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`));
  for (const offset of offsets) {
    push(encodeWinAnsi(`${String(offset).padStart(10, '0')} 00000 n \n`));
  }
  push(
    encodeWinAnsi(
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    )
  );
  return new Blob([concatBytes(chunks)], { type: 'application/pdf' });
}

// cp1252 high range (0x80-0x9F) for the typographic codepoints routine in LLM
// output — em/en dash, curly quotes, ellipsis, bullet — so they survive into
// the PDF instead of degrading. Latin-1 (0xA0-0xFF) maps to itself.
const WINANSI_HIGH = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f
};

function encodeWinAnsi(text) {
  const str = String(text || '');
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f || (code >= 0xa0 && code <= 0xff)) {
      out[i] = code;
    } else if (WINANSI_HIGH[code] !== undefined) {
      out[i] = WINANSI_HIGH[code];
    } else {
      out[i] = 0x3f; // unmappable (CJK, emoji) -> '?'
    }
  }
  return out;
}

function downloadBlob(filename, blob) {
  // Desktop: native save dialog via Rust (blob-anchor downloads are a silent
  // no-op in WKWebView). Hosted: classic anchor. Returns saved path | null.
  return saveBlob(blob, filename);
}

function documentXmlFromMarkdown(content) {
  const body = markdownBlocks(content).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`;
}

function markdownBlocks(content) {
  const lines = String(content || '').split(/\r?\n/);
  const blocks = [];
  let inCode = false;
  let tableRows = [];
  let tableSourceRows = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    blocks.push(tableXml(tableRows));
    for (const sourceRow of tableSourceRows) {
      blocks.push(paragraphXml(sourceRow, { hidden: true }));
    }
    tableRows = [];
    tableSourceRows = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      flushTable();
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      blocks.push(paragraphXml(line, { code: true }));
      continue;
    }
    if (isMarkdownTableRow(line)) {
      if (!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)) {
        tableSourceRows.push(line.trim());
        tableRows.push(
          line
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split(/(?<!\\)\|/)
            .map((cell) => cell.replace(/\\\|/g, '|').trim())
        );
      }
      continue;
    }
    flushTable();
    const text = line.replace(/^#{1,6}\s+/, '').replace(/^[-*]\s+/, '- ');
    blocks.push(paragraphXml(text || ' '));
  }
  flushTable();
  return blocks;
}

function paragraphXml(text, { code = false, hidden = false } = {}) {
  const runProps = [
    code ? '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>' : '',
    hidden ? '<w:vanish/>' : ''
  ]
    .filter(Boolean)
    .join('');
  const props = runProps ? `<w:rPr>${runProps}</w:rPr>` : '';
  return `<w:p><w:r>${props}<w:t xml:space="preserve">${escapeXml(stripMarkdown(text))}</w:t></w:r></w:p>`;
}

function tableXml(rows) {
  return `<w:tbl>${rows
    .map(
      (row) => `<w:tr>${row.map((cell) => `<w:tc>${paragraphXml(cell)}</w:tc>`).join('')}</w:tr>`
    )
    .join('')}</w:tbl>`;
}

function isMarkdownTableRow(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function linesForPdf(content) {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map((line) => stripMarkdown(line).trim())
    .filter(Boolean)
    .slice(0, 32);
  return lines.length ? lines : ['IronClaw export'];
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/^#{1,6}\s+(.+)$/gm, (_, heading) => heading.toUpperCase())
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function escapeXml(value) {
  return (
    String(value || '')
      // XML 1.0 forbids C0 control chars except tab/newline/carriage-return;
      // a stray control byte in content otherwise yields an unopenable .docx.
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  );
}

function escapePdfText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const crc = crc32(data);
    const local = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data
    ]);
    localParts.push(local);
    centralParts.push(
      concatBytes([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name
      ])
    );
    offset += local.length;
  }

  const central = concatBytes(centralParts);
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0)
  ]);
  return concatBytes([...localParts, central, end]);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u16(value) {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value, true);
  return out;
}

function u32(value) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
