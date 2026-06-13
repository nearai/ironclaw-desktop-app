import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function messageBubbleSourceForTest() {
  const source = readFileSync(new URL('../components/message-bubble.js', import.meta.url), 'utf8');
  const lines = [];
  let skippingImport = false;
  for (const line of source.split('\n')) {
    if (!skippingImport && line.startsWith('import ')) {
      skippingImport = !line.trimEnd().endsWith(';');
      continue;
    }
    if (skippingImport) {
      skippingImport = !line.trimEnd().endsWith(';');
      continue;
    }
    lines.push(line.replace('export function MessageBubble', 'function MessageBubble'));
  }
  return `${lines.join('\n')}\nglobalThis.__testExports = { MessageBubble, AssistantExportActions, exportThread, messageActionRowClass, messageContentForDisplay, assistantResponseLooksLikeWorkProduct, messageOuterClass, messageShellClass, messageBodyClass, attachmentEvidenceLabel, shouldCompactAttachmentStack, visibleAttachmentsForMessage, attachmentStackSummary, attachmentStackClass };`;
}

function findComponentByName(node, name) {
  if (!node || typeof node !== 'object' || !Array.isArray(node.values)) return null;
  if (node.values.some((value) => typeof value === 'function' && value.name === name)) {
    return node;
  }
  for (const value of node.values) {
    const found = findComponentByName(value, name);
    if (found) return found;
  }
  return null;
}

function componentPropsByName(node, name) {
  const props = {};
  const start = node.values.findIndex(
    (value) => typeof value === 'function' && value.name === name
  );
  for (let index = start + 1; index < node.values.length; index += 1) {
    const propName = node.strings[index]?.match(/([A-Za-z][A-Za-z0-9]*)=\s*$/)?.[1];
    if (propName) props[propName] = node.values[index];
  }
  return props;
}

function createMessageBubbleContext(overrides = {}) {
  return {
    React: {
      useCallback: (fn) => fn,
      useState: (initial) => [initial, () => {}]
    },
    globalThis: {},
    html: (strings, ...values) => ({ strings: Array.from(strings), values }),
    MarkdownRenderer() {},
    ToolActivity() {},
    AttachmentPreviewModal() {},
    Icon() {},
    Popover() {},
    Blob,
    toast: () => {},
    saveBlob: () => {},
    buildDocxBlob: (content) =>
      new Blob([content], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }),
    buildPdfBlob: (content) => new Blob([content], { type: 'application/pdf' }),
    downloadDocx: () => {},
    downloadHtml: () => {},
    downloadJson: () => {},
    downloadMarkdown: () => {},
    downloadPdf: () => {},
    copyWorkProduct: () => Promise.resolve(),
    saveAssistantResponseToWork: () => ({ href: '/work?item=work-1&artifact=artifact-1' }),
    openSavedWorkProduct: () => true,
    buildThreadJsonExport: () => '{}',
    buildThreadMarkdownExport: () => '# export',
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    setTimeout: () => {},
    ...overrides
  };
}

test('assistant export actions receive the full thread messages', () => {
  const messages = [
    { id: 'u1', role: 'user', content: 'Please draft an agreement.' },
    { id: 'a1', role: 'assistant', content: 'Draft ready.' }
  ];
  const context = createMessageBubbleContext();

  vm.runInNewContext(messageBubbleSourceForTest(), context);
  const tree = context.globalThis.__testExports.MessageBubble({
    message: messages[1],
    messages
  });
  const exportActions = findComponentByName(tree, 'AssistantExportActions');
  const props = componentPropsByName(exportActions, 'AssistantExportActions');

  assert.equal(props.content, 'Draft ready.');
  assert.equal(props.messages, messages);
});

test('assistant work-product actions are visible without hover and can wrap', () => {
  const context = createMessageBubbleContext();

  vm.runInNewContext(messageBubbleSourceForTest(), context);
  const actionClass = context.globalThis.__testExports.messageActionRowClass('assistant', false);

  assert.match(actionClass, /\bopacity-100\b/);
  assert.doesNotMatch(actionClass, /\bopacity-0\b/);
  assert.match(actionClass, /\bflex-wrap\b/);
  assert.match(actionClass, /\bmax-w-full\b/);
});

