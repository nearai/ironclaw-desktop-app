import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadRenderMarkdown(globals) {
  let source = readFileSync(new URL('./markdown.js', import.meta.url), 'utf8');
  source = source.replace('export function renderMarkdown', 'function renderMarkdown');
  source += '\nglobalThis.__testExports = { renderMarkdown };';
  const context = { ...globals, globalThis: {} };
  vm.runInNewContext(source, context);
  return context.globalThis.__testExports.renderMarkdown;
}

test('renderMarkdown routes parsed HTML through DOMPurify.sanitize, stripping handlers', () => {
  const calls = { parse: [], sanitize: [] };
  const renderMarkdown = loadRenderMarkdown({
    window: {
      marked: {
        parse: (content, opts) => {
          calls.parse.push({ content, opts });
          return `<p>${content}</p>`;
        }
      },
      DOMPurify: {
        sanitize: (raw) => {
          calls.sanitize.push(raw);
          return raw.replace(/ onerror="[^"]*"/g, '');
        }
      }
    }
  });

  const out = renderMarkdown('<img src=x onerror="alert(1)">');

  assert.equal(calls.parse.length, 1);
  assert.equal(calls.parse[0].opts.gfm, true);
  assert.equal(calls.parse[0].opts.breaks, true);
  assert.equal(calls.sanitize.length, 1);
  assert.equal(calls.sanitize[0], '<p><img src=x onerror="alert(1)"></p>');
  assert.ok(!out.includes('onerror'));
  assert.equal(out, '<p><img src=x></p>');
});

test('renderMarkdown escapes via textContent when marked/DOMPurify are absent', () => {
  const renderMarkdown = loadRenderMarkdown({
    window: {},
    document: {
      createElement: () => {
        const el = { _html: '' };
        Object.defineProperty(el, 'textContent', {
          set(value) {
            el._html = String(value)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
          }
        });
        Object.defineProperty(el, 'innerHTML', {
          get() {
            return el._html;
          }
        });
        return el;
      }
    }
  });

  const out = renderMarkdown('<script>alert(1)</script>');
  assert.equal(out, '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.ok(!out.includes('<script>'));
});

test('renderMarkdown returns an empty string for falsy content', () => {
  const renderMarkdown = loadRenderMarkdown({
    window: { marked: { parse: () => 'X' }, DOMPurify: { sanitize: () => 'X' } }
  });
  assert.equal(renderMarkdown(''), '');
  assert.equal(renderMarkdown(null), '');
  assert.equal(renderMarkdown(undefined), '');
});
