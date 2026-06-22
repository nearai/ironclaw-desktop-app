import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { useDialogFocus } from '../hooks/useDialogFocus.js';
import {
  useConnectorMessage,
  useConnectorNotionPage,
  useConnectorDriveDoc
} from '../hooks/useWorkbenchConnectors.js';
import { formatInboxWhen, gmailMessageHref } from '../lib/workbench-connectors.js';

// Render the flattened Notion blocks (from normalizeNotionPageContent) as a
// readable, on-design document. Plain text only — no raw HTML, so no XSS surface.
function NotionBlocks({ blocks }) {
  return html`${blocks.map((block, index) => {
    if (block.kind === 'divider') return html`<hr key=${index} className="wb13-notion-divider" />`;
    if (block.kind === 'heading') {
      return html`<div key=${index} className=${`wb13-notion-h wb13-notion-h${block.level || 2}`}>
        ${block.text}
      </div>`;
    }
    if (block.kind === 'bullet')
      return html`<div key=${index} className="wb13-notion-li">• ${block.text}</div>`;
    if (block.kind === 'number')
      return html`<div key=${index} className="wb13-notion-li">${block.text}</div>`;
    if (block.kind === 'todo')
      return html`<div key=${index} className="wb13-notion-li">
        ${block.checked ? '☑' : '☐'} ${block.text}
      </div>`;
    if (block.kind === 'quote')
      return html`<blockquote key=${index} className="wb13-notion-quote">
        ${block.text}
      </blockquote>`;
    if (block.kind === 'code')
      return html`<pre key=${index} className="wb13-notion-code">${block.text}</pre>`;
    if (block.kind === 'callout')
      return html`<div key=${index} className="wb13-notion-callout">${block.text}</div>`;
    return html`<p key=${index} className="wb13-reader-para">${block.text}</p>`;
  })}`;
}

