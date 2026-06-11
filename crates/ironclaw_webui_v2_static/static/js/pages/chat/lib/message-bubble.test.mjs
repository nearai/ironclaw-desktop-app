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
  return `${lines.join('\n')}\nglobalThis.__testExports = { MessageBubble };`;
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

test('assistant export actions receive the full thread messages', () => {
  const messages = [
    { id: 'u1', role: 'user', content: 'Please draft an agreement.' },
    { id: 'a1', role: 'assistant', content: 'Draft ready.' }
  ];
  const context = {
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
    toast: () => {},
    saveBlob: () => {},
    downloadDocx: () => {},
    downloadHtml: () => {},
    downloadJson: () => {},
    downloadMarkdown: () => {},
    downloadPdf: () => {},
    buildThreadJsonExport: () => '{}',
    buildThreadMarkdownExport: () => '# export',
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    setTimeout: () => {}
  };

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
