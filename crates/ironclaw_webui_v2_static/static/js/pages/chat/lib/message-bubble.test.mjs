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
  return `${lines.join('\n')}\nglobalThis.__testExports = { MessageBubble, AssistantExportActions, messageActionRowClass, messageContentForDisplay, attachmentEvidenceLabel };`;
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
    toast: () => {},
    saveBlob: () => {},
    downloadDocx: () => {},
    downloadHtml: () => {},
    downloadJson: () => {},
    downloadMarkdown: () => {},
    downloadPdf: () => {},
    copyWorkProduct: () => Promise.resolve(),
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
