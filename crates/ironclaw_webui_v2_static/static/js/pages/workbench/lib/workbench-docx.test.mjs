import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDocumentXml, buildDocxBytes, DOCX_MIME } from './workbench-docx.js';

const SAMPLE = {
  title: 'Northwind MSA — Counter Summary',
  subtitle: 'Prepared by IronClaw · review before sending',
  sections: [
    {
      heading: 'Key terms',
      paragraphs: ['Liability cap held at 12 months of fees.', 'Net 60 payment.']
    },
    { heading: 'Open issues', paragraphs: ['Data/security indemnity language to preserve.'] }
  ],
  sources: ['Gmail: Dana Reyes thread (2026-06-21)', 'Drive: Northwind MSA v3.docx']
};

test('document.xml carries the title, headings, paragraphs, and an Arial run', () => {
  const xml = buildDocumentXml(SAMPLE);
  assert.match(xml, /<w:document/, 'is a wordprocessing document');
  assert.match(xml, /Northwind MSA — Counter Summary/, 'title present');
  assert.match(xml, /Key terms/, 'section heading present');
  assert.match(xml, /Liability cap held at 12 months/, 'paragraph present');
  assert.match(xml, /w:rFonts w:ascii="Arial"/, 'Arial per the doc-formatting convention');
  assert.match(xml, /<w:b\/>/, 'headings are bold');
});

test('sources render as an explicit, numbered, editable Sources section', () => {
  const xml = buildDocumentXml(SAMPLE);
  assert.match(xml, /Sources/, 'Sources heading present');
  assert.match(xml, /1\. Gmail: Dana Reyes thread/, 'first source numbered');
  assert.match(xml, /2\. Drive: Northwind MSA v3\.docx/, 'second source numbered');
});

test('XML-unsafe content is escaped, never breaking the package', () => {
  const xml = buildDocumentXml({ title: 'A & B <tag> "q"', sections: [] });
  assert.match(xml, /A &amp; B &lt;tag&gt; &quot;q&quot;/);
  assert.doesNotMatch(xml, /<tag>/);
});

test('buildDocxBytes emits a real ZIP/OPC package with the document part', () => {
  const bytes = buildDocxBytes(SAMPLE);
  assert.ok(bytes instanceof Uint8Array && bytes.length > 200, 'non-trivial byte output');
  // ZIP local-file-header magic PK\x03\x04
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04], 'ZIP magic');
  // EOCD magic PK\x05\x06 near the end
  const tail = bytes.slice(-22);
  assert.deepEqual([...tail.slice(0, 4)], [0x50, 0x4b, 0x05, 0x06], 'EOCD present');
  const asText = new TextDecoder('latin1').decode(bytes);
  assert.ok(asText.includes('word/document.xml'), 'document part named');
  assert.ok(asText.includes('[Content_Types].xml'), 'content types part named');
});

test('DOCX_MIME is the Word document content type', () => {
  assert.equal(
    DOCX_MIME,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
});
