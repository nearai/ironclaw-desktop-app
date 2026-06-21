import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';
import {
  formatInboxWhen,
  gmailMessageHref,
  unreadInboxCount
} from '../lib/workbench-connectors.js';

// Source-readiness strip: which apps are live "via Composio". Renders nothing
// until at least one real ACTIVE account is reported (honest: no empty chrome).
function SourceReadinessStrip({ families }) {
  if (!families.length) return null;
  return html`
    <div className="wb13-sources-ready" data-testid="workbench-sources-ready">
      ${families.map(
        (family) => html`
          <span key=${family.id} className="wb13-source-ready">
            <${Icon} name=${family.icon} />
            <span className="wb13-source-ready-name">${family.label}</span>
            <span className="wb13-source-ready-via">Ready · via ${family.via}</span>
          </span>
        `
      )}
    </div>
  `;
}

function openMessage(onOpenMessage, message) {
  if (typeof onOpenMessage !== 'function') return;
  onOpenMessage(message);
}

// "Needs a decision" — the v13 decision-card surface, fed by the user's REAL
// unread Composio inbox. Each unread email becomes a decision card: an amber
// status icon, the subject as the decision, the sender + date as the meta line.
// Clicking the card body opens the reading panel (fetches the FULL message via
// a READ tool). "Draft reply" opens the gated in-app draft modal and can only
// create a reviewable Gmail draft; it never sends. Renders ONLY when Gmail is a
// live ACTIVE account AND there is unread mail; on empty/error it stays hidden
// (never a fabricated card).
export function WorkbenchDecisions({ gmailReady, messages, onOpenMessage, onDraftMessage }) {
  if (!gmailReady) return null;
  const unread = (Array.isArray(messages) ? messages : []).filter((message) => message.unread);
  if (!unread.length) return null;

  return html`
    <div className="wb13-section" data-testid="workbench-decisions">
      <div className="wb13-group">
        <div className="wb13-group-title is-hold">
          Needs a decision<span>· ${unread.length}</span>
        </div>
        ${unread.map((message) => {
          const when = formatInboxWhen(message.timestamp);
          const meta = [message.sender, when].filter(Boolean).join(' · ');
          return html`
            <div key=${message.id} className="wb13-card wb13-card-readable">
              <button
                type="button"
                className="wb13-card-open"
                data-testid="workbench-decision-open"
                aria-label=${`Open email: ${message.subject}`}
                onClick=${() => openMessage(onOpenMessage, message)}
              >
                <div className="wb13-action-icon is-hold">
                  <${Icon} name="mail" />
                </div>
                <div className="wb13-card-main">
                  <div className="wb13-card-title">${message.subject}</div>
                  ${message.preview
                    ? html`<div className="wb13-card-copy">${message.preview}</div>`
                    : null}
                  ${meta
                    ? html`<div className="wb13-card-trigger">
                        <${Icon} name="mail" />
                        <span>${meta}</span>
                      </div>`
                    : null}
                </div>
              </button>
              <div className="wb13-card-actions">
                ${typeof onDraftMessage === 'function'
                  ? html`<button
                      type="button"
                      className="wb13-button is-primary is-sm"
                      data-testid="workbench-decision-draft"
                      title="Opens a reviewable Gmail draft. Nothing is sent."
                      onClick=${() => onDraftMessage(message)}
                    >
                      Draft reply
                    </button>`
                  : null}
              </div>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

function InboxRow({ message, onPick }) {
  const gmailHref = gmailMessageHref(message);
  return html`
    <div className=${cn('wb13-arrived-row', message.unread && 'is-unread')}>
      <button
        type="button"
        className="wb13-arrived-item"
        data-testid="workbench-arrived-open"
        aria-label=${`Open email: ${message.subject}`}
        onClick=${() => onPick(message)}
      >
        <span className="wb13-arrived-dot" aria-hidden="true"></span>
        <span className="wb13-arrived-body">
          <span className="wb13-arrived-line">
            <span className="wb13-arrived-sender">${message.sender}</span>
            ${message.unread ? html`<span className="wb13-arrived-flag">Unread</span>` : null}
          </span>
          <span className="wb13-arrived-subject">${message.subject}</span>
        </span>
      </button>
      ${gmailHref
        ? html`<a
            className="wb13-arrived-gmail"
            data-testid="workbench-arrived-gmail"
            href=${gmailHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label=${`Open in Gmail: ${message.subject}`}
            title="Open in Gmail"
          >
            <${Icon} name="external" />
          </a>`
        : null}
    </div>
  `;
}

// "Arrived / What needs me" — the v13 inbox-triage surface, now fed by the
// user's REAL Composio inbox. It renders ONLY when Gmail is a live ACTIVE
// account. On error or empty it shows an honest line and never fabricates mail.
export function WorkbenchArrived({ gmailReady, messages, isLoading, isError, onOpenMessage }) {
  if (!gmailReady) return null;

  const onPick = (message) => openMessage(onOpenMessage, message);
  const unread = unreadInboxCount(messages);
  const headingCount = messages.length
    ? unread
      ? `${unread} unread · ${messages.length} recent`
      : `${messages.length} recent`
    : '';

  let bodyState = 'ready';
  if (isError) bodyState = 'error';
  else if (isLoading && !messages.length) bodyState = 'loading';
  else if (!messages.length) bodyState = 'empty';

  return html`
    <section className="wb13-arrived" data-testid="workbench-arrived" aria-label="Arrived">
      <div className="wb13-arrived-head">
        <${Icon} name="mail" />
        <span className="wb13-arrived-title">Arrived</span>
        ${headingCount ? html`<span className="wb13-arrived-count">${headingCount}</span>` : null}
      </div>
      ${bodyState === 'ready'
        ? html`<div className="wb13-arrived-list" data-testid="workbench-arrived-list">
            ${messages.map(
              (message) =>
                html`<${InboxRow} key=${message.id} message=${message} onPick=${onPick} />`
            )}
          </div>`
        : null}
      ${bodyState === 'loading'
        ? html`<div className="wb13-arrived-note">Reading your inbox…</div>`
        : null}
      ${bodyState === 'empty'
        ? html`<div className="wb13-arrived-note">
            Inbox is clear. Nothing waiting for a reply.
          </div>`
        : null}
      ${bodyState === 'error'
        ? html`<div className="wb13-arrived-note">
            Could not read the inbox right now. Connected sources are unaffected.
          </div>`
        : null}
    </section>
  `;
}

function EventRow({ event }) {
  const meta = [event.when, event.location].filter(Boolean).join(' · ');
  const inner = html`
    <span className="wb13-arrived-dot" aria-hidden="true"></span>
    <span className="wb13-arrived-body">
      <span className="wb13-arrived-line">
        <span className="wb13-arrived-sender">${event.title}</span>
      </span>
      ${meta ? html`<span className="wb13-arrived-subject">${meta}</span>` : null}
    </span>
  `;
  if (event.link) {
    return html`
      <a className="wb13-arrived-item" href=${event.link} target="_blank" rel="noopener noreferrer">
        ${inner}
      </a>
    `;
  }
  return html`<div className="wb13-arrived-item is-static">${inner}</div>`;
}

// "Upcoming" — a compact, read-only calendar card fed by the user's REAL
// Composio Google Calendar. It renders ONLY when Calendar is a live ACTIVE
// account AND there is at least one upcoming event; on empty/error it stays
// hidden (the Arrived inbox already carries the "what needs me" empty state, so
// an empty calendar adds no signal). It never fabricates an event.
export function WorkbenchUpcoming({ calendarReady, events, isError }) {
  if (!calendarReady) return null;
  if (isError) return null;
  const rows = Array.isArray(events) ? events : [];
  if (!rows.length) return null;

  return html`
    <section
      className="wb13-arrived wb13-upcoming"
      data-testid="workbench-upcoming"
      aria-label="Upcoming"
    >
      <div className="wb13-arrived-head">
        <${Icon} name="calendar" />
        <span className="wb13-arrived-title">Upcoming</span>
        <span className="wb13-arrived-count">${`${rows.length} next`}</span>
      </div>
      <div className="wb13-arrived-list" data-testid="workbench-upcoming-list">
        ${rows.map((event) => html`<${EventRow} key=${event.id} event=${event} />`)}
      </div>
    </section>
  `;
}

export { SourceReadinessStrip };
