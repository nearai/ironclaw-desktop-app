import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';
import { useDialogFocus } from '../hooks/useDialogFocus.js';
import { draftValidationError, isValidEmail, resolveRecipients } from '../lib/workbench-draft.js';

const APPROVE_STYLE = `
.wb13-recip-hint { font-size: 11.5px; color: var(--wb-faint); margin: -2px 0 2px; }
.wb13-linkbtn { background: none; border: 0; padding: 0; font: inherit; color: var(--wb-accent); cursor: pointer; text-decoration: underline; }
.wb13-recip-preview { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 4px; }
.wb13-recip-chip {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; line-height: 1; padding: 5px 9px; border-radius: 999px;
  background: var(--wb-accent-soft); color: var(--wb-accent); border: 1px solid var(--wb-accent-tint);
}
.wb13-recip-chip .tag { font-size: 9.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.75; }
.wb13-recip-chip.is-bad { background: color-mix(in srgb, var(--wb-danger) 12%, transparent); color: var(--wb-danger); border-color: color-mix(in srgb, var(--wb-danger) 35%, transparent); }
`;

// A read-only preview of who the draft will go to, so added addresses visibly
// register (the "invoices@near.foundation doesn't show up as a recipient" fix).
// Each To/Cc address parsed from the fields becomes a chip; invalid ones are flagged.
function RecipientPreview({ recipient, cc }) {
  // Mirror exactly what will be written: de-duplicated To, and Cc with To overlap
  // removed. Using the same resolver as draftWriteArguments keeps the preview honest
  // and guarantees unique chip keys.
  const { to, cc: ccList } = resolveRecipients({ recipient, cc });
  if (!to.length && !ccList.length) return null;
  return html`<div className="wb13-recip-preview" data-testid="workbench-approve-recipients">
    ${to.map(
      (email) =>
        html`<span
          key=${`to-${email}`}
          className=${cn('wb13-recip-chip', !isValidEmail(email) && 'is-bad')}
          >${email}</span
        >`
    )}
    ${ccList.map(
      (email) =>
        html`<span
          key=${`cc-${email}`}
          className=${cn('wb13-recip-chip', !isValidEmail(email) && 'is-bad')}
          ><span className="tag">cc</span>${email}</span
        >`
    )}
  </div>`;
}

// The gated-write approval modal. The user reviews and edits a reply draft — To
// (one or more comma-separated addresses), Cc, subject, body — then "Create draft"
// writes a REVIEWABLE draft to Gmail (nothing is sent). A "Send" affordance appears
// only when the gateway reports the send capability is on; otherwise the modal
// states plainly that sending from the Workbench is off. This is the only place a
// connector write is initiated from the UI.
export function WorkbenchApprove({
  context,
  sendEnabled = false,
  busy,
  generating = false,
  suggestedBody = '',
  onGenerate,
  result,
  onCancel,
  onSubmit
}) {
  const open = Boolean(context);
  const { panelRef } = useDialogFocus(open);
  const [recipient, setRecipient] = React.useState('');
  const [cc, setCc] = React.useState('');
  const [showCc, setShowCc] = React.useState(false);
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');

  // Re-seed the editable fields whenever a new draft context opens.
  React.useEffect(() => {
    if (!context) return;
    setRecipient(context.recipient || '');
    setCc(context.cc || '');
    setShowCc(Boolean(context.cc));
    setSubject(context.subject || '');
    setBody(context.body || '');
  }, [context]);

  // Fill the body with an agent-drafted reply when one arrives. Pre-drafting is
  // opt-in (the user clicked "Pre-draft reply"), so replacing the body is intended.
  React.useEffect(() => {
    if (suggestedBody) setBody(suggestedBody);
  }, [suggestedBody]);

  if (!open) return null;

  const created = Boolean(result && result.ok);
  const validation = created ? '' : draftValidationError({ recipient, cc, subject, body });
  const submit = () => {
    if (validation || busy) return;
    onSubmit({ recipient, cc, subject, body, threadId: context.threadId });
  };

  return html`
    <div>
      <style>
        ${APPROVE_STYLE}
      </style>
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
          aria-modal="true"
          aria-label="Create draft"
          onKeyDown=${(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
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
                      type="text"
                      value=${recipient}
                      data-testid="workbench-approve-recipient"
                      placeholder="name@company.com, second@company.com"
                      onInput=${(event) => setRecipient(event.currentTarget.value)}
                    />
                  </label>
                  <div className="wb13-recip-hint">
                    Add more than one — separate addresses with a comma.
                    ${showCc
                      ? null
                      : html` ·
                          <button
                            type="button"
                            className="wb13-linkbtn"
                            data-testid="workbench-approve-addcc"
                            onClick=${() => setShowCc(true)}
                          >
                            Add Cc
                          </button>`}
                  </div>
                  ${showCc
                    ? html`<label className="wb13-pill-control wb13-full-control">
                        Cc
                        <input
                          type="text"
                          value=${cc}
                          data-testid="workbench-approve-cc"
                          placeholder="cc@company.com"
                          onInput=${(event) => setCc(event.currentTarget.value)}
                        />
                      </label>`
                    : null}
                  <${RecipientPreview} recipient=${recipient} cc=${cc} />
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
                    <div
                      className="bh"
                      style=${{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <span>Message</span>
                      ${onGenerate
                        ? html`<button
                            type="button"
                            className="wb13-button is-sm"
                            data-testid="workbench-approve-generate"
                            disabled=${generating}
                            onClick=${onGenerate}
                          >
                            <${Icon} name="spark" />${generating ? 'Drafting…' : 'Pre-draft reply'}
                          </button>`
                        : null}
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
