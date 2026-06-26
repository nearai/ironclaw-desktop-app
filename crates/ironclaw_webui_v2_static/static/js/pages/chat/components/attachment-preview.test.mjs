import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function attachmentPreviewSourceForTest() {
  const source = readFileSync(new URL('./attachment-preview.js', import.meta.url), 'utf8');
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
    lines.push(line.replace('export function AttachmentPreviewModal', 'function AttachmentPreviewModal'));
  }
  return `${lines.join('\n')}\nglobalThis.__testExports = { AttachmentPreviewModal };`;
}

function depsChanged(previous, next) {
  if (!previous || !next || previous.length !== next.length) return true;
  return next.some((value, index) => !Object.is(value, previous[index]));
}

function collectText(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(' ');
  if (typeof node === 'object' && Array.isArray(node.values)) {
    return node.strings
      .map((part, index) => `${part} ${collectText(node.values[index])}`)
      .join(' ');
  }
  return '';
}

function valueAfter(node, fragment) {
  const index = node.strings.findIndex((part) => part.includes(fragment));
  assert.notEqual(index, -1, `expected template fragment ${fragment}`);
  return node.values[index];
}

function findTemplateWithFragment(node, fragment) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findTemplateWithFragment(item, fragment);
      if (found) return found;
    }
    return null;
  }
  if (Array.isArray(node.strings) && node.strings.some((part) => part.includes(fragment))) {
    return node;
  }
  if (Array.isArray(node.values)) {
    for (const value of node.values) {
      const found = findTemplateWithFragment(value, fragment);
      if (found) return found;
    }
  }
  return null;
}

async function flushPromises() {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

test('AttachmentPreviewModal truncates remote text and aborts fetch on cleanup', async () => {
  const hooks = [];
  const cleanups = [];
  let hookIndex = 0;
  let capturedSignal = null;
  const largeText = 'x'.repeat(129_000);
  const context = {
    AbortController,
    Blob,
    Icon: 'Icon',
    Modal: 'Modal',
    ModalBody: 'ModalBody',
    React: {
      useEffect(effect, deps) {
        const index = hookIndex++;
        const hook = hooks[index];
        if (!hook || depsChanged(hook.deps, deps)) {
          hooks[index] = { deps };
          const cleanup = effect();
          if (typeof cleanup === 'function') cleanups[index] = cleanup;
        }
      },
      useRef(initial) {
        const index = hookIndex++;
        if (!hooks[index]) hooks[index] = { current: initial };
        return hooks[index];
      },
      useState(initial) {
        const index = hookIndex++;
        if (!hooks[index]) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
        const setValue = (next) => {
          hooks[index].value = typeof next === 'function' ? next(hooks[index].value) : next;
        };
        return [hooks[index].value, setValue];
      }
    },
    URL: {
      createObjectURL: () => 'blob:preview',
      revokeObjectURL: () => {}
    },
    fetchAttachmentBlob: async (_url, { signal } = {}) => {
      capturedSignal = signal;
      return new Blob([largeText], { type: 'text/plain' });
    },
    globalThis: {},
    html: (strings, ...values) => ({ strings: Array.from(strings), values }),
    isPdfAttachment: () => false,
    loadPdfjs: async () => ({}),
    saveBlob: async () => null,
    toast: () => {},
    useT: () => (key) => key
  };
  vm.runInNewContext(attachmentPreviewSourceForTest(), context);

  const render = () => {
    hookIndex = 0;
    return context.globalThis.__testExports.AttachmentPreviewModal({
      open: true,
      onClose: () => {},
      attachment: {
        filename: 'large.txt',
        mime_type: 'text/plain',
        fetch_url: '/api/file/large.txt'
      }
    });
  };

  render();
  await flushPromises();
  const tree = render();
  const remotePreview = findTemplateWithFragment(tree, 'remoteState=');
  assert.ok(remotePreview, 'expected remote preview body template');
  const remoteState = valueAfter(remotePreview, 'remoteState=');

  assert.equal(remoteState.status, 'ready');
  assert.equal(remoteState.truncated, true);
  assert.equal(remoteState.text.length, 128_000);
  assert.ok(remoteState.text.includes('x'.repeat(1000)));

  cleanups.forEach((cleanup) => cleanup?.());
  assert.equal(capturedSignal.aborted, true);
});
