import { React, html } from '../../../lib/html.js';
import { renderMarkdown } from '../../../lib/markdown.js';
import { toast } from '../../../lib/toast.js';

const COLLAPSE_PX = 360;
const HIGHLIGHT_VENDOR_PATH = 'vendor/highlight.min.js';

let highlightLoadPromise = null;

function resolveStaticAsset(path) {
  const resolver = window.__IRONCLAW_STATIC_ASSET__;
  if (typeof resolver === 'function') return resolver(path);

  const hostedV2 =
    window.location?.pathname === '/v2' || window.location?.pathname?.startsWith('/v2/');
  return hostedV2 ? `/v2/${path}` : `/${path}`;
}

function loadScript(path) {
  const loader = window.__IRONCLAW_LOAD_SCRIPT__;
  if (typeof loader === 'function') return loader(path);

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = resolveStaticAsset(path);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${path}`));
    document.body.appendChild(script);
  });
}

export function ensureHighlightJs() {
  if (window.hljs) return Promise.resolve(window.hljs);
  if (!highlightLoadPromise) {
    highlightLoadPromise = loadScript(HIGHLIGHT_VENDOR_PATH)
      .then(() => window.hljs || null)
      .catch((error) => {
        console.warn('[ironclaw] syntax highlighter failed to load', error);
        highlightLoadPromise = null;
        return null;
      });
  }
  return highlightLoadPromise;
}

function highlightCodeElement(codeEl) {
  if (!codeEl || codeEl.dataset.icHighlighted === '1') return;
  if (window.hljs) {
    try {
      window.hljs.highlightElement(codeEl);
      codeEl.dataset.icHighlighted = '1';
    } catch {
      // highlight failure is non-fatal
    }
    return;
  }

  ensureHighlightJs().then((hljs) => {
    if (!hljs || !codeEl.isConnected || codeEl.dataset.icHighlighted === '1') return;
    try {
      hljs.highlightElement(codeEl);
      codeEl.dataset.icHighlighted = '1';
    } catch {
      // highlight failure is non-fatal
    }
  });
}

/* Enhance rendered <pre> code blocks in place: syntax highlight, a hover
   toolbar (copy + soft-wrap toggle), and collapse for very tall blocks.
   Runs imperatively because the markdown is injected via innerHTML. */
function enhanceCodeBlocks(root) {
  if (!root) return;
  root.querySelectorAll('pre').forEach((pre) => {
    if (pre.dataset.enhanced === '1') return;
    pre.dataset.enhanced = '1';

    const codeEl = pre.querySelector('code');
    highlightCodeElement(codeEl);

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;top:6px;right:6px;display:flex;gap:4px;opacity:0';
    wrap.addEventListener('mouseenter', () => (bar.style.opacity = '1'));
    wrap.addEventListener('mouseleave', () => (bar.style.opacity = '0'));

    const mkBtn = (label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText =
        'font-family:var(--font-mono,monospace);font-size:11px;border:1px solid var(--v2-panel-border);background:var(--v2-surface);color:var(--v2-text-muted);border-radius:6px;padding:2px 7px;cursor:pointer';
      return b;
    };

    let wrapped = false;
    const wrapBtn = mkBtn('Wrap');
    wrapBtn.addEventListener('click', () => {
      wrapped = !wrapped;
      pre.style.whiteSpace = wrapped ? 'pre-wrap' : '';
      if (codeEl) codeEl.style.whiteSpace = wrapped ? 'pre-wrap' : '';
      wrapBtn.textContent = wrapped ? 'No wrap' : 'Wrap';
    });

    const copyBtn = mkBtn('Copy');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(codeEl ? codeEl.innerText : pre.innerText);
        copyBtn.textContent = 'Copied';
        toast('Code copied', { tone: 'success' });
        setTimeout(() => (copyBtn.textContent = 'Copy'), 1400);
      } catch {
        // clipboard unavailable
      }
    });

    bar.appendChild(wrapBtn);
    bar.appendChild(copyBtn);
    wrap.appendChild(bar);

    if (pre.scrollHeight > COLLAPSE_PX) {
      pre.style.maxHeight = `${COLLAPSE_PX}px`;
      pre.style.overflow = 'hidden';
      let expanded = false;
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.textContent = 'Show more';
      toggle.style.cssText =
        'display:block;width:100%;text-align:center;font-family:var(--font-mono,monospace);font-size:11px;color:var(--v2-accent-text);background:var(--v2-surface-soft);border:0;border-top:1px solid var(--v2-panel-border);padding:5px;cursor:pointer';
      toggle.addEventListener('click', () => {
        expanded = !expanded;
        pre.style.maxHeight = expanded ? 'none' : `${COLLAPSE_PX}px`;
        toggle.textContent = expanded ? 'Show less' : 'Show more';
      });
      wrap.appendChild(toggle);
    }
  });
}

export function MarkdownRenderer({ content, className = '' }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    enhanceCodeBlocks(ref.current);
  }, [content]);

  return html`
    <div
      ref=${ref}
      className=${['markdown-body', className].join(' ')}
      dangerouslySetInnerHTML=${{ __html: renderMarkdown(content) }}
    />
  `;
}
