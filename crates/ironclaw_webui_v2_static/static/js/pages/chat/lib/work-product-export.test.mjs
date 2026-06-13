import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = {
  marked: {
    parse: (content) => {
      const code = content.match(/```([a-z]*)\n([\s\S]*?)```/);
      const language = code?.[1] || '';
      const languageClass = language ? ` class="language-${escapeHtml(language)}"` : '';
      return [
        '<h1>Services Agreement Smoke Draft</h1>',
        '<p>This is a static export validation artifact.</p>',
        '<table><thead><tr><th>Item</th><th>Value</th></tr></thead>',
        '<tbody><tr><td>Scope</td><td>Dummy services agreement update</td></tr></tbody></table>',
        content.includes('Mermaid diagram source')
          ? '<p><strong>Mermaid diagram source</strong></p>'
          : '',
        `<pre><code${languageClass}>${escapeHtml(code?.[2] || '')}</code></pre>`
      ].join('');
    }
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

const MERMAID_WORK_PRODUCT_MARKDOWN = [
  '# Workflow diagram',
  '',
  'The assistant included a generated process diagram.',
  '',
  '```mermaid',
  'graph TD',
  '  A[Client instructions] --> B[Draft DOCX]',
  '  B --> C[Review and export]',
  '```'
].join('\n');

const DOCX_RICH_MARKDOWN = [
  '# Export fidelity proof',
  '',
  'Review [NEAR AI docs](https://near.ai/docs?section=agents&format=docx) before signature.',
  '',
  '- Preserve clause numbering',
  '- Keep approval notes editable',
  '',
  '1. Draft',
  '2. Review',
  '3. Export'
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
    'word/document.xml',
    'word/numbering.xml'
  ]);
  assert.match(entries.get('[Content_Types].xml'), /wordprocessingml\.document\.main\+xml/);
  assert.match(entries.get('[Content_Types].xml'), /wordprocessingml\.numbering\+xml/);
  assert.match(entries.get('word/document.xml'), /<w:tbl>/);
  assert.match(entries.get('word/document.xml'), /Services Agreement Smoke Draft/);
  assert.match(entries.get('word/document.xml'), /Dummy services agreement update/);
});

test('DOCX export preserves headings, links, and editable list structure', async () => {
  const entries = unzipStoredEntries(
    new Uint8Array(await buildDocxBlob(DOCX_RICH_MARKDOWN).arrayBuffer())
  );
  const rels = entries.get('word/_rels/document.xml.rels');
  const documentXml = entries.get('word/document.xml');
  const numbering = entries.get('word/numbering.xml');

  assert.match(documentXml, /<w:pStyle w:val="Heading1"\/>/);
  assert.match(documentXml, /<w:hyperlink r:id="rIdLink1" w:history="1">/);
  assert.match(documentXml, /NEAR AI docs/);
  assert.doesNotMatch(documentXml, /\]\(https:\/\/near\.ai/);
  assert.match(documentXml, /<w:numId w:val="1"\/>/);
  assert.match(documentXml, /<w:numId w:val="2"\/>/);
  assert.match(documentXml, /Preserve clause numbering/);
  assert.match(documentXml, /Draft/);

  assert.match(
    rels,
    /Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/numbering" Target="numbering\.xml"/
  );
  assert.match(
    rels,
    /Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/hyperlink"/
  );
  assert.match(rels, /TargetMode="External"/);
  assert.match(rels, /Target="https:\/\/near\.ai\/docs\?section=agents&amp;format=docx"/);
  assert.match(numbering, /<w:numFmt w:val="bullet"\/>/);
  assert.match(numbering, /<w:numFmt w:val="decimal"\/>/);
});

test('static exports preserve Mermaid diagram source in every work-product format', async () => {
  const markdown = await buildMarkdownBlob(MERMAID_WORK_PRODUCT_MARKDOWN).text();
  assert.equal(markdown, MERMAID_WORK_PRODUCT_MARKDOWN);
  assert.match(markdown, /```mermaid/);
  assert.match(markdown, /Draft DOCX/);

  const html = await buildHtmlBlob(MERMAID_WORK_PRODUCT_MARKDOWN).text();
  assert.match(html, /Mermaid diagram source/);
  assert.match(html, /class="language-mermaid"/);
  assert.match(html, /graph TD/);
  assert.match(html, /Draft DOCX/);

  const json = JSON.parse(
    await buildJsonBlob({
      role: 'assistant',
      content: MERMAID_WORK_PRODUCT_MARKDOWN
    }).text()
  );
  assert.equal(json.content, MERMAID_WORK_PRODUCT_MARKDOWN);

  const pdfText = new TextDecoder('latin1').decode(
    new Uint8Array(await buildPdfBlob(MERMAID_WORK_PRODUCT_MARKDOWN).arrayBuffer())
  );
  assert.match(pdfText, /Mermaid diagram source/);
  assert.match(pdfText, /graph TD/);
  assert.match(pdfText, /Draft DOCX/);
  assert.doesNotMatch(pdfText, /```/);

  const docx = buildDocxBlob(MERMAID_WORK_PRODUCT_MARKDOWN);
  const entries = unzipStoredEntries(new Uint8Array(await docx.arrayBuffer()));
  const documentXml = entries.get('word/document.xml');
  assert.match(documentXml, /Mermaid diagram source/);
  assert.match(documentXml, /graph TD/);
  assert.match(documentXml, /Draft DOCX/);
  assert.doesNotMatch(documentXml, /```/);
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
