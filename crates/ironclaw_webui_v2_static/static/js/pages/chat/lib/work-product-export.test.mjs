import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = {
  marked: {
    parse: (content) =>
      [
        '<h1>Services Agreement Smoke Draft</h1>',
        '<p>This is a static export validation artifact.</p>',
        '<table><thead><tr><th>Item</th><th>Value</th></tr></thead>',
        '<tbody><tr><td>Scope</td><td>Dummy services agreement update</td></tr></tbody></table>',
        `<pre><code>${escapeHtml(content.match(/```[a-z]*\n([\s\S]*?)```/)?.[1] || '')}</code></pre>`
      ].join('')
  },
  DOMPurify: {
    sanitize: (html) => html
  }
};

const { DOCX_MIME, buildDocxBlob, buildHtmlBlob, buildJsonBlob, buildMarkdownBlob, buildPdfBlob } =
  await import('./work-product-export.js');

const WORK_PRODUCT_MARKDOWN = [
  '# Services Agreement Smoke Draft',
  '',
  'This is a static export validation artifact with **bold**, `inline_code`, and a table.',
  '',
  '| Item | Value |',
  '| --- | --- |',
  '| Scope | Dummy services agreement update |',
  '| Attachment | services-template.pdf |',
  '',
  '```json',
  '{"status":"ready","format":"json"}',
  '```'
].join('\n');

test('static export builders create parseable MD, HTML, JSON, PDF, and DOCX artifacts', async () => {
  const markdown = await buildMarkdownBlob(WORK_PRODUCT_MARKDOWN).text();
  assert.equal(markdown, WORK_PRODUCT_MARKDOWN);
  assert.match(markdown, /Services Agreement Smoke Draft/);

  const html = await buildHtmlBlob(WORK_PRODUCT_MARKDOWN).text();
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<table>/);
  assert.match(html, /Dummy services agreement update/);
  assert.doesNotMatch(html, /\| --- \| --- \|/);

  const json = JSON.parse(
    await buildJsonBlob({
      role: 'assistant',
      content: WORK_PRODUCT_MARKDOWN,
      attachments: [{ filename: 'services-template.pdf', mime_type: 'application/pdf' }]
    }).text()
  );
  assert.equal(json.role, 'assistant');
  assert.equal(json.content, WORK_PRODUCT_MARKDOWN);
  assert.deepEqual(json.attachments, [
    { filename: 'services-template.pdf', mime_type: 'application/pdf' }
  ]);
  assert.match(json.exported_at, /^\d{4}-\d{2}-\d{2}T/);

  const pdf = await buildPdfBlob(WORK_PRODUCT_MARKDOWN).text();
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /SERVICES AGREEMENT SMOKE DRAFT/);
  assert.match(pdf, /Dummy services agreement update/);
  assert.match(pdf, /xref\n0 6/);
  assert.match(pdf, /trailer/);
  assert.match(pdf, /%%EOF/);

  const docx = buildDocxBlob(WORK_PRODUCT_MARKDOWN);
  assert.equal(docx.type, DOCX_MIME);
  const entries = unzipStoredEntries(new Uint8Array(await docx.arrayBuffer()));
  assert.deepEqual([...entries.keys()].sort(), [
    '[Content_Types].xml',
    '_rels/.rels',
    'word/_rels/document.xml.rels',
    'word/document.xml'
  ]);
  assert.match(entries.get('[Content_Types].xml'), /wordprocessingml\.document\.main\+xml/);
  assert.match(entries.get('word/document.xml'), /<w:tbl>/);
  assert.match(entries.get('word/document.xml'), /Services Agreement Smoke Draft/);
  assert.match(entries.get('word/document.xml'), /Dummy services agreement update/);
});

function unzipStoredEntries(bytes) {
  const entries = new Map();
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset + 30 <= bytes.length && readU32(bytes, offset) === 0x04034b50) {
    const compressedSize = readU32(bytes, offset + 18);
    const fileNameLength = readU16(bytes, offset + 26);
    const extraLength = readU16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + fileNameLength));
    const data = decoder.decode(bytes.slice(dataStart, dataStart + compressedSize));
    entries.set(name, data);
    offset = dataStart + compressedSize;
  }
  return entries;
}

function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes, offset) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Regression: the PDF must be assembled in BYTES. A prior version measured
// /Length, xref offsets and startxref with JS string .length (UTF-16 code
// units) while Blob serialized UTF-8, so any non-ASCII content shifted every
// offset and strict readers rejected the file. Build with non-ASCII text and
// assert byte-accurate structure.
test('PDF export computes byte-accurate xref/startxref/Length for non-ASCII content', async () => {
  const content = [
    '# Café Résumé — Москва', // accents, em-dash, Cyrillic
    'Curly "quotes", an emoji 😀, and an ellipsis…'
  ].join('\n');
  const bytes = new Uint8Array(await buildPdfBlob(content).arrayBuffer());
  // latin1 decode keeps char index === byte index, so substring offsets are byte offsets.
  const latin1 = new TextDecoder('latin1').decode(bytes);

  const trailer = latin1.match(/startxref\n(\d+)\n%%EOF/);
  assert.ok(trailer, 'has startxref/%%EOF trailer');
  const startxref = Number(trailer[1]);
  assert.equal(
    latin1.slice(startxref, startxref + 4),
    'xref',
    'startxref byte offset lands exactly on the xref keyword'
  );

  // Every in-use xref entry offset must land on its "<n> 0 obj" header.
  const entryRe = /^(\d{10}) 00000 n /gm;
  let entry;
  let index = 0;
  while ((entry = entryRe.exec(latin1.slice(startxref)))) {
    index += 1;
    const off = Number(entry[1]);
    const header = `${index} 0 obj`;
    assert.equal(
      latin1.slice(off, off + header.length),
      header,
      `xref entry ${index} points at its object header`
    );
  }
  assert.ok(index >= 5, 'all five objects have xref entries');

  // /Length must equal the real content-stream byte length.
  const lengthMatch = latin1.match(/<< \/Length (\d+) >>\nstream\n/);
  assert.ok(lengthMatch, 'content stream declares /Length');
  const declaredLength = Number(lengthMatch[1]);
  const streamStart = latin1.indexOf('stream\n', latin1.indexOf('/Length')) + 'stream\n'.length;
  const streamEnd = latin1.indexOf('\nendstream', streamStart);
  assert.equal(
    streamEnd - streamStart,
    declaredLength,
    '/Length equals the actual content-stream byte length'
  );
});
