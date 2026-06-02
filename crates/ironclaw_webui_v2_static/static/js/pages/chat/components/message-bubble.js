import { html } from '../../../lib/html.js';
import { MarkdownRenderer } from './markdown-renderer.js';
import { ToolActivity } from './tool-activity.js';
import { Icon } from '../../../design-system/icons.js';
import {
  copyWorkProduct,
  downloadDocx,
  downloadHtml,
  downloadJson,
  downloadMarkdown,
  downloadPdf
} from '../lib/work-product-export.js';

const ROLE_STYLES = {
  user: 'ml-auto bg-signal/10 text-iron-100 border-signal/25',
  assistant: 'mr-auto bg-iron-800/58 text-iron-100 border-white/10',
  system: 'mx-auto bg-copper/10 text-copper border-copper/20 text-center',
  error: 'mx-auto bg-red-500/10 text-red-200 border-red-400/20 text-center'
};

export function MessageBubble({ message, onRetry }) {
  const {
    role,
    content,
    images,
    attachments,
    generatedImages,
    isOptimistic,
    status,
    error,
    toolCalls
  } = message;
  const isUser = role === 'user';
  const isAssistant = role === 'assistant';

  if (role === 'tool_activity' || (toolCalls && toolCalls.length > 0)) {
    const activity =
      toolCalls && toolCalls.length > 0
        ? {
            id: message.id,
            toolCalls
          }
        : message;
    return html`<${ToolActivity} activity=${activity} />`;
  }

  if (role === 'image') {
    const imgs = generatedImages || [];
    return html`
      <div className="flex">
        <div className="flex flex-wrap gap-2">
          ${imgs.map((img, i) =>
            img.data_url
              ? html`<img
                  key=${i}
                  src=${img.data_url}
                  className="max-h-64 rounded-lg border border-iron-700 object-cover"
                  alt="Generated result"
                />`
              : html`
                  <div
                    key=${i}
                    className="rounded-lg border border-iron-700 bg-iron-900/70 px-4 py-3 text-sm text-iron-200"
                  >
                    <div>Generated image unavailable in history payload</div>
                    ${img.path &&
                    html`<div className="mt-1 font-mono text-xs text-iron-300">${img.path}</div>`}
                  </div>
                `
          )}
        </div>
      </div>
    `;
  }

  return html`
    <div className=${['flex', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
      <div
        className=${[
          'flex min-w-0 max-w-[85%] flex-col gap-1',
          isAssistant ? 'reborn-msg--assistant' : ''
        ].join(' ')}
        data-message-role=${role}
        data-message-content=${content || ''}
      >
        <div
          className=${[
            'rounded-[18px] border px-4 py-3 text-sm leading-6',
            ROLE_STYLES[role] || ROLE_STYLES.assistant,
            isOptimistic ? 'opacity-70' : ''
          ].join(' ')}
        >
          ${role === 'assistant' || role === 'system' || role === 'error'
            ? html`<${MarkdownRenderer} content=${content} />`
            : html`<div className="whitespace-pre-wrap">${content}</div>`}
          ${status === 'error' &&
          html`
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-red-300">
              <span>${error}</span>
              ${onRetry &&
              html`
                <button
                  type="button"
                  onClick=${() => onRetry(message)}
                  className="rounded-md border border-red-300/30 px-2 py-1 text-red-100 hover:bg-red-500/10"
                >
                  Retry
                </button>
              `}
            </div>
          `}
          ${images &&
          images.length > 0 &&
          html`
            <div className="mt-2 flex flex-wrap gap-2">
              ${images.map(
                (src, i) =>
                  html`<img
                    key=${i}
                    src=${src}
                    className="max-h-48 rounded-lg border border-iron-700 object-cover"
                    alt="Message attachment"
                  />`
              )}
            </div>
          `}
          ${attachments &&
          attachments.length > 0 &&
          html`
            <div className="mt-2 flex flex-col gap-1.5">
              ${attachments.map(
                (att, i) => html`
                  <div
                    key=${i}
                    className="flex items-center gap-2 rounded-md border border-iron-700 bg-iron-900/50 px-3 py-2 text-xs"
                  >
                    <${Icon} name="file" className="h-3.5 w-3.5 text-signal" />
                    <span className="truncate">${att.filename || 'attachment'}</span>
                    <span className="ml-auto shrink-0 text-iron-200"
                      >${att.mime_type} ${att.size_label ? ' / ' + att.size_label : ''}</span
                    >
                  </div>
                `
              )}
            </div>
          `}
        </div>
        ${isAssistant && html`<${AssistantActions} content=${content || ''} />`}
      </div>
    </div>
  `;
}

function AssistantActions({ content }) {
  const title = titleFromMarkdown(content) || 'Assistant response';
  return html`
    <div className="flex flex-wrap items-center gap-1.5 px-1 text-[11px] text-iron-300">
      <button
        type="button"
        className=${actionClass()}
        onClick=${() => copyWorkProduct(content)}
        aria-label="Copy Assistant response"
      >
        Copy
      </button>
      <button
        type="button"
        className=${actionClass('primary')}
        onClick=${() => saveToWork(title, content)}
        aria-label="Save Assistant response to Work"
      >
        Save
      </button>
      <button
        type="button"
        className=${actionClass()}
        onClick=${() => downloadMarkdown(content)}
        aria-label="Export Assistant response as Markdown"
      >
        MD
      </button>
      <button
        type="button"
        className=${actionClass()}
        onClick=${() => downloadHtml(content)}
        aria-label="Export Assistant response as HTML"
      >
        HTML
      </button>
      <button
        type="button"
        className=${actionClass()}
        onClick=${() => downloadPdf(content)}
        aria-label="Export Assistant response as PDF"
      >
        PDF
      </button>
      <button
        type="button"
        className=${actionClass()}
        onClick=${() => downloadDocx(content)}
        aria-label="Export Assistant response as DOCX"
      >
        DOCX
      </button>
      <button
        type="button"
        className=${actionClass()}
        onClick=${() => downloadJson({ role: 'assistant', content })}
        aria-label="Export Assistant response as JSON"
      >
        JSON
      </button>
      <button
        type="button"
        className=${actionClass()}
        onClick=${() => exportThread('markdown')}
        aria-label="Export IronClaw chat thread as Markdown"
      >
        Thread MD
      </button>
      <button
        type="button"
        className=${actionClass()}
        onClick=${() => exportThread('json')}
        aria-label="Export IronClaw chat thread as JSON"
      >
        Thread JSON
      </button>
    </div>
  `;
}

