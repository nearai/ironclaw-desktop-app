import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { WORKBENCH_CONNECTOR_FAMILIES, formatInboxWhen } from '../lib/workbench-connectors.js';
import { DISMISS_REASONS } from '../lib/workbench-dismissals.js';

// Cold-open: when NO connector is live yet, the Workbench would otherwise be a
// command box stacked over a column of empty sections — exactly the "nothing
// populates" experience. Instead we anticipate (DESIGN.md Law 1): name what the
// Workbench will fill with and offer one calm action to connect. Renders ONLY
// once the connector check has resolved AND nothing is connected — during the
// first load it stays hidden (no flash), and the instant one source goes live
// the readiness strip takes over and this disappears.
export function WorkbenchColdStart({ families, isLoading, onConnect }) {
  if (isLoading) return null;
  if (Array.isArray(families) && families.length) return null;

  return html`
    <section
      className="wb13-coldstart"
      data-testid="workbench-coldstart"
      aria-label="Connect your tools"
    >
      <div className="wb13-coldstart-sources" aria-hidden="true">
        ${WORKBENCH_CONNECTOR_FAMILIES.map(
          (family) => html`
            <span key=${family.id} className="wb13-coldstart-source">
              <${Icon} name=${family.icon} />
            </span>
          `
        )}
      </div>
      <h2 className="wb13-coldstart-title">Your Workbench fills from your tools</h2>
      <p className="wb13-coldstart-copy">
        Connect Gmail, Calendar, Drive, Notion, Slack, and GitHub. The moment they're live, this
        surface gathers what arrived, what's coming up, and what needs a decision — read-only until
        you approve an action.
      </p>
      ${typeof onConnect === 'function'
        ? html`<button
            type="button"
            className="wb13-button is-primary"
            data-testid="workbench-coldstart-connect"
            onClick=${onConnect}
          >
            <${Icon} name="plug" />
            Connect your tools
          </button>`
        : null}
    </section>
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
function DecisionCard({ message, onOpenMessage, onDraftMessage, onDismiss }) {
  const [picking, setPicking] = React.useState(false);
  const when = formatInboxWhen(message.timestamp);
  const meta = [message.sender, when].filter(Boolean).join(' · ');
  const canDismiss = typeof onDismiss === 'function';
  return html`
    <div className="wb13-card wb13-card-readable" data-testid="workbench-decision-card">
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
          ${message.preview ? html`<div className="wb13-card-copy">${message.preview}</div>` : null}
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
        ${canDismiss
          ? html`<button
              type="button"
              className="wb13-button is-ghost is-sm"
              data-testid="workbench-decision-dismiss"
              aria-expanded=${picking}
              title="File this away — and tell IronClaw why, so it learns."
              onClick=${() => setPicking((value) => !value)}
            >
              Not for me
            </button>`
          : null}
      </div>
      ${canDismiss && picking
        ? html`<div className="wb13-card-dismiss" data-testid="workbench-decision-dismiss-reasons">
            <span className="wb13-card-dismiss-label">Why? IronClaw learns from this.</span>
            <div className="wb13-card-dismiss-reasons">
              ${DISMISS_REASONS.map(
                (reason) =>
                  html`<button
                    key=${reason}
                    type="button"
                    className="wb13-button is-sm"
                    onClick=${() => {
                      setPicking(false);
                      onDismiss(message, reason);
                    }}
                  >
                    ${reason}
                  </button>`
              )}
              <button
                type="button"
                className="wb13-button is-ghost is-sm"
                onClick=${() => setPicking(false)}
              >
                Cancel
              </button>
            </div>
          </div>`
        : null}
    </div>
  `;
}

export function WorkbenchDecisions({
  gmailReady,
  messages,
  onOpenMessage,
  onDraftMessage,
  onDismiss
}) {
  if (!gmailReady) return null;
  const unread = (Array.isArray(messages) ? messages : []).filter((message) => message.unread);
  if (!unread.length) return null;

  return html`
    <div className="wb13-section" data-testid="workbench-decisions">
      <div className="wb13-group">
        <div className="wb13-group-title is-hold">
          Needs a decision<span>· ${unread.length}</span>
        </div>
        ${unread.map(
          (message) =>
            html`<${DecisionCard}
              key=${message.id}
              message=${message}
              onOpenMessage=${onOpenMessage}
              onDraftMessage=${onDraftMessage}
              onDismiss=${onDismiss}
            />`
        )}
      </div>
    </div>
  `;
}
