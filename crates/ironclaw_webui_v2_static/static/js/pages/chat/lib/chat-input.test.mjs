import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function chatInputSourceForTest() {
  const source = readFileSync(new URL('../components/chat-input.js', import.meta.url), 'utf8');
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
    lines.push(line.replace('export function ChatInput', 'function ChatInput'));
  }
  return `${lines.join('\n')}\nglobalThis.__testExports = { ChatInput, formatProviderLabel };`;
}

function findComponent(node, component) {
  if (!node || typeof node !== 'object') return null;
  if (!Array.isArray(node.values)) return null;
  const componentIndex = node.values.indexOf(component);
  if (componentIndex >= 0) {
    return node;
  }
  for (const value of node.values) {
    const found = findComponent(value, component);
    if (found) return found;
  }
  return null;
}

function componentProps(node, component) {
  const props = {};
  const start = node.values.indexOf(component);
  for (let index = start + 1; index < node.values.length; index += 1) {
    const name = node.strings[index]?.match(/([A-Za-z][A-Za-z0-9]*)=\s*$/)?.[1];
    if (name) props[name] = node.values[index];
  }
  return props;
}

function renderChatInput({ onCancel, setCalls = [] } = {}) {
  const components = {
    Button() {},
    Icon() {},
    Popover() {},
    AttachmentPreviewModal() {}
  };
  let stateIndex = 0;
  const context = {
    ...components,
    React: {
      useCallback: (fn) => fn,
      useEffect: () => {},
      useRef: () => ({ current: null }),
      useState: (initial) => {
        const index = stateIndex++;
        let value = typeof initial === 'function' ? initial() : initial;
        return [
          value,
          (next) => {
            value = typeof next === 'function' ? next(value) : next;
            setCalls.push({ index, value });
          }
        ];
      }
    },
    addFiles: () => {},
    clearAttachments: () => {},
    formatSize: (size) => String(size),
    globalThis: {},
    html: (strings, ...values) => ({ strings: Array.from(strings), values }),
    removeAttachment: () => {},
    removeImage: () => {},
    useComposerAttachments: () => ({
      images: [],
      attachments: [],
      rejections: [],
      addFiles: () => {},
      removeImage: () => {},
      removeAttachment: () => {},
      dismissRejections: () => {},
      clearAttachments: () => {}
    }),
    useT: () => (key) => key,
    // ModelPopover dependencies — inert here; popover stays closed in
    // these cancel-button scenarios.
    useQuery: () => ({ data: null, isLoading: false }),
    useQueryClient: () => ({ invalidateQueries: () => {} }),
    listLlmProviderModels: async () => ({ models: [] }),
    fetchLlmProviders: async () => ({ providers: [], active: null }),
    setActiveLlm: async () => ({}),
    gatewayStatus: () => ({}),
    window: { requestAnimationFrame: (fn) => fn() }
  };

  vm.runInNewContext(chatInputSourceForTest(), context);
  const tree = context.globalThis.__testExports.ChatInput({
    onSend: async () => {},
    onCancel,
    disabled: true,
    canCancel: true
  });
  return { tree, components };
}

test('ChatInput cancel button invokes onCancel and resets cancelling state', async () => {
  const setCalls = [];
  let cancelCalls = 0;
  let resolveCancel;
  const { tree, components } = renderChatInput({
    setCalls,
    onCancel: async () =>
      new Promise((resolve) => {
        cancelCalls += 1;
        resolveCancel = resolve;
      })
  });

  const cancelButton = findComponent(tree, components.Button);
  const props = componentProps(cancelButton, components.Button);
  const cancelPromise = props.onClick();

  assert.equal(cancelCalls, 1);
  assert.deepEqual(setCalls.slice(0, 1), [{ index: 2, value: true }]);

  resolveCancel();
  await cancelPromise;

  assert.deepEqual(setCalls.slice(-1), [{ index: 2, value: false }]);
});

test('ChatInput cancel button resets cancelling state after rejection', async () => {
  const setCalls = [];
  const { tree, components } = renderChatInput({
    setCalls,
    onCancel: async () => {
      throw new Error('cancel failed');
    }
  });

  const cancelButton = findComponent(tree, components.Button);
  const props = componentProps(cancelButton, components.Button);
  await assert.rejects(props.onClick(), /cancel failed/);

  assert.deepEqual(setCalls, [
    { index: 2, value: true },
    { index: 2, value: false }
  ]);
});

test('formatProviderLabel maps known provider ids to readable names', () => {
  const vmContext = {
    React: {},
    globalThis: {}
  };
  vm.runInNewContext(chatInputSourceForTest(), vmContext);
  const { formatProviderLabel } = vmContext.globalThis.__testExports;
  assert.equal(formatProviderLabel('nearai'), 'NEAR.AI');
  assert.equal(formatProviderLabel('openai_codex'), 'OpenAI Codex');
  assert.equal(formatProviderLabel('openrouter'), 'OpenRouter');
  assert.equal(formatProviderLabel('anthropic'), 'Anthropic');
});

test('formatProviderLabel uses custom display name and humanizes unknown ids', () => {
  const vmContext = {
    React: {},
    globalThis: {}
  };
  vm.runInNewContext(chatInputSourceForTest(), vmContext);
  const { formatProviderLabel } = vmContext.globalThis.__testExports;
  assert.equal(formatProviderLabel('openai_codex', 'My Custom Provider'), 'My Custom Provider');
  assert.equal(formatProviderLabel('my_custom-provider'), 'My Custom Provider');
});