function actionClass(tone = 'default') {
  return [
    'rounded-md border px-2 py-1 font-semibold transition',
    tone === 'primary'
      ? 'border-signal/40 bg-signal/10 text-signal hover:bg-signal/15'
      : 'border-white/10 bg-white/[0.035] text-iron-200 hover:border-signal/35 hover:text-white'
  ].join(' ');
}

async function copyText(content) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function saveToWork(title, content) {
  const key = 'ironclaw-static-work-products';
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  existing.push({
    id: `work-${Date.now()}`,
    title,
    content,
    content_format: 'markdown',
    created_at: new Date().toISOString()
  });
  localStorage.setItem(key, JSON.stringify(existing));
}

function exportThread(format) {
  const messages = Array.from(document.querySelectorAll('[data-message-role]')).map((node) => ({
    role: node.getAttribute('data-message-role') || 'assistant',
    content: node.getAttribute('data-message-content') || ''
  }));
  if (format === 'json') {
    exportContent(
      'ironclaw-chat-thread.json',
      'application/json;charset=utf-8',
      JSON.stringify({ thread: { title: document.title || 'IronClaw chat' }, messages }, null, 2)
    );
    return;
  }
  const markdown = messages
    .map((message) => `## ${capitalize(message.role)}\n\n${message.content}`)
    .join('\n\n');
  exportContent('ironclaw-chat-thread.md', 'text/markdown;charset=utf-8', markdown);
}

function exportContent(filename, type, content) {
  const blob =
    content instanceof Uint8Array ? new Blob([content], { type }) : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function titleFromMarkdown(markdown) {
  const line = String(markdown || '')
    .split(/\r?\n/)
    .find((candidate) => candidate.trim());
  return (line || 'Assistant response').replace(/^#+\s*/, '').trim();
}

function markdownToHtml(title, markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const body = [];
  let inList = false;
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:-]+\|/.test(lines[i + 1] || '')) {
      if (inList) {
        body.push('</ul>');
        inList = false;
      }
      body.push('<table>');
      body.push(tableRow(line, 'th'));
      i++;
      inTable = true;
      continue;
    }
    if (inTable && /^\s*\|.*\|\s*$/.test(line)) {
      body.push(tableRow(line, 'td'));
      continue;
    }
    if (inTable) {
      body.push('</table>');
      inTable = false;
    }
    if (/^#\s+/.test(line)) body.push(`<h1>${escapeHtml(line.replace(/^#\s+/, ''))}</h1>`);
    else if (/^##\s+/.test(line)) body.push(`<h2>${escapeHtml(line.replace(/^##\s+/, ''))}</h2>`);
    else if (/^\s*-\s+/.test(line)) {
      if (!inList) {
        body.push('<ul>');
        inList = true;
      }
      body.push(`<li>${escapeHtml(line.replace(/^\s*-\s+/, ''))}</li>`);
    } else if (line.trim()) {
      if (inList) {
        body.push('</ul>');
        inList = false;
      }
      body.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  if (inList) body.push('</ul>');
  if (inTable) body.push('</table>');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${body.join('\n')}</body></html>`;
}

function tableRow(line, cellTag) {
  const cells = line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => `<${cellTag}>${escapeHtml(cell.trim())}</${cellTag}>`)
    .join('');
  return `<tr>${cells}</tr>`;
}

function markdownToPdf(title, markdown) {
  const lines = [title.toUpperCase(), ...plainLines(markdown)];
  const pageChunks = [];
  for (let i = 0; i < lines.length; i += 36) pageChunks.push(lines.slice(i, i + 36));
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  const pageObjectNumbers = [];
  for (const chunk of pageChunks) {
    const pageObjectNumber = objects.length + 1;
    const contentObjectNumber = pageObjectNumber + 1;
    const text = chunk
      .map((line, index) => `BT /F1 12 Tf 72 ${740 - index * 18} Td (${escapePdf(line)}) Tj ET`)
      .join('\n');
    pageObjectNumbers.push(pageObjectNumber);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    );
    objects.push(`<< /Length ${text.length} >> stream\n${text}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers
    .map((number) => `${number} 0 R`)
    .join(' ')}] /Count ${pageObjectNumbers.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer << /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function markdownToDocx(title, markdown) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document><w:body>${[
    title,
    ...plainLines(markdown)
  ]
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeHtml(line)}</w:t></w:r></w:p>`)
    .join('')}</w:body></w:document>`;
  return new TextEncoder().encode(`PK\nword/document.xml\n${xml}`);
}

function plainLines(markdown) {
  return String(markdown || '')
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^#+\s*/, '')
        .replace(/^\s*-\s*/, '- ')
        .trim()
    )
    .filter(Boolean);
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapePdf(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}