test('assistant markdown work product renders as a first-class artifact panel', () => {
  const context = createMessageBubbleContext();

  vm.runInNewContext(messageBubbleSourceForTest(), context);
  const {
    assistantResponseLooksLikeWorkProduct,
    messageOuterClass,
    messageShellClass,
    messageBodyClass
  } = context.globalThis.__testExports;

  assert.equal(
    assistantResponseLooksLikeWorkProduct('assistant', '# Services agreement\n\n## Scope'),
    true
  );
  assert.equal(assistantResponseLooksLikeWorkProduct('assistant', 'Sure, I can help.'), false);
  assert.equal(
    assistantResponseLooksLikeWorkProduct('user', '# User-authored instructions'),
    false
  );
  assert.match(messageOuterClass(false, true), /\bw-full\b/);
  assert.doesNotMatch(messageOuterClass(false, false), /\bw-full\b/);
  assert.match(messageShellClass(false, true), /\bw-full\b/);
  assert.match(messageShellClass(false, true), /max-w-\[min\(860px,92vw\)\]/);
  assert.match(messageBodyClass('assistant', false, true), /bg-\[var\(--v2-card-bg\)\]/);
  assert.match(messageBodyClass('assistant', false, true), /shadow-\[var\(--v2-card-shadow\)\]/);
  assert.doesNotMatch(messageBodyClass('assistant', false, false), /bg-\[var\(--v2-card-bg\)\]/);
});

test('assistant export actions collapse formats behind one export control', () => {
  const context = createMessageBubbleContext();

  vm.runInNewContext(messageBubbleSourceForTest(), context);
  const tree = context.globalThis.__testExports.AssistantExportActions({
    content: '# Draft',
    messages: [{ id: 'a1', role: 'assistant', content: '# Draft' }]
  });
  const popover = findComponentByName(tree, 'Popover');
  const props = componentPropsByName(popover, 'Popover');

  assert.ok(popover, 'export menu is rendered as a popover');
  assert.equal(props.open, false);
  assert.match(flatStrings(props.trigger), /Export/);
  assert.match(flatStrings(tree), /Save to Work/);
  assert.match(flatStrings(tree), /Thread DOCX/);
  assert.match(flatStrings(tree), /Thread PDF/);
});

test('whole-thread exports support PDF and DOCX artifacts', () => {
  const saved = [];
  const context = createMessageBubbleContext({
    document: { title: 'Thread Artifact Test' },
    saveBlob: (blob, filename) => {
      saved.push({ blob, filename });
      return `/tmp/${filename}`;
    },
    buildThreadMarkdownExport: (messages, options) =>
      [`# ${options.title}`, '', ...messages.map((message) => message.content)].join('\n'),
    buildDocxBlob: (content) =>
      new Blob([`docx:${content}`], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }),
    buildPdfBlob: (content) => new Blob([`pdf:${content}`], { type: 'application/pdf' })
  });

  vm.runInNewContext(messageBubbleSourceForTest(), context);
  const messages = [{ role: 'assistant', content: 'Generated agreement ready.' }];

  assert.equal(
    context.globalThis.__testExports.exportThread('docx', messages),
    '/tmp/ironclaw-chat-thread.docx'
  );
  assert.equal(
    context.globalThis.__testExports.exportThread('pdf', messages),
    '/tmp/ironclaw-chat-thread.pdf'
  );
  assert.equal(saved[0].filename, 'ironclaw-chat-thread.docx');
  assert.equal(
    saved[0].blob.type,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  assert.equal(saved[1].filename, 'ironclaw-chat-thread.pdf');
  assert.equal(saved[1].blob.type, 'application/pdf');
});

