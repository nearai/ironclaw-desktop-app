import assert from 'node:assert/strict';
import test from 'node:test';

import {
  firstArtifact,
  savedArtifactPreview,
  savedArtifactText,
  savedWorkHref
} from './workbench-work-items.js';

test('firstArtifact returns the first saved artifact with actual local content', () => {
  const item = {
    artifacts: [
      { title: 'No id' },
      { id: 'placeholder', title: 'Title only' },
      { id: 'artifact-one', title: 'Review brief', content: 'Saved body' },
      { id: 'artifact-two', title: 'Follow-up draft', filename: 'draft.docx' }
    ]
  };

  assert.equal(firstArtifact(item), item.artifacts[2]);
});

test('savedWorkHref preserves Work item and artifact query params', () => {
  assert.equal(
    savedWorkHref({
      id: 'work-response',
      artifacts: [{ id: 'artifact', title: 'Renewal summary', content: 'Terms summary' }]
    }),
    '/work?item=work-response&artifact=artifact'
  );
});

test('savedWorkHref falls back to Work when no saved artifact is available', () => {
  assert.equal(savedWorkHref(null), '/work');
  assert.equal(savedWorkHref({ id: 'work-response', artifacts: [{ title: 'Draft pending' }] }), '/work');
  assert.equal(
    savedWorkHref({ id: 'work-response', artifacts: [{ id: 'hollow', title: 'Draft pending' }] }),
    '/work'
  );
});

test('savedArtifactPreview exposes honest text, file, and empty states', () => {
  assert.deepEqual(savedArtifactPreview({ id: 'a1', title: 'Brief', content: '  # Brief  ' }), {
    kind: 'text',
    title: 'Brief',
    text: '# Brief',
    label: 'markdown/text'
  });

  assert.deepEqual(
    savedArtifactPreview({
      id: 'a2',
      title: 'Deck',
      filename: 'plan.pptx',
      mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      data_base64: 'UEsDBA==',
      size_label: '18 KB'
    }),
    {
      kind: 'file',
      title: 'Deck',
      filename: 'plan.pptx',
      label: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      sizeLabel: '18 KB',
      hasBytes: true,
      hasRemoteReference: false
    }
  );

  assert.equal(savedArtifactPreview({ id: 'a3', title: 'Only metadata' }).kind, 'empty');
});

test('savedArtifactText never treats base64 payloads as readable document text', () => {
  assert.equal(
    savedArtifactText({
      id: 'artifact',
      content: 'UEsDBA==',
      content_format: 'base64'
    }),
    ''
  );
});

test('savedArtifactText withholds binary/document formats instead of rendering raw bytes', () => {
  for (const content_format of ['binary', 'application/pdf', 'octet-stream', 'image/png']) {
    assert.equal(
      savedArtifactText({ id: 'artifact', content: 'not-really-readable', content_format }),
      '',
      `expected ${content_format} content to be withheld from the document body`
    );
  }
});

test('savedArtifactText still renders legacy and explicit text formats', () => {
  assert.equal(savedArtifactText({ content: '  # Legacy markdown  ' }), '# Legacy markdown');
  assert.equal(savedArtifactText({ content: 'plain body', content_format: 'text' }), 'plain body');
  assert.equal(savedArtifactText({ content: '# md body', content_format: 'markdown' }), '# md body');
});
