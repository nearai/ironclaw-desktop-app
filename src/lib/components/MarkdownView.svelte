<script lang="ts">
  // Markdown renderer used by chat messages, knowledge previews, and routine
  // result blocks. Pipes `marked` output through DOMPurify before injecting
  // via {@html}. Styling is applied via a scoped class to avoid pulling in
  // the @tailwindcss/typography plugin for our handful of element rules.
  //
  // Adds a delegated copy-to-clipboard button to every <pre> block. The button
  // is injected post-render via a $effect that walks the wrapper DOM; a single
  // click listener on the wrapper handles dispatch so we don't re-attach
  // per-block listeners on every keystroke during streaming.
  //
  // Enhancements (2026-05):
  //   1. Syntax highlighting via highlight.js (github-dark theme), wired
  //      through a marked renderer override on `code`.
  //   2. GFM tables — marked default; styles below give them a dark theme.
  //   3. Anchor links on h1/h2/h3 — heading renderer slugifies the rendered
  //      text and prepends a chain icon that copies `#slug` on click.
  //   4. Admonition-style callouts — `> [!NOTE|WARNING|CAUTION|TIP|IMPORTANT]`
  //      blockquotes are rendered as tinted callouts.
  //   5. Multimodal markdown renderers — Mermaid and Plotly fenced blocks
  //      are emitted as sanitized placeholders, and $inline$ / $$display$$
  //      math is inserted by a post-render text-node pass. Heavy libraries
  //      lazy-load inside their small renderer components.
  //
  // The component API (`markdown` prop) is unchanged; all consumers
  // (chat, knowledge, admin) keep working without modification.

  import { marked, type Tokens } from 'marked';
  import DOMPurify from 'dompurify';
  // Tree-shaken highlight.js: import the core engine + just the grammars we
  // render. The default `import hljs from 'highlight.js'` pulls all 200+
  // languages (~1 MB minified, ~330 KB gzipped). The list below covers
  // everything chat/knowledge actually renders today (~10 langs).
  import hljs from 'highlight.js/lib/core';
  import bash from 'highlight.js/lib/languages/bash';
  import typescript from 'highlight.js/lib/languages/typescript';
  import javascript from 'highlight.js/lib/languages/javascript';
  import rust from 'highlight.js/lib/languages/rust';
  import python from 'highlight.js/lib/languages/python';
  import json from 'highlight.js/lib/languages/json';
  // Renamed to avoid colliding with the `markdown` component prop below.
  import markdownLang from 'highlight.js/lib/languages/markdown';
  import yaml from 'highlight.js/lib/languages/yaml';
  import sql from 'highlight.js/lib/languages/sql';
  // highlight.js folds TOML into the `ini` grammar (declared name "TOML, also
  // INI"; ships `toml` as an alias).
  import ini from 'highlight.js/lib/languages/ini';
  // The `xml` grammar covers HTML/XHTML/RSS/Atom — that's how highlight.js
  // ships HTML support.
  import xml from 'highlight.js/lib/languages/xml';
  import css from 'highlight.js/lib/languages/css';
  import 'highlight.js/styles/github-dark.css';
  import { mount, unmount } from 'svelte';
  import { toasts } from '$lib/stores/toasts.svelte';
  import Mermaid from './markdown-renderers/Mermaid.svelte';
  import MathRenderer from './markdown-renderers/Math.svelte';
  import Plotly from './markdown-renderers/Plotly.svelte';

  // `registerLanguage` auto-registers each grammar's declared aliases too, so
  // explicit aliasing below is only needed where we want to add forms that
  // highlight.js doesn't bundle (e.g. `shell` → bash, since highlight.js's
  // `shell` is a separate shell-session grammar we don't ship).
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('rust', rust);
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('markdown', markdownLang);
  hljs.registerLanguage('yaml', yaml);
  hljs.registerLanguage('sql', sql);
  hljs.registerLanguage('ini', ini);
  hljs.registerLanguage('xml', xml);
  hljs.registerLanguage('css', css);
  // Common shortened forms not already declared by the grammars above.
  // (bash already aliases sh/zsh; typescript → ts/tsx/mts/cts; javascript →
  // js/jsx/mjs/cjs; python → py/gyp/ipython; markdown → md/mkdown/mkd; yaml →
  // yml; rust → rs; xml → html/xhtml/rss/atom; ini → toml — so those are free.)
  hljs.registerAliases(['shell', 'console'], { languageName: 'bash' });

  let { markdown = '' }: { markdown?: string } = $props();

  // `marked.parse` is synchronous when `async: false` (the default in v15).
  // We cast through `string` because the typings allow `Promise<string>`.
  marked.setOptions({ breaks: true, gfm: true, async: false });

  // --- Renderer overrides -----------------------------------------------
  //
  // marked v15 dropped the standalone `Slugger`; renderer methods now take
  // an object with `tokens`/`depth`/`text`/`lang` and have access to
  // `this.parser` for re-parsing inline tokens. We register overrides via
  // `marked.use({ renderer })` once at module scope — Svelte HMR will
  // re-run the script but `marked.use` is idempotent for our purposes.

  /** Map a fenced lang hint to an hljs language id, or null if unknown. */
  function resolveLang(lang: string | undefined | null): string | null {
    if (!lang) return null;
    // Trim any extra info-string content (e.g. ```js title=foo).
    const id = lang.trim().split(/\s+/u)[0]?.toLowerCase() ?? '';
    if (!id) return null;
    return hljs.getLanguage(id) ? id : null;
  }

  /** GitHub-style slug: lowercase, drop punctuation, spaces → dashes. */
  function slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/gu, '-')
      .replace(/-+/gu, '-');
  }

  /** Pulled out so test/inspection is easier; pure escape for hljs fallback. */
  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function encodeRendererSource(source: string): string {
    return escapeHtml(encodeURIComponent(source));
  }

  function decodeRendererSource(source: string): string {
    try {
      return decodeURIComponent(source);
    } catch {
      return source;
    }
  }

  function rendererPlaceholder(kind: 'mermaid' | 'plotly', source: string): string {
    const label = kind === 'mermaid' ? 'Rendering diagram...' : 'Rendering chart...';
    return `<div class="md-renderer-host md-renderer-host--${kind}" data-md-renderer="${kind}" data-source="${encodeRendererSource(
      source
    )}">${label}</div>`;
  }

  const CALLOUT_RE = /^\s*\[!(NOTE|WARNING|CAUTION|TIP|IMPORTANT)\]\s*(.*)$/u;
  const CALLOUT_LABELS: Record<string, string> = {
    NOTE: 'Note',
    WARNING: 'Warning',
    CAUTION: 'Caution',
    TIP: 'Tip',
    IMPORTANT: 'Important'
  };

  // SVG chain-link icon used for anchor handles. Inlined so we don't pay a
  // second HTTP round-trip for one icon, and so the renderer is fully self
  // contained.
  const ANCHOR_ICON =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

  marked.use({
    renderer: {
      // Highlight fenced blocks. We always emit a <pre><code> pair so the
      // copy-button effect below can find the wrapper unchanged. The class
      // `hljs` opts the inner <code> into the github-dark stylesheet's
      // `pre code.hljs` rules; `language-X` is the canonical hljs class.
      code(this: unknown, { text, lang }: Tokens.Code): string {
        const info = lang?.trim().split(/\s+/u)[0]?.toLowerCase() ?? '';
        if (info === 'mermaid' || info === 'plotly') {
          return rendererPlaceholder(info, text);
        }

        const id = resolveLang(lang);
        if (id) {
          try {
            const { value } = hljs.highlight(text, { language: id, ignoreIllegals: true });
            return `<pre data-lang="${id}"><code class="hljs language-${id}">${value}</code></pre>`;
          } catch {
            // Fall through to no-highlight on bad input.
          }
        }
        return `<pre><code class="hljs">${escapeHtml(text)}</code></pre>`;
      },

      // h1/h2/h3 get IDs + an anchor handle. Deeper levels stay as plain
      // headings (matches the spec). We render inline tokens through the
      // parser so any inline markup (code, em, links) keeps working.
      heading(
        this: { parser: { parseInline: (t: Tokens.Generic[]) => string } },
        { tokens, depth }: Tokens.Heading
      ): string {
        const inner = this.parser.parseInline(tokens as Tokens.Generic[]);
        if (depth > 3) {
          return `<h${depth}>${inner}</h${depth}>\n`;
        }
        // Strip HTML for the slug source — we only want the visible text.
        const plain = inner.replace(/<[^>]+>/gu, '');
        const slug = slugify(plain);
        const anchor = `<a class="md-anchor" href="#${slug}" data-anchor="${slug}" aria-label="Copy link to section">${ANCHOR_ICON}</a>`;
        return `<h${depth} id="${slug}" class="md-heading">${anchor}<span>${inner}</span></h${depth}>\n`;
      },

      // Detect admonition syntax on the first inline text token. If matched,
      // render as a callout container; otherwise fall back to a plain
      // blockquote (handled by CSS — left cyan border, italic, muted).
      blockquote(
        this: { parser: { parse: (t: Tokens.Generic[]) => string } },
        { tokens }: Tokens.Blockquote
      ): string {
        const first = tokens?.[0] as Tokens.Generic | undefined;
        const firstInline = (first?.tokens?.[0] as Tokens.Generic | undefined) ?? undefined;
        const candidate =
          (firstInline?.type === 'text' &&
            typeof firstInline.text === 'string' &&
            firstInline.text) ||
          '';
        const match = candidate.match(CALLOUT_RE);
        if (match && first && Array.isArray(first.tokens)) {
          const kind = match[1].toUpperCase();
          const remainder = match[2] ?? '';
          // Mutate the first inline text token to strip the `[!TYPE]` prefix.
          // We clone so we don't trash marked's token cache.
          const cloned = { ...firstInline, text: remainder, raw: remainder };
          const innerFirst = { ...first, tokens: [cloned, ...first.tokens.slice(1)] };
          const newTokens = [innerFirst, ...tokens.slice(1)];
          const body = this.parser.parse(newTokens as Tokens.Generic[]);
          const label = CALLOUT_LABELS[kind] ?? kind;
          return `<div class="md-callout md-callout--${kind.toLowerCase()}"><div class="md-callout__head">${label}</div><div class="md-callout__body">${body}</div></div>\n`;
        }
        const body = this.parser.parse(tokens as Tokens.Generic[]);
        return `<blockquote>\n${body}</blockquote>\n`;
      }
    }
  });

  const html = $derived.by((): string => {
    if (!markdown) return '';
    const raw = marked.parse(markdown) as string;
    // DOMPurify default `html` profile keeps `class`/`id`/`href` attrs and
    // common block elements. ADD_ATTR preserves renderer placeholders.
    return DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['data-md-renderer', 'data-source']
    });
  });

  let wrapperEl = $state<HTMLDivElement | null>(null);
  let mountedRenderers: ReturnType<typeof mount>[] = [];

  const MATH_RE = /(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$|(?<!\\)\$([^$\n]+?)(?<!\\)\$/gu;

  function clearMountedRenderers() {
    const current = mountedRenderers;
    mountedRenderers = [];
    for (const instance of current) {
      void unmount(instance);
    }
  }

  function shouldScanMathNode(node: Node): boolean {
    const text = node.textContent ?? '';
    if (!text.includes('$')) return false;
    const parent = node.parentElement;
    if (!parent) return false;
    return !parent.closest('pre, code, kbd, samp, .md-renderer-host, .md-math-placeholder, .katex');
  }

  function replaceMathTextNode(node: Text) {
    const text = node.nodeValue ?? '';
    MATH_RE.lastIndex = 0;
    const matches = [...text.matchAll(MATH_RE)];
    if (matches.length === 0) return;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of matches) {
      const index = match.index ?? 0;
      if (index > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, index)));
      }

      const display = typeof match[1] === 'string';
      const source = (display ? match[1] : (match[2] ?? '')).trim();
      const placeholder = document.createElement('span');
      placeholder.className = display
        ? 'md-renderer-host md-math-placeholder md-math-placeholder--display'
        : 'md-renderer-host md-math-placeholder';
      placeholder.dataset.mdRenderer = 'math';
      placeholder.dataset.source = encodeURIComponent(source);
      if (display) placeholder.dataset.display = 'true';
      placeholder.textContent = source;
      fragment.appendChild(placeholder);
      cursor = index + match[0].length;
    }

    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }
    node.parentNode?.replaceChild(fragment, node);
  }

  function applyMathPlaceholders(root: HTMLElement) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return shouldScanMathNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes: Text[] = [];
    let node = walker.nextNode();
    while (node) {
      nodes.push(node as Text);
      node = walker.nextNode();
    }
    nodes.forEach(replaceMathTextNode);
  }

  function mountRendererPlaceholders(root: HTMLElement) {
    const placeholders = root.querySelectorAll<HTMLElement>('[data-md-renderer]');
    placeholders.forEach((target) => {
      if (target.dataset.mounted === '1') return;

      const kind = target.dataset.mdRenderer;
      const source = decodeRendererSource(target.dataset.source ?? '');
      target.dataset.mounted = '1';
      target.textContent = '';

      if (kind === 'mermaid') {
        mountedRenderers.push(mount(Mermaid, { target, props: { source } }));
      } else if (kind === 'plotly') {
        mountedRenderers.push(mount(Plotly, { target, props: { source } }));
      } else if (kind === 'math') {
        mountedRenderers.push(
          mount(MathRenderer, {
            target,
            props: { source, display: target.dataset.display === 'true' }
          })
        );
      }
    });
  }

  // Walk the rendered DOM after each html update and wrap any <pre> blocks
  // that don't yet have a copy button. We deliberately don't re-render — we
  // mutate the DOM directly because Svelte's {@html} owns the children but
  // doesn't track them for diff purposes.
  $effect(() => {
    // Touch `html` to re-run when content changes (incl. streaming chunks).
    void html;
    if (!wrapperEl) {
      clearMountedRenderers();
      return;
    }

    clearMountedRenderers();
    applyMathPlaceholders(wrapperEl);
    mountRendererPlaceholders(wrapperEl);

    const pres = wrapperEl.querySelectorAll('pre');
    pres.forEach((pre) => {
      if ((pre as HTMLElement).dataset.copyAttached === '1') return;
      (pre as HTMLElement).dataset.copyAttached = '1';
      (pre as HTMLElement).classList.add('group');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.setAttribute('aria-label', 'Copy code');
      btn.setAttribute('data-copy-btn', '1');
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span data-copy-label>copy</span>';
      pre.appendChild(btn);
    });

    return () => {
      clearMountedRenderers();
    };
  });

  async function copyAnchor(slug: string) {
    // We prefer the in-app URL fragment so a paste inside the desktop app
    // still resolves; the leading `#` keeps it portable when pasted into
    // markdown editors or chat. We don't bake `location.origin` in — the
    // Tauri webview origin is `tauri://localhost` which isn't useful.
    try {
      await navigator.clipboard.writeText(`#${slug}`);
      toasts.show('Anchor copied', 'success');
    } catch (err) {
      toasts.show(`Copy failed: ${(err as Error).message}`, 'error');
    }
  }

  async function onWrapperClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Anchor handle on a heading → copy `#slug` and prevent default so we
    // don't trigger a hash navigation that would scroll the surrounding
    // panel (chat scroll containers don't expect it).
    const anchor = target.closest<HTMLAnchorElement>('.md-anchor');
    if (anchor) {
      e.preventDefault();
      const slug = anchor.dataset.anchor ?? anchor.getAttribute('href')?.replace(/^#/u, '') ?? '';
      if (slug) await copyAnchor(slug);
      return;
    }

    // Copy button on a <pre>.
    const btn = target.closest<HTMLButtonElement>('[data-copy-btn="1"]');
    if (!btn) return;
    const pre = btn.closest('pre');
    if (!pre) return;
    // Prefer the inner <code> if present (avoids trailing button text).
    const codeEl = pre.querySelector('code');
    const text = (codeEl?.textContent ?? pre.textContent ?? '').replace(/\s*copy\s*$/u, '');
    try {
      await navigator.clipboard.writeText(text);
      const label = btn.querySelector<HTMLElement>('[data-copy-label]');
      if (label) {
        const prev = label.textContent ?? 'copy';
        label.textContent = 'copied!';
        btn.classList.add('copy-btn--copied');
        setTimeout(() => {
          // Guard against re-renders that may have replaced the node.
          if (label.isConnected) {
            label.textContent = prev;
            btn.classList.remove('copy-btn--copied');
          }
        }, 1500);
      }
    } catch (err) {
      toasts.show(`Copy failed: ${(err as Error).message}`, 'error');
    }
  }
