import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';
import { useDialogFocus } from '../hooks/useDialogFocus.js';

// "Slack · awaiting your reply" — the deep Slack read (slackDeep.awaiting) rendered
// on the DEFAULT home, not gated behind a "Catch me up" briefing. Each item is a
// pilled card matching the triage cockpit, with a real respond-in-place action.
// Items: { id, who, channel, when, text, permalink }.

function slackMeta(item) {
  return [
    item.channel ? `#${String(item.channel).replace(/^#+/, '')}` : 'Slack',
    item.who,
    item.when
  ]
    .filter(Boolean)
    .join(' · ');
}

function SlackReplyCard({ item, onReply }) {
  return html`
    <div className="wb13-card wb13-card-readable">
      <div className="wb13-card-main">
        <div className="wb13-card-status">
          <span className="wb13-status-pill is-reply"><${Icon} name="chat" /> Slack</span>
          <span className="wb13-card-when">${slackMeta(item)}</span>
        </div>
        <div className="wb13-card-title">
          ${item.who ? `${item.who} needs you` : 'You were mentioned'}
        </div>
        ${item.text ? html`<div className="wb13-card-copy">${item.text}</div>` : null}
      </div>
      <div className="wb13-card-actions">
        <button
          type="button"
          className="wb13-button is-sm is-primary"
          data-testid="workbench-slack-reply"
          onClick=${() => onReply(item)}
        >
          Draft reply
        </button>
        ${item.permalink
          ? html`<a
              className="wb13-button is-sm"
              href=${item.permalink}
              target="_blank"
              rel="noopener noreferrer"
              >Open thread</a
            >`
          : null}
      </div>
    </div>
  `;
}

export function WorkbenchSlackReplies({ items, onReply }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;
  return html`
    <div className="wb13-section wb13-list" data-testid="workbench-slack-replies">
      <div className="wb13-section-label">
        <${Icon} name="chat" /> Slack · awaiting your reply
        <span className="wb13-section-count">${list.length}</span>
      </div>
      ${list.map(
        (item) => html`<${SlackReplyCard} key=${item.id} item=${item} onReply=${onReply} />`
      )}
    </div>
  `;
}

// Respond-in-place compose for a Slack thread. Drafts a reply in the user's voice
// (a short read-only agent turn — no write), which the user edits, then copies or
// opens the thread to send. Posting straight to Slack is an outbound SEND, so it
// stays behind the same `sendEnabled` checkpoint as Gmail sends; until that is on,
// the honest path is Copy + Open thread (zero-write).
export function WorkbenchSlackCompose({
  context,
  generating = false,
  suggestion = '',
  sendEnabled = false,
  posting = false,
  result,
  onGenerate,
  onCopy,
  onPost,
  onCancel
}) {
  const open = Boolean(context);
  const { panelRef } = useDialogFocus(open);
  const [body, setBody] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (context) {
      setBody('');
      setCopied(false);
    }
  }, [context]);

  React.useEffect(() => {
    if (suggestion) setBody(suggestion);
  }, [suggestion]);

  if (!open) return null;

  const channel = context.channel ? `#${String(context.channel).replace(/^#+/, '')}` : 'Slack';
  const posted = Boolean(result && result.ok);
  const copy = async () => {
    const ok = await onCopy(body);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return html`
    <div>
      <button
        type="button"
        className="wb13-scrim"
        aria-label="Close Slack reply"
        onClick=${onCancel}
      ></button>
      <div className="wb13-modal">
        <div
          ref=${panelRef}
          tabindex=${-1}
          className="wb13-approve"
          data-testid="workbench-slack-compose"
          role="dialog"
          aria-modal="true"
          aria-label="Reply in Slack"
          onKeyDown=${(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
        >
          <div className="wb13-approve-head">
            <span className="eyebrow"><${Icon} name="chat" /> Slack · ${channel}</span>
            <h2>${posted ? 'Posted to Slack' : 'Reply in your voice'}</h2>
          </div>

          <div className="wb13-approve-body">
            ${posted
              ? html`<div className="wb13-reader-note">
                  <${Icon} name="check" />
                  <span>Your reply was posted to ${channel}.</span>
                </div>`
              : html`
                  ${context.text
                    ? html`<div className="wb13-slack-quote">
                        <span className="who">${context.who || 'Message'}</span>
                        <span>${context.text}</span>
                      </div>`
                    : null}
                  <div className="wb13-bodyprev">
                    <div
                      className="bh"
                      style=${{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <span>Reply</span>
                      ${onGenerate
                        ? html`<button
                            type="button"
                            className="wb13-button is-sm"
                            data-testid="workbench-slack-generate"
                            disabled=${generating}
                            onClick=${onGenerate}
                          >
                            <${Icon} name="spark" />${generating
                              ? 'Drafting…'
                              : 'Draft in my voice'}
                          </button>`
                        : null}
                    </div>
                    <textarea
                      aria-label="Slack reply"
                      className="wb13-approve-textarea"
                      rows="6"
                      value=${body}
                      data-testid="workbench-slack-body"
                      placeholder=${generating
                        ? 'IronClaw is drafting a reply from the thread — or write your own.'
                        : 'Write your reply, or draft one in your voice.'}
                      onInput=${(event) => setBody(event.currentTarget.value)}
                    ></textarea>
                  </div>
                  <div className=${sendEnabled ? 'wb13-note' : 'wb13-gatewarn'}>
                    ${sendEnabled
                      ? `Posting is enabled — "Post to ${channel}" sends this message to Slack.`
                      : 'Posting straight to Slack is turned off. Copy your reply or open the thread to send it yourself.'}
                  </div>
                  ${result && result.error
                    ? html`<div className="wb13-reader-note is-error" role="alert">
                        <${Icon} name="flag" /><span>${result.error}</span>
                      </div>`
                    : null}
                `}
          </div>

          <div className="wb13-approve-footer">
            ${posted
              ? html`<button
                  type="button"
                  className="wb13-button is-primary is-sm"
                  onClick=${onCancel}
                >
                  Done
                </button>`
              : html`
                  ${sendEnabled
                    ? html`<button
                        type="button"
                        className="wb13-button is-primary is-sm"
                        data-testid="workbench-slack-post"
                        disabled=${!body.trim() || posting}
                        onClick=${() => onPost(body)}
                      >
                        ${posting ? 'Posting…' : `Post to ${channel}`}
                      </button>`
                    : null}
                  <button
                    type="button"
                    className=${cn('wb13-button is-sm', !sendEnabled && 'is-primary')}
                    data-testid="workbench-slack-copy"
                    disabled=${!body.trim()}
                    onClick=${copy}
                  >
                    <${Icon} name="copy" />${copied ? 'Copied' : 'Copy reply'}
                  </button>
                  ${context.permalink
                    ? html`<a
                        className="wb13-button is-sm"
                        href=${context.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        >Open thread</a
                      >`
                    : null}
                  <button type="button" className="wb13-button is-sm" onClick=${onCancel}>
                    Cancel
                  </button>
                `}
          </div>
        </div>
      </div>
    </div>
  `;
}