test('attachment-only user turns still render visible message content', () => {
  const context = createMessageBubbleContext();

  vm.runInNewContext(messageBubbleSourceForTest(), context);
  const { messageContentForDisplay } = context.globalThis.__testExports;

  assert.equal(
    messageContentForDisplay({
      role: 'user',
      content: '',
      attachments: [{ filename: 'brief.pdf' }]
    }),
    'Sent 1 attachment'
  );
  assert.equal(
    messageContentForDisplay({
      role: 'user',
      content: 'Draft against this template',
      attachments: [{ filename: 'brief.pdf' }]
    }),
    'Draft against this template'
  );
});

test('message attachment evidence labels say what was retained for the model', () => {
  const context = createMessageBubbleContext();

  vm.runInNewContext(messageBubbleSourceForTest(), context);
  const { attachmentEvidenceLabel } = context.globalThis.__testExports;

  assert.equal(
    attachmentEvidenceLabel({
      filename: 'services.pdf',
      embedded_text: 'Clause text',
      extraction_status: 'extracted_text_truncated'
    }),
    'Model-read text retained, truncated'
  );
  assert.equal(
    attachmentEvidenceLabel({
      filename: 'huge.bin',
      extraction_status: 'content_omitted_message_budget'
    }),
    'Sent as file metadata'
  );
  assert.equal(
    attachmentEvidenceLabel({
      filename: 'brief.md',
      modelReadable: true
    }),
    'Model-readable payload retained'
  );
});

test('large user attachment stacks compact while preserving expandable access', () => {
  const context = createMessageBubbleContext();

  vm.runInNewContext(messageBubbleSourceForTest(), context);
  const {
    MessageBubble,
    shouldCompactAttachmentStack,
    visibleAttachmentsForMessage,
    attachmentStackSummary,
    attachmentStackClass
  } = context.globalThis.__testExports;
  const attachments = Array.from({ length: 5 }, (_, index) => ({
    filename: `file-${index + 1}.pdf`,
    mime_type: 'application/pdf',
    size_label: `${index + 1} KB`,
    embedded_text: index < 4 ? `text ${index}` : ''
  }));

  assert.equal(shouldCompactAttachmentStack('user', attachments), true);
  assert.equal(shouldCompactAttachmentStack('assistant', attachments), false);
  assert.deepEqual(
    visibleAttachmentsForMessage('user', attachments, false).map((att) => att.filename),
    ['file-1.pdf', 'file-2.pdf', 'file-3.pdf']
  );
  assert.equal(visibleAttachmentsForMessage('user', attachments, true).length, 5);
  assert.equal(attachmentStackSummary(attachments), '4 files have model-readable text');
  assert.match(attachmentStackClass(true), /rounded-\[14px\]/);

  const tree = MessageBubble({
    message: {
      id: 'u1',
      role: 'user',
      content: 'Draft from these files.',
      attachments
    }
  });
  const flat = flatStrings(tree);

  assert.match(flat, /compact-attachment-stack/);
  assert.match(flat, /files attached/);
  assert.match(flat, /\b5\b/);
  assert.match(flat, /Show\s+2\s+more files|Show 2 more attached files/);
  assert.match(flat, /file-1\.pdf/);
  assert.match(flat, /file-3\.pdf/);
  assert.doesNotMatch(flat, /file-4\.pdf/);
  assert.doesNotMatch(flat, /file-5\.pdf/);
});

test('user action row remains quiet until hover or focus', () => {
  const context = createMessageBubbleContext();

  vm.runInNewContext(messageBubbleSourceForTest(), context);
  const actionClass = context.globalThis.__testExports.messageActionRowClass('user', true);

  assert.match(actionClass, /\bopacity-0\b/);
  assert.match(actionClass, /\bgroup-hover:opacity-100\b/);
  assert.match(actionClass, /\bfocus-within:opacity-100\b/);
});

function flatStrings(node) {
  const out = [];
  const visit = (value) => {
    if (value == null) return;
    if (typeof value === 'string' || typeof value === 'number') {
      out.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object' && Array.isArray(value.strings)) {
      out.push(value.strings.join(' '));
      value.values.forEach(visit);
    }
  };
  visit(node);
  return out.join('\n');
}
