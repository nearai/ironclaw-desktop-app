import assert from 'node:assert/strict';
import test from 'node:test';

import { saveBlob } from './save-file.js';

test('saveBlob uses the Tauri save dialog on desktop', async () => {
  const calls = [];
  globalThis.window = {
    __TAURI_INTERNALS__: {
      invoke: async (command, args) => {
        calls.push({ command, args });
        return '/tmp/note.txt';
      }
    }
  };

  const result = await saveBlob(new Blob(['hi']), 'note.txt');

  assert.equal(result, '/tmp/note.txt');
  assert.deepEqual(calls, [
    {
      command: 'save_bytes_dialog',
      args: {
        defaultFilename: 'note.txt',
        contentsBase64: 'aGk='
      }
    }
  ]);
});

test('saveBlob uses an anchor download in browser mode', async () => {
  const appended = [];
  const clicked = [];
  const removed = [];
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:test-url';
  URL.revokeObjectURL = () => {};
  globalThis.window = {};
  globalThis.document = {
    body: {
      appendChild: (node) => appended.push(node)
    },
    createElement: () => ({
      href: '',
      download: '',
      click() {
        clicked.push(this.href);
      },
      remove() {
        removed.push(this.href);
      }
    })
  };

  try {
    const result = await saveBlob(new Blob(['hi']), 'note.txt');
    assert.equal(result, 'note.txt');
    assert.equal(appended[0].href, 'blob:test-url');
    assert.equal(appended[0].download, 'note.txt');
    assert.deepEqual(clicked, ['blob:test-url']);
    assert.deepEqual(removed, ['blob:test-url']);
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  }
});
