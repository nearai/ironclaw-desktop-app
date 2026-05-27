// Tests for the markdown → sanitized HTML pipeline.
//
// The component plumbs `marked` through DOMPurify and a small set of
// renderer overrides (heading anchors, syntax-highlighted code, GFM
// callouts). We assert each shape lands in the final DOM, plus the
// two XSS guards that matter for a content-rendering surface:
//
//   - `<script>` tags must never survive (DOMPurify default).
//   - inline `on*` event handlers must be stripped.
//
// Image data: URLs (used for attachments) must pass through; bare
// `javascript:` URLs must be stripped to prevent the classic
// `[click](javascript:…)` smuggling vector.

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';

import MarkdownView from './MarkdownView.svelte';

describe('MarkdownView sanitization + renderer', () => {
  it('renders h1/h2/h3 with id attributes for anchors', () => {
    const md = '# Header One\n\n## Header Two\n\n### Header Three';
    const { container } = render(MarkdownView, { props: { markdown: md } });
    const h1 = container.querySelector('h1');
    const h2 = container.querySelector('h2');
    const h3 = container.querySelector('h3');
    expect(h1?.getAttribute('id')).toBe('header-one');
    expect(h2?.getAttribute('id')).toBe('header-two');
    expect(h3?.getAttribute('id')).toBe('header-three');
    // Each anchor-handle `<a class="md-anchor">` lives inside the heading.
    expect(h1?.querySelector('a.md-anchor')).not.toBeNull();
  });

  it('renders fenced code blocks with hljs class on the <code>', () => {
    const md = '```javascript\nconst x = 1;\n```';
    const { container } = render(MarkdownView, { props: { markdown: md } });
    const code = container.querySelector('pre code');
    expect(code).not.toBeNull();
    expect(code?.className).toContain('hljs');
    expect(code?.className).toContain('language-javascript');
  });

  it('renders GFM tables into <table>/<thead>/<tbody>', () => {
    const md = '| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |';
    const { container } = render(MarkdownView, { props: { markdown: md } });
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table?.querySelector('thead')).not.toBeNull();
    expect(table?.querySelector('tbody')).not.toBeNull();
    expect(table?.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('renders [!NOTE] / [!WARNING] callouts with the right class', () => {
    const noteMd = '> [!NOTE]\n> body text';
    const { container: noteContainer } = render(MarkdownView, {
      props: { markdown: noteMd }
    });
    expect(noteContainer.querySelector('.md-callout.md-callout--note')).not.toBeNull();
    expect(noteContainer.querySelector('.md-callout__head')?.textContent).toBe('Note');

    const warnMd = '> [!WARNING]\n> heads up';
    const { container: warnContainer } = render(MarkdownView, {
      props: { markdown: warnMd }
    });
    expect(warnContainer.querySelector('.md-callout.md-callout--warning')).not.toBeNull();
    expect(warnContainer.querySelector('.md-callout__head')?.textContent).toBe('Warning');

    // A plain blockquote with no `[!TYPE]` prefix falls through to
    // <blockquote>, not a callout.
    const plainMd = '> just a quote';
    const { container: plainContainer } = render(MarkdownView, {
      props: { markdown: plainMd }
    });
    expect(plainContainer.querySelector('.md-callout')).toBeNull();
    expect(plainContainer.querySelector('blockquote')).not.toBeNull();
  });

  it('DOMPurify strips <script> tags', () => {
    const md = 'safe <script>alert(1)</script> after';
    const { container } = render(MarkdownView, { props: { markdown: md } });
    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).not.toContain('<script');
    expect(container.innerHTML).not.toContain('alert(1)');
  });

  it('DOMPurify strips inline event handlers (onclick, onerror)', () => {
    const md = '<img src="x" onerror="alert(1)" /><div onclick="alert(2)">x</div>';
    const { container } = render(MarkdownView, { props: { markdown: md } });
    const img = container.querySelector('img');
    const div = container.querySelector('div.markdown div');
    // The elements may or may not survive depending on profile; what
    // matters is the event-handler attributes never make it through.
    expect(img?.getAttribute('onerror')).toBeNull();
    expect(div?.getAttribute('onclick') ?? null).toBeNull();
    expect(container.innerHTML).not.toContain('onerror=');
    expect(container.innerHTML).not.toContain('onclick=');
  });

  it('allows data:image/* URLs (attachments pass through)', () => {
    // 1×1 transparent PNG; tiny synthetic data URL.
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const md = `![alt](${dataUrl})`;
    const { container } = render(MarkdownView, { props: { markdown: md } });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe(dataUrl);
  });

  it('strips bare javascript: URLs on links (XSS guard)', () => {
    const md = '[click me](javascript:alert(1))';
    const { container } = render(MarkdownView, { props: { markdown: md } });
    const link = container.querySelector('a:not(.md-anchor)');
    // Either the anchor is dropped entirely or its href is neutralized.
    if (link) {
      const href = link.getAttribute('href') ?? '';
      expect(href.startsWith('javascript:')).toBe(false);
    }
    // Belt-and-braces: the literal scheme must not appear in the rendered HTML.
    expect(container.innerHTML.toLowerCase()).not.toContain('javascript:alert');
  });

  it('renders plain text inside a <p> (no bare-text injection)', () => {
    const md = 'just a sentence';
    const { container } = render(MarkdownView, { props: { markdown: md } });
    const p = container.querySelector('p');
    expect(p).not.toBeNull();
    expect(p?.textContent).toBe('just a sentence');
  });
});
