import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { useDialogFocus } from '../hooks/useDialogFocus.js';
import { draftValidationError } from '../lib/workbench-draft.js';

// The gated-write approval modal. The user reviews and edits a reply draft, then
// "Create draft" writes a REVIEWABLE draft to Gmail (nothing is sent). A "Send"
// affordance appears only when the gateway reports the send capability is on;
// otherwise the modal states plainly that sending from the Workbench is off.
// This is the only place a connector write is initiated from the UI.
export function WorkbenchApprove({
  context,
  sendEnabled = false,
  busy,
  generating = false,
  suggestedBody = '',
  result,
  onCancel,
  onSubmit
}) {
  const open = Boolean(context);
  const { panelRef } = useDialogFocus(open);
  const [recipient, setRecipient] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');

  // Re-seed the editable fields whenever a new draft context opens.
  React.useEffect(() => {
    if (!context) return;
    setRecipient(context.recipient || '');
    setSubject(context.subject || '');
    setBody(context.body || '');
  }, [context]);

  // Fill an agent-drafted reply when it arrives — only if the user hasn't typed,
  // so generation never clobbers an edit and is fully optional.
  React.useEffect(() => {
    if (!suggestedBody) return;
    setBody((current) => (current && current.trim() ? current : suggestedBody));
  }, [suggestedBody]);

  if (!open) return null;

  const created = Boolean(result && result.ok);
  const validation = created ? '' : draftValidationError({ recipient, subject, body });
  const submit = () => {
    if (validation || busy) return;
    onSubmit({ recipient, subject, body, threadId: context.threadId });
  };

  return html`
    <div>
      <button
        type="button"
        className="wb13-scrim"
        aria-label="Close draft approval"
        onClick=${onCancel}
      ></button>
      <div className="wb13-modal">
        <div
          ref=${panelRef}
          tabindex=${-1}
          className="wb13-approve"
          data-testid="workbench-approve"
          role="dialog"
          aria-label="Create draft"
        >
          <div className="wb13-approve-head">
            <span className="eyebrow"><${Icon} name="shield" /> Gated write · draft</span>
            <h2>${created ? 'Draft created' : 'Review draft before it is saved'}</h2>
          </div>

          <div className="wb13-approve-body">
            ${created
              ? html`<div className="wb13-reader-note">
                  <${Icon} name="check" />
                  <span>
                    A draft was created in your
                    Gmail${result.draftId ? ` (id ${result.draftId})` : ''}. Nothing was sent — open
                    Gmail to review and send it yourself.
                  </span>
                </div>`
              : html`
                  <dl className="wb13-pkg">
                    <dt>Tool</dt>
                    <dd>Gmail · create draft (no send)</dd>
                  </dl>
                  <label className="wb13-pill-control wb13-full-control">
                    To
                    <input
                      type="email"
                      value=${recipient}
                      data-testid="workbench-approve-recipient"
                      placeholder="recipient@example.com"
                      onInput=${(event) => setRecipient(event.currentTarget.value)}
                    />
                  </label>
                  <label className="wb13-pill-control wb13-full-control">
                    Subject
                    <input
                      type="text"
                      value=${subject}
                      data-testid="workbench-approve-subject"
                      onInput=${(event) => setSubject(event.currentTarget.value)}
                    />
                  </label>
                  <div className="wb13-bodyprev">
                    <div className="bh">
                      Message${generating ? ' · drafting a reply in your voice…' : ''}
                    </div>
                    <textarea
                      aria-label="Draft message"
                      className="wb13-approve-textarea"
                      rows="7"
                      value=${body}
                      data-testid="workbench-approve-body"
                      placeholder=${generating
                        ? 'IronClaw is drafting a reply from the thread — or write your own.'
                        : 'Write your reply. It will be saved as a draft — not sent.'}
                      onInput=${(event) => setBody(event.currentTarget.value)}
                    ></textarea>
                  </div>
                  <div className=${sendEnabled ? 'wb13-note' : 'wb13-gatewarn'}>
                    ${sendEnabled
                      ? 'Sending from the Workbench is enabled. "Create draft" still only saves a draft.'
                      : 'IronClaw saves a reviewable draft. Sending from the Workbench is turned off — you send from Gmail.'}
                  </div>
                  ${validation
                    ? html`<div className="wb13-reader-note is-error" role="alert">
                        <${Icon} name="flag" /><span>${validation}</span>
                      </div>`
                    : null}
                  ${result && result.error
                    ? html`<div className="wb13-reader-note is-error" role="alert">
                        <${Icon} name="flag" /><span>${result.error}</span>
                      </div>`
                    : null}
                `}
          </div>

          <div className="wb13-approve-footer">
            ${created
              ? html`<button
                  type="button"
                  className="wb13-button is-primary is-sm"
                  onClick=${onCancel}
                >
                  Done
                </button>`
              : html`
                  <button
                    type="button"
                    className="wb13-button is-primary is-sm"
                    data-testid="workbench-approve-create"
                    disabled=${Boolean(validation) || busy}
                    onClick=${submit}
                  >
                    ${busy ? 'Creating…' : 'Create draft'}
                  </button>
                  <button type="button" className="wb13-button is-sm" onClick=${onCancel}>
                    Cancel
                  </button>
                  <span className="x">Nothing is sent</span>
                `}
          </div>
        </div>
      </div>
    </div>
  `;
}
