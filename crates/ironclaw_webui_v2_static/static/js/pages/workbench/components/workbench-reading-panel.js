import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { useDialogFocus } from '../hooks/useDialogFocus.js';
import { useConnectorMessage } from '../hooks/useWorkbenchConnectors.js';
import { formatInboxWhen, gmailMessageHref } from '../lib/workbench-connectors.js';

// Split a cleaned email body into paragraphs (blank-line separated) so the
// reading panel renders readable blocks instead of one wall of text.
function bodyParagraphs(body) {
  return String(body || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
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
  const { message, isLoading, isError } = useConnectorMessage(selected?.messageId || '');

  if (!open) return null;

  const headerSender = message?.sender || selected.sender || 'Unknown sender';
  const headerSubject = message?.subject || selected.subject || '(no subject)';
  const when = formatInboxWhen(message?.timestamp || selected.timestamp || '');
  const gmailHref = gmailMessageHref({
    threadId: message?.threadId || selected.threadId,
    messageId: message?.messageId || selected.messageId
  });
  const paragraphs = message?.ok ? bodyParagraphs(message.body) : [];
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
              : paragraphs.length
                ? paragraphs.map(
                    (para, index) => html`<p key=${index} className="wb13-reader-para">${para}</p>`
                  )
                : html`<div className="wb13-reader-note">
                    This message has no readable text body.
                  </div>`}
        </div>
      </aside>
    </div>
  `;
}