// Split a cleaned email body into paragraphs (blank-line separated) so the
// reading panel renders readable blocks instead of one wall of text.
function bodyParagraphs(body) {
  return String(body || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

// Sanitize an email's original HTML for a faithful NATIVE render. Defense in
// depth: (1) DOMPurify strips scripts, event handlers, and dangerous tags while
// keeping layout (tables, images, styles); (2) the result is shown in a
// sandboxed iframe with NO allow-scripts (below), so even a DOMPurify bypass
// cannot execute. Returns '' when there is no HTML part or DOMPurify is absent —
// the panel then falls back to the cleaned plain-text body.
function sanitizeEmailHtml(raw) {
  const value = String(raw || '');
  if (!value || typeof window === 'undefined' || !window.DOMPurify) return '';
  try {
    return window.DOMPurify.sanitize(value, {
      WHOLE_DOCUMENT: true,
      ADD_ATTR: ['target'],
      FORBID_TAGS: [
        'script',
        'iframe',
        'object',
        'embed',
        'form',
        'input',
        'button',
        'textarea',
        'noscript'
      ],
      FORBID_ATTR: ['srcdoc']
    });
  } catch (_) {
    return '';
  }
}

// The reading panel: a v13-styled right-side drawer that shows the FULL email
// for a selected decision/inbox row. The body is fetched live via
// GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID (a READ tool), so it never fabricates
// content; on failure it shows an honest error. Works in light + dark via the
// shared wb13 tokens. `selected` carries the row's `{ messageId, threadId,
// sender, subject }` so the header renders immediately while the body loads.
export function WorkbenchReadingPanel({ selected, onClose, onDraftReply }) {
  const open = Boolean(selected);
  const { panelRef } = useDialogFocus(open);
  const isNotion = selected?.kind === 'notion';
  const isDriveDoc = selected?.kind === 'drivedoc';
  const isDoc = isNotion || isDriveDoc;
  // All three reads are keyed; only the one matching the selected kind is enabled
  // (the others get '' and stay idle), so hook order is stable across kinds.
  const { message, isLoading, isError } = useConnectorMessage(
    isDoc ? '' : selected?.messageId || ''
  );
  const notion = useConnectorNotionPage(isNotion ? selected?.pageId || '' : '');
  const driveDoc = useConnectorDriveDoc(isDriveDoc ? selected?.docId || '' : '');

  if (!open) return null;

  // Notion page / Google Doc: a native in-app read of the document blocks (no
  // Chrome tab). Plain-text blocks, never raw HTML.
  if (isDoc) {
    const sourceLabel = isNotion ? 'Notion' : 'Doc';
    const openLabel = isNotion ? 'Open in Notion' : 'Open in Drive';
    const openTestId = isNotion
      ? 'workbench-reading-panel-open-notion'
      : 'workbench-reading-panel-open-drive';
    const openUrl = isNotion ? selected.pageUrl : selected.docUrl;
    const docState = isNotion ? notion.page : driveDoc.doc;
    const docLoading = isNotion ? notion.isLoading : driveDoc.isLoading;
    const docError = isNotion ? notion.isError : driveDoc.isError;
    const title = selected.title || `${sourceLabel} document`;
    const blocks = docState && docState.ok ? docState.blocks : [];
    const docFailed = docError || (docState && docState.ok === false);
    return html`
      <div>
        <button
          type="button"
          className="wb13-scrim"
          aria-label="Close page reading panel"
          onClick=${onClose}
        ></button>
        <aside
          ref=${panelRef}
          tabindex=${-1}
          className="wb13-inspector wb13-reader"
          data-testid="workbench-reading-panel"
          aria-label=${`${sourceLabel} document`}
        >
          <div className="wb13-inspector-head">
            <${Icon} name="file" />
            ${sourceLabel}
            <button type="button" aria-label="Close" onClick=${onClose}>
              <${Icon} name="close" />
            </button>
          </div>
          <div className="wb13-reader-meta">
            <h2 className="wb13-reader-subject" data-testid="workbench-reading-panel-subject">
              ${title}
            </h2>
          </div>
          ${openUrl
            ? html`<div className="wb13-reader-actions">
                <a
                  className="wb13-button is-sm"
                  data-testid=${openTestId}
                  href=${openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <${Icon} name="external" />
                  ${openLabel}
                </a>
              </div>`
            : null}
          <div className="wb13-reader-body" data-testid="workbench-reading-panel-body">
            ${docLoading && !docState
              ? html`<div className="wb13-reader-note">Loading the document…</div>`
              : docFailed
                ? html`<div className="wb13-reader-note is-error">
                    <${Icon} name="flag" />
                    <span>
                      Could not load this document right
                      now.${docState?.error ? ` ${docState.error}` : ''}
                    </span>
                  </div>`
                : blocks.length
                  ? html`<${NotionBlocks} blocks=${blocks} />`
                  : html`<div className="wb13-reader-note">
                      This document has no readable content.
                    </div>`}
          </div>
        </aside>
      </div>
    `;
  }

  const headerSender = message?.sender || selected.sender || 'Unknown sender';
  const headerSubject = message?.subject || selected.subject || '(no subject)';
  const when = formatInboxWhen(message?.timestamp || selected.timestamp || '');
  const gmailHref = gmailMessageHref({
    threadId: message?.threadId || selected.threadId,
    messageId: message?.messageId || selected.messageId
  });
  const paragraphs = message?.ok ? bodyParagraphs(message.body) : [];
  const safeHtml = message?.ok ? sanitizeEmailHtml(message.htmlBody) : '';
  const failed = isError || (message && message.ok === false);
  const draftSource = message?.ok ? message : selected;

  return html`
    <div>
      <button
        type="button"
        className="wb13-scrim"
        aria-label="Close email reading panel"
        onClick=${onClose}
      ></button>
      <aside
        ref=${panelRef}
        tabindex=${-1}
        className="wb13-inspector wb13-reader"
        data-testid="workbench-reading-panel"
        aria-label="Email"
      >
        <div className="wb13-inspector-head">
          <${Icon} name="mail" />
          Email
          <button type="button" aria-label="Close" onClick=${onClose}>
            <${Icon} name="close" />
          </button>
        </div>

        <div className="wb13-reader-meta">
          <h2 className="wb13-reader-subject" data-testid="workbench-reading-panel-subject">
            ${headerSubject}
          </h2>
          <div className="wb13-reader-from">${headerSender}</div>
          ${message?.to ? html`<div className="wb13-reader-to">To ${message.to}</div>` : null}
          ${when ? html`<div className="wb13-reader-when">${when}</div>` : null}
        </div>

        <div className="wb13-reader-actions">
          ${typeof onDraftReply === 'function'
            ? html`<button
                type="button"
                className="wb13-button is-primary is-sm"
                data-testid="workbench-reading-panel-draft"
                onClick=${() => onDraftReply(draftSource)}
              >
                <${Icon} name="mail" />
                Draft reply
              </button>`
            : null}
          ${gmailHref
            ? html`<a
                className="wb13-button is-sm"
                data-testid="workbench-reading-panel-open-gmail"
                href=${gmailHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                <${Icon} name="external" />
                Open in Gmail
              </a>`
            : null}
        </div>

        <div className="wb13-reader-body" data-testid="workbench-reading-panel-body">
          ${isLoading && !message
            ? html`<div className="wb13-reader-note">Loading the full message…</div>`
            : failed
              ? html`<div className="wb13-reader-note is-error">
                  <${Icon} name="flag" />
                  <span>
                    Could not load this message right
                    now.${message?.error ? ` ${message.error}` : ''}
                  </span>
                </div>`
              : safeHtml
                ? html`<iframe
                    className="wb13-reader-frame"
                    title="Email content"
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    srcdoc=${safeHtml}
                  ></iframe>`
                : paragraphs.length
                  ? paragraphs.map(
                      (para, index) =>
                        html`<p key=${index} className="wb13-reader-para">${para}</p>`
                    )
                  : html`<div className="wb13-reader-note">
                      This message has no readable text body.
                    </div>`}
        </div>
      </aside>
    </div>
  `;
}
