import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDurableAttachmentBlock } from './history-messages.js';

// Mirrors the bundled sidecar's echo (and buildDurableAttachmentBlock): a
// length-prefixed fenced text section per attachment whose body deliberately
// contains `---` and manifest-look-alike lines ("Attachment 99:", a decoy
// "filename:"). A correct parser slices by extracted_text_chars, so the decoys
// never spawn phantom chips and never leak into the transcript.
function manifest(scenarios) {
  return [
    '<attachments ic="1">',
    ...scenarios.flatMap((scenario, index) => {
      const embedded = `INVOICE 7741 from ${scenario.name}\nfilename: decoy.pdf\nAttachment 99:\n---`;
      return [
        `Attachment ${index + 1}:`,
        `filename: ${scenario.name}`,
        `mime_type: ${scenario.mime}`,
        `size: ${scenario.size}`,
        'extraction_status: extracted_text',
        `extracted_text_chars: ${embedded.length}`,
        'extracted_text:',
        '---',
        embedded,
        '---'
      ];
    }),
    '</attachments>'
  ].join('\n');
}

const SCENARIOS = [
  { name: 'acme-invoice.pdf', mime: 'application/pdf', size: 1024 },
  { name: 'services-template.docx', mime: 'application/vnd.docx', size: 2048 },
  { name: 'pricing-model.xlsx', mime: 'application/vnd.xlsx', size: 4096 },
  { name: 'addendum.md', mime: 'text/markdown', size: 64 }
];

test('parseDurableAttachmentBlock extracts one chip per attachment and strips the block', () => {
  const content = `Draft a services agreement from this attachment.\n\n${manifest(SCENARIOS)}`;
  const { content: stripped, attachments } = parseDurableAttachmentBlock(content, {
    allowLegacy: true
  });

  // The manifest is stripped from the visible transcript.
  assert.equal(stripped, 'Draft a services agreement from this attachment.');
  assert.doesNotMatch(stripped, /<attachments/);

  // Exactly one chip per real attachment — the decoy "Attachment 99:" /
  // "filename: decoy.pdf" lines inside the fenced bodies must NOT spawn chips.
  assert.equal(attachments.length, SCENARIOS.length);
  assert.deepEqual(
    attachments.map((a) => a.filename),
    SCENARIOS.map((s) => s.name)
  );
  assert.ok(!attachments.some((a) => a.filename === 'decoy.pdf'));
});

test('each chip carries the model-read embedded text + metadata for the preview', () => {
  const content = `Prompt\n\n${manifest(SCENARIOS)}`;
  const { attachments } = parseDurableAttachmentBlock(content, { allowLegacy: true });
  for (const att of attachments) {
    assert.match(att.embedded_text, /INVOICE 7741/);
    assert.equal(att.extraction_status, 'extracted_text');
    assert.ok(att.size_label, 'size_label is derived from the size line');
    assert.ok(att.mime_type, 'mime_type is captured');
  }
});

test('a non-sentinel <attachments> block in ordinary content is left intact', () => {
  const content =
    'Quoting the wire format:\n\n<attachments>\nAttachment 1:\nfilename: x.txt\n</attachments>';
  const { content: out, attachments } = parseDurableAttachmentBlock(content);
  assert.equal(out, content);
  assert.equal(attachments.length, 0);
});

test('legacy (pre-sentinel) blocks parse only when allowLegacy is set', () => {
  const content =
    'Hello\n\n<attachments>\nAttachment 1:\nfilename: legacy.txt\nmime_type: text/plain\n</attachments>';
  assert.equal(parseDurableAttachmentBlock(content).attachments.length, 0);
  const parsed = parseDurableAttachmentBlock(content, { allowLegacy: true });
  assert.equal(parsed.attachments.length, 1);
  assert.equal(parsed.attachments[0].filename, 'legacy.txt');
  assert.equal(parsed.content, 'Hello');
});
