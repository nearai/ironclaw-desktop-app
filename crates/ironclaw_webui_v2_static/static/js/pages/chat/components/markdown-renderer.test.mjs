import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import {
  enhanceRenderedMarkdown,
  ensureHighlightJs,
  ensureMermaidJs,
  renderMermaidDiagram,
  resetMarkdownRendererTestState
} from './markdown-renderer.js';

test('ensureHighlightJs lazy-loads Highlight.js through the static asset loader once', async () => {
  resetMarkdownRendererTestState();
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

test('ensureMermaidJs lazy-loads Mermaid through the static asset loader once', async () => {
  resetMarkdownRendererTestState();
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://127.0.0.1:1420/v2/chat' });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  const loads = [];
  const initializes = [];
  window.__IRONCLAW_LOAD_SCRIPT__ = async (path) => {
    loads.push(path);
    window.mermaid = {
      initialize: (options) => initializes.push(options),
      render: async () => ({ svg: '<svg><text>ok</text></svg>' })
    };
  };

  try {
    const [first, second] = await Promise.all([ensureMermaidJs(), ensureMermaidJs()]);
    assert.equal(first, window.mermaid);
    assert.equal(second, window.mermaid);
    assert.deepEqual(loads, ['vendor/mermaid.min.js']);
    assert.equal(initializes.length, 1);
    assert.equal(initializes[0].startOnLoad, false);
    assert.equal(initializes[0].securityLevel, 'strict');
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    dom.window.close();
  }
});

test('renderMermaidDiagram sanitizes rendered SVG output', async () => {
  resetMarkdownRendererTestState();
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://127.0.0.1:1420/v2/chat' });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  window.mermaid = {
    initialize() {},
    render: async () => ({
      svg: '<svg><script>alert(1)</script><text>Approved flow</text></svg>'
    })
  };
  window.DOMPurify = {
    sanitize: (svg, options) => {
      assert.deepEqual(options, { USE_PROFILES: { svg: true, svgFilters: true } });
      return svg.replace(/<script[\s\S]*?<\/script>/g, '');
    }
  };

  try {
    const svg = await renderMermaidDiagram('graph TD; A-->B');
    assert.match(svg, /<svg>/);
    assert.match(svg, /Approved flow/);
    assert.doesNotMatch(svg, /script/);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    dom.window.close();
  }
});

test('enhanceRenderedMarkdown upgrades already-enhanced Mermaid blocks', () => {
  resetMarkdownRendererTestState();
  const dom = new JSDOM(
    [
      '<!doctype html><body>',
      '<section id="root">',
      '<pre data-enhanced="1"><code class="language-mermaid">graph TD\nA-->B</code></pre>',
      '</section>',
      '</body>'
    ].join(''),
    { url: 'http://127.0.0.1:1420/v2/chat' }
  );
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  try {
    enhanceRenderedMarkdown(document.getElementById('root'));
    assert.ok(document.querySelector('[data-md-renderer="mermaid"]'));
    assert.ok(document.querySelector('.v2-mermaid-card__source pre[data-enhanced="1"]'));
    assert.equal(document.querySelectorAll('[data-md-renderer="mermaid"]').length, 1);

    enhanceRenderedMarkdown(document.getElementById('root'));
    assert.equal(document.querySelectorAll('[data-md-renderer="mermaid"]').length, 1);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    dom.window.close();
  }
});
