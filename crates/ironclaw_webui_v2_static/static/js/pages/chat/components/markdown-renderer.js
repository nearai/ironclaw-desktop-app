import { React, html } from '../../../lib/html.js';
import { renderMarkdown } from '../../../lib/markdown.js';
import { toast } from '../../../lib/toast.js';

const COLLAPSE_PX = 360;
const HIGHLIGHT_VENDOR_PATH = 'vendor/highlight.min.js';
const MERMAID_VENDOR_PATH = 'vendor/mermaid.min.js';

let highlightLoadPromise = null;
let mermaidLoadPromise = null;
let mermaidConfigured = false;
let mermaidRenderSeq = 0;

function resolveStaticAsset(path) {
  const resolver = window.__IRONCLAW_STATIC_ASSET__;
  if (typeof resolver === 'function') return resolver(path);

  const hostedV2 =
    window.location?.pathname === '/v2' || window.location?.pathname?.startsWith('/v2/');
  return hostedV2 ? `/v2/${path}` : `/${path}`;
}

function loadScript(path, type) {
  const loader = window.__IRONCLAW_LOAD_SCRIPT__;
  if (typeof loader === 'function') return loader(path, type);

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = resolveStaticAsset(path);
    if (type) script.type = type;
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

function configureMermaid(mermaid) {
  if (!mermaid || mermaidConfigured) return mermaid;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'dark',
    themeVariables: {
      background: 'transparent',
      primaryColor: '#111827',
      primaryTextColor: '#f8fafc',
      primaryBorderColor: '#3b82f6',
      lineColor: '#8aa0b4',
      textColor: '#f8fafc',
      fontFamily: 'Inter Variable, Inter, sans-serif'
    }
  });
  mermaidConfigured = true;
  return mermaid;
}

export function ensureMermaidJs() {
  if (window.mermaid) return Promise.resolve(configureMermaid(window.mermaid));
  if (!mermaidLoadPromise) {
    mermaidLoadPromise = loadScript(MERMAID_VENDOR_PATH)
      .then(() => (window.mermaid ? configureMermaid(window.mermaid) : null))
      .catch((error) => {
        console.warn('[ironclaw] Mermaid renderer failed to load', error);
        mermaidLoadPromise = null;
        return null;
      });
  }
  return mermaidLoadPromise;
}

export async function renderMermaidDiagram(source) {
  const mermaid = await ensureMermaidJs();
  if (!mermaid) throw new Error('Mermaid renderer is unavailable');
  const id = `ironclaw-mermaid-${Date.now()}-${++mermaidRenderSeq}`;
  const result = await mermaid.render(id, String(source || ''));
  const svg = typeof result === 'string' ? result : result?.svg;
  if (!svg) throw new Error('Mermaid returned an empty diagram');
  if (!window.DOMPurify) throw new Error('Diagram sanitizer is unavailable');
  return window.DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true }
  });
}

export function resetMarkdownRendererTestState() {
  highlightLoadPromise = null;
  mermaidLoadPromise = null;
  mermaidConfigured = false;
  mermaidRenderSeq = 0;
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

function isMermaidCodeBlock(codeEl) {
  const className = String(codeEl?.className || '').toLowerCase();
  return /\blanguage-mermaid\b|\bmermaid\b/.test(className);
}

function enhanceMermaidBlock(pre, codeEl) {
  if (!pre || !codeEl) return;
  const source = codeEl.textContent || '';
  const card = document.createElement('div');
  card.className = 'v2-mermaid-card';
  card.setAttribute('data-md-renderer', 'mermaid');

  const header = document.createElement('div');
  header.className = 'v2-mermaid-card__header';

  const label = document.createElement('span');
  label.textContent = 'Diagram';
  label.className = 'v2-mermaid-card__label';

  const actions = document.createElement('div');
  actions.className = 'v2-mermaid-card__actions';

  const renderButton = document.createElement('button');
  renderButton.type = 'button';
  renderButton.textContent = 'Render diagram';
  renderButton.className = 'v2-mermaid-card__button';

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.textContent = 'Copy source';
  copyButton.className = 'v2-mermaid-card__button';
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(source);
      copyButton.textContent = 'Copied';
      toast('Diagram source copied', { tone: 'success' });
      setTimeout(() => (copyButton.textContent = 'Copy source'), 1400);
    } catch {
      // clipboard unavailable
    }
  });

  actions.appendChild(renderButton);
  actions.appendChild(copyButton);
  header.appendChild(label);
  header.appendChild(actions);

  const output = document.createElement('div');
  output.className = 'v2-mermaid-card__output';
  output.hidden = true;

  const sourceDetails = document.createElement('details');
  sourceDetails.className = 'v2-mermaid-card__source';
  const summary = document.createElement('summary');
  summary.textContent = 'Source';
  sourceDetails.appendChild(summary);

  pre.parentNode.insertBefore(card, pre);
  sourceDetails.appendChild(pre);
  card.appendChild(header);
  card.appendChild(output);
  card.appendChild(sourceDetails);

  renderButton.addEventListener('click', async () => {
    renderButton.disabled = true;
    renderButton.textContent = 'Rendering...';
    try {
      output.innerHTML = await renderMermaidDiagram(source);
      output.hidden = false;
      card.dataset.rendered = '1';
      renderButton.textContent = 'Rendered';
    } catch (error) {
      output.hidden = false;
      output.textContent = `Could not render diagram: ${error?.message || error}`;
      output.classList.add('v2-mermaid-card__output--error');
      renderButton.disabled = false;
      renderButton.textContent = 'Retry render';
    }
  });
}

/* Enhance rendered <pre> code blocks in place: syntax highlight, a hover
   toolbar (copy + soft-wrap toggle), and collapse for very tall blocks.
   Runs imperatively because the markdown is injected via innerHTML. */
export function enhanceRenderedMarkdown(root) {
  if (!root) return;
  root.querySelectorAll('pre').forEach((pre) => {
    const codeEl = pre.querySelector('code');
    if (isMermaidCodeBlock(codeEl)) {
      if (pre.closest('[data-md-renderer="mermaid"]')) return;
      enhanceMermaidBlock(pre, codeEl);
      return;
    }

    if (pre.dataset.enhanced === '1') return;
    pre.dataset.enhanced = '1';

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

  React.useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    enhanceRenderedMarkdown(root);
    queueMicrotask(() => enhanceRenderedMarkdown(root));
    const frame = requestAnimationFrame(() => enhanceRenderedMarkdown(root));
    return () => cancelAnimationFrame(frame);
  }, [content]);

  return html`
    <div
      ref=${ref}
      className=${['markdown-body', className].join(' ')}
      dangerouslySetInnerHTML=${{ __html: renderMarkdown(content) }}
    />
  `;
}
