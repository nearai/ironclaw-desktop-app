import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { DecisionCard } from './workbench-arrived.js';
import { SlackReplyCard } from './workbench-slack-replies.js';

// Direction B "Needs a reply" — ONE container folding the owed-reply work the home used to
// stack as two separate sections: unread email decision cards (DecisionCard) + Slack
// awaiting-reply rows (SlackReplyCard). The home passes the SAME real data and the SAME
// gated-write actions (Draft reply opens a reviewable draft; nothing is sent), so behaviour
// and the card testids are preserved — only the section framing is unified into one
// "Needs a reply · N" group. Honest-empty: renders nothing when nothing is owed.
//
// NOTE: built as the reusable building block for the center consolidation; wiring it into
// HomeView (replacing the separate WorkbenchDecisions + WorkbenchSlackReplies-awaiting
// sections) + migrating the section-header specs is the next step.

export function needsReplyCount({ decisionMessages = [], slackAwaiting = [] } = {}) {
  const emails = Array.isArray(decisionMessages) ? decisionMessages.length : 0;
  const slack = Array.isArray(slackAwaiting) ? slackAwaiting.length : 0;
  return emails + slack;
}

export function WorkbenchNeedsReply({
  decisionMessages = [],
  slackAwaiting = [],
  onOpenMessage,
  onDraftMessage,
  onDismissDecision,
  onSlackReply,
  onSlackDismiss
}) {
  const emails = Array.isArray(decisionMessages) ? decisionMessages : [];
  const slack = Array.isArray(slackAwaiting) ? slackAwaiting : [];
  const total = emails.length + slack.length;
  if (!total) return null;
  return html`
    <section
      className="wb13-section wb13-list wb13-needs-reply"
      data-testid="workbench-needs-reply"
      aria-labelledby="wb13-needs-reply-heading"
    >
      <style>
        /* Direction B: ONE bordered container — rows are borderless and divided, not nested
           cards (scoped to .wb13-needs-reply so other card surfaces are untouched). */
        .wb13-needs-reply {
          border: 1px solid var(--wb-line);
          border-radius: 14px;
          overflow: hidden;
          background: var(--wb-surface);
        }
        .wb13-needs-reply > .wb13-section-label {
          margin: 0;
          padding: 12px 16px 8px;
        }
        .wb13-needs-reply > .wb13-card {
          border: 0;
          border-radius: 0;
          background: none;
          margin-bottom: 0;
        }
        .wb13-needs-reply > .wb13-card:hover {
          border-color: transparent;
        }
        .wb13-needs-reply > .wb13-card + .wb13-card {
          border-top: 1px solid var(--wb-line);
        }
        /* the rounded container clips overflow; keep the meta line from hard-clipping at narrow widths */
        .wb13-needs-reply .wb13-card-status {
          min-width: 0;
        }
        .wb13-needs-reply .wb13-card-when {
          overflow: hidden;
          text-overflow: ellipsis;
        }
      </style>
      <div
        className="wb13-section-label"
        id="wb13-needs-reply-heading"
        role="heading"
        aria-level="2"
      >
        <${Icon} name="mail" /> Needs a reply
        <span className="wb13-section-count">${total}</span>
      </div>
      ${emails.map(
        (message) =>
          html`<${DecisionCard}
            key=${`email:${message.id || message.threadId || message.subject}`}
            message=${message}
            onOpenMessage=${onOpenMessage}
            onDraftMessage=${onDraftMessage}
            onDismiss=${onDismissDecision}
          />`
      )}
      ${slack.map(
        (item) =>
          html`<${SlackReplyCard}
            key=${`slack:${item.id}`}
            item=${item}
            onReply=${onSlackReply}
            onDismiss=${onSlackDismiss}
          />`
      )}
    </section>
  `;
}