</script>

<div class="markdown" bind:this={wrapperEl} onclick={onWrapperClick} role="presentation">
  {@html html}
</div>

<style>
  .markdown {
    color: inherit;
    line-height: 1.55;
    word-wrap: break-word;
  }

  .markdown :global(h1),
  .markdown :global(h2),
  .markdown :global(h3),
  .markdown :global(h4),
  .markdown :global(h5),
  .markdown :global(h6) {
    color: #e5e7eb;
  }
  .markdown :global(h1) {
    font-size: 1.5em;
    font-weight: 700;
    margin: 0.6em 0 0.4em;
  }
  .markdown :global(h2) {
    font-size: 1.25em;
    font-weight: 600;
    margin: 0.55em 0 0.35em;
  }
  .markdown :global(h3) {
    font-size: 1.1em;
    font-weight: 600;
    margin: 0.5em 0 0.3em;
  }
  .markdown :global(h4),
  .markdown :global(h5),
  .markdown :global(h6) {
    font-size: 1em;
    font-weight: 600;
    margin: 0.5em 0 0.3em;
  }

  /* Headings rendered by our override carry .md-heading and host the
     anchor handle to their left. Padding leaves room for the icon so the
     heading text doesn't shift on hover. */
  .markdown :global(h1.md-heading),
  .markdown :global(h2.md-heading),
  .markdown :global(h3.md-heading) {
    position: relative;
    padding-left: 1.4em;
    scroll-margin-top: 12px;
  }
  .markdown :global(.md-anchor) {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.2em;
    height: 1.2em;
    color: #4ca7e6;
    opacity: 0;
    text-decoration: none;
    transition:
      opacity 120ms ease,
      color 120ms ease;
  }
  .markdown :global(h1.md-heading:hover .md-anchor),
  .markdown :global(h2.md-heading:hover .md-anchor),
  .markdown :global(h3.md-heading:hover .md-anchor),
  .markdown :global(.md-anchor:focus-visible) {
    opacity: 1;
  }
  .markdown :global(.md-anchor:hover) {
    color: #fbbf24;
  }

  .markdown :global(p) {
    margin: 0.5em 0;
  }

  .markdown :global(ul),
  .markdown :global(ol) {
    margin: 0.5em 0;
    padding-left: 1.5em;
  }
  .markdown :global(ul) {
    list-style: disc;
  }
  .markdown :global(ol) {
    list-style: decimal;
  }
  .markdown :global(li) {
    margin: 0.25em 0;
  }

  .markdown :global(a) {
    color: #4ca7e6;
    text-decoration: none;
  }
  .markdown :global(a:hover) {
    text-decoration: underline;
  }
  /* The anchor handle is itself an <a> but should not pick up the underline
     hover from the rule above. */
  .markdown :global(.md-anchor:hover) {
    text-decoration: none;
  }

  .markdown :global(code) {
    font-family: 'SF Mono', Menlo, monospace;
    font-size: 0.9em;
    background: rgba(76, 167, 230, 0.12);
    color: #e5e7eb;
    padding: 0.1em 0.3em;
    border-radius: 4px;
  }

  .markdown :global(pre) {
    margin: 0.75em 0;
    overflow-x: auto;
    border-radius: 6px;
    background: #0a0f1e;
    border: 1px solid #1f2937;
    position: relative;
  }
  .markdown :global(pre code) {
    display: block;
    padding: 1em;
    background: transparent;
    border-radius: 0;
    font-size: 0.85em;
    line-height: 1.5;
    color: #e5e7eb;
  }
  /* highlight.js's github-dark sheet sets its own background on
     `pre code.hljs`; override so our existing wrapper color wins. */
  .markdown :global(pre code.hljs) {
    background: transparent;
    padding: 1em;
  }

  /* Copy button — positioned top-right of each <pre>, visible on hover. */
  .markdown :global(pre .copy-btn) {
    position: absolute;
    top: 6px;
    right: 6px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    border-radius: 4px;
    border: 1px solid rgba(76, 167, 230, 0.25);
    background: rgba(76, 167, 230, 0.08);
    color: #4ca7e6;
    font-family: 'SF Mono', Menlo, monospace;
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition:
      opacity 120ms ease,
      background 120ms ease,
      border-color 120ms ease;
  }
  .markdown :global(pre:hover .copy-btn),
  .markdown :global(pre .copy-btn:focus-visible) {
    opacity: 1;
  }
  .markdown :global(pre .copy-btn:hover) {
    background: rgba(76, 167, 230, 0.18);
    border-color: rgba(76, 167, 230, 0.5);
  }
  .markdown :global(pre .copy-btn.copy-btn--copied) {
    opacity: 1;
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.5);
    background: rgba(251, 191, 36, 0.1);
  }

  .markdown :global(.md-renderer-host--mermaid),
  .markdown :global(.md-renderer-host--plotly) {
    margin: 0.75em 0;
    overflow-x: auto;
    border-radius: 6px;
    border: 1px solid #1f2937;
    background: #0a0f1e;
    padding: 0.75em;
  }
  .markdown :global(.md-renderer-host--mermaid svg) {
    max-width: 100%;
    height: auto;
  }
  .markdown :global(.md-math-placeholder--display) {
    display: block;
    margin: 0.6em 0;
    overflow-x: auto;
  }

  .markdown :global(blockquote) {
    margin: 0.75em 0;
    padding: 0.25em 0.75em;
    border-left: 3px solid #4ca7e6;
    color: #9ca3af;
    font-style: italic;
  }

  /* Callout blocks (rendered by the blockquote renderer when the first
     line matches the [!TYPE] admonition syntax). */
  .markdown :global(.md-callout) {
    margin: 0.9em 0;
    border-radius: 6px;
    border: 1px solid transparent;
    padding: 0.6em 0.9em;
  }
  .markdown :global(.md-callout__head) {
    font-weight: 600;
    font-size: 0.9em;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.35em;
  }
  .markdown :global(.md-callout__body p) {
    margin: 0.25em 0;
  }
  .markdown :global(.md-callout__body p:first-child) {
    margin-top: 0;
  }
  .markdown :global(.md-callout__body p:last-child) {
    margin-bottom: 0;
  }
  .markdown :global(.md-callout--note),
  .markdown :global(.md-callout--tip) {
    background: rgba(76, 167, 230, 0.08);
    border-color: rgba(76, 167, 230, 0.35);
  }
  .markdown :global(.md-callout--note .md-callout__head),
  .markdown :global(.md-callout--tip .md-callout__head) {
    color: #4ca7e6;
  }
  .markdown :global(.md-callout--important) {
    background: rgba(167, 139, 250, 0.08);
    border-color: rgba(167, 139, 250, 0.35);
  }
  .markdown :global(.md-callout--important .md-callout__head) {
    color: #a78bfa;
  }
  .markdown :global(.md-callout--warning) {
    background: rgba(251, 191, 36, 0.08);
    border-color: rgba(251, 191, 36, 0.4);
  }
  .markdown :global(.md-callout--warning .md-callout__head) {
    color: #fbbf24;
  }
  .markdown :global(.md-callout--caution) {
    background: rgba(248, 113, 113, 0.08);
    border-color: rgba(248, 113, 113, 0.4);
  }
  .markdown :global(.md-callout--caution .md-callout__head) {
    color: #f87171;
  }

  /* Tables — GFM is on by default in marked v15 so `| a | b |` will already
     produce <table>/<thead>/<tbody>. These rules give it a dark theme. */
  .markdown :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0.75em 0;
    font-size: 0.9em;
    border: 1px solid #1f2937;
    border-radius: 6px;
    overflow: hidden;
  }
  .markdown :global(thead) {
    background: rgba(76, 167, 230, 0.06);
  }
  .markdown :global(th),
  .markdown :global(td) {
    padding: 0.5em 0.75em;
    text-align: left;
    border-bottom: 1px solid #1f2937;
    vertical-align: top;
  }
  .markdown :global(th) {
    font-weight: 600;
    color: #e5e7eb;
  }
  .markdown :global(tbody tr:last-child td) {
    border-bottom: 0;
  }
  .markdown :global(tbody tr:hover) {
    background: rgba(255, 255, 255, 0.025);
  }

  .markdown :global(hr) {
    margin: 1em 0;
    border: 0;
    border-top: 1px solid #1f2937;
  }

  .markdown :global(strong) {
    font-weight: 600;
  }
  .markdown :global(em) {
    font-style: italic;
  }

  .markdown :global(img) {
    max-width: 100%;
    border-radius: 4px;
  }
</style>
