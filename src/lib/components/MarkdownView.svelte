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

  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { toasts } from '$lib/stores/toasts.svelte';

  let { markdown = '' }: { markdown?: string } = $props();

  // `marked.parse` is synchronous when `async: false` (the default in v15).
  // We cast through `string` because the typings allow `Promise<string>`.
  marked.setOptions({ breaks: true, gfm: true, async: false });

  const html = $derived.by((): string => {
    if (!markdown) return '';
    const raw = marked.parse(markdown) as string;
    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  });

  let wrapperEl = $state<HTMLDivElement | null>(null);

  // Walk the rendered DOM after each html update and wrap any <pre> blocks
  // that don't yet have a copy button. We deliberately don't re-render — we
  // mutate the DOM directly because Svelte's {@html} owns the children but
  // doesn't track them for diff purposes.
  $effect(() => {
    // Touch `html` to re-run when content changes (incl. streaming chunks).
    void html;
    if (!wrapperEl) return;
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
  });

  async function onWrapperClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (!target) return;
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

  .markdown :global(h1) {
    font-size: 1.5em;
    font-weight: 700;
    margin: 0.6em 0 0.4em;
    color: #e5e7eb;
  }
  .markdown :global(h2) {
    font-size: 1.25em;
    font-weight: 600;
    margin: 0.55em 0 0.35em;
    color: #e5e7eb;
  }
  .markdown :global(h3) {
    font-size: 1.1em;
    font-weight: 600;
    margin: 0.5em 0 0.3em;
    color: #e5e7eb;
  }
  .markdown :global(h4),
  .markdown :global(h5),
  .markdown :global(h6) {
    font-size: 1em;
    font-weight: 600;
    margin: 0.5em 0 0.3em;
    color: #e5e7eb;
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
    color: #00d4ff;
    text-decoration: none;
  }
  .markdown :global(a:hover) {
    text-decoration: underline;
  }

  .markdown :global(code) {
    font-family: 'SF Mono', Menlo, monospace;
    font-size: 0.9em;
    background: rgba(0, 212, 255, 0.12);
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
    border: 1px solid rgba(0, 212, 255, 0.25);
    background: rgba(0, 212, 255, 0.08);
    color: #00d4ff;
    font-family: 'SF Mono', Menlo, monospace;
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease, background 120ms ease, border-color 120ms ease;
  }
  .markdown :global(pre:hover .copy-btn),
  .markdown :global(pre .copy-btn:focus-visible) {
    opacity: 1;
  }
  .markdown :global(pre .copy-btn:hover) {
    background: rgba(0, 212, 255, 0.18);
    border-color: rgba(0, 212, 255, 0.5);
  }
  .markdown :global(pre .copy-btn.copy-btn--copied) {
    opacity: 1;
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.5);
    background: rgba(251, 191, 36, 0.1);
  }

  .markdown :global(blockquote) {
    margin: 0.75em 0;
    padding: 0.25em 0.75em;
    border-left: 3px solid #00d4ff;
    color: #9ca3af;
    font-style: italic;
  }

  .markdown :global(table) {
    border-collapse: collapse;
    margin: 0.75em 0;
    font-size: 0.9em;
  }
  .markdown :global(th),
  .markdown :global(td) {
    border: 1px solid #1f2937;
    padding: 0.4em 0.7em;
    text-align: left;
  }
  .markdown :global(th) {
    background: rgba(0, 212, 255, 0.06);
    font-weight: 600;
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
