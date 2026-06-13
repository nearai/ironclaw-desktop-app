import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import { ensureHighlightJs } from './markdown-renderer.js';

test('ensureHighlightJs lazy-loads Highlight.js through the static asset loader once', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://127.0.0.1:1420/v2/chat' });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  const loads = [];
  window.__IRONCLAW_LOAD_SCRIPT__ = async (path) => {
    loads.push(path);
    window.hljs = { highlightElement() {} };
  };

  try {
    assert.equal(window.hljs, undefined);
    const [first, second] = await Promise.all([ensureHighlightJs(), ensureHighlightJs()]);
    assert.equal(first, window.hljs);
    assert.equal(second, window.hljs);
    assert.deepEqual(loads, ['vendor/highlight.min.js']);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    dom.window.close();
  }
});
