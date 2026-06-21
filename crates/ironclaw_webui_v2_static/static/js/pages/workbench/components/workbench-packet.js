import { Link } from 'react-router';

import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';
import { useDialogFocus } from '../hooks/useDialogFocus.js';
import { MarkdownRenderer } from '../../chat/components/markdown-renderer.js';
import { buildPacketModel, cleanText, listValue } from '../lib/workbench-packet-model.js';

const PACKET_TABS = [
  { id: 'overview' },
  { id: 'document' },
  { id: 'email' },
  { id: 'evidence' },
  { id: 'activity' }
];

function packetTabLabel(packet, tabId) {
  if (tabId === 'document') return packet.labels.output;
  if (tabId === 'email') return packet.labels.draft;
  if (tabId === 'evidence') return packet.labels.context;
  if (tabId === 'activity') return packet.labels.activity;
  return 'Overview';
}

function lowerLabel(label, fallback = 'item') {
  return cleanText(label, fallback).toLowerCase();
}

function contextIcon(label) {
  const lower = String(label || '').toLowerCase();
  if (lower.includes('mail') || lower.includes('email') || lower.includes('gmail')) return 'mail';
  if (lower.includes('slack')) return 'chat';
  if (lower.includes('web') || lower.includes('http')) return 'search';
  return 'file';
}

function reviewMark(done) {
  return done
    ? html`<span className="wb13-review-mark is-done"><${Icon} name="check" /></span>`
    : html`<span className="wb13-review-mark"></span>`;
}

function PacketHeader({ packet }) {
  return html`
    <div className="wb13-pk-head">
      <div className=${cn('wb13-pk-state', `is-${packet.stateTone}`)}>
        <span className="d"></span>${packet.stateLabel}
      </div>
      <h1>${packet.title}</h1>
      <div className="wb13-pk-ctx">
        ${(packet.contexts.length ? packet.contexts : ['Saved Work']).map(
          (label, index) => html`
            <span key=${`${label}-${index}`} className="wb13-context">
              <${Icon} name=${contextIcon(label)} />${label}
            </span>
          `
        )}
      </div>
    </div>
  `;
}

function PacketTabs({ packet, activeTab, onTab, version, reviewed, hasArtifact }) {
  return html`
    <div className="wb13-tabs" role="tablist" aria-label="Workbench saved work tabs">
      ${PACKET_TABS.map((tab) => {
        const label = packetTabLabel(packet, tab.id);
        return html`
          <button
            key=${tab.id}
            type="button"
            role="tab"
            aria-selected=${activeTab === tab.id}
            className=${cn('wb13-tab', activeTab === tab.id && 'is-active')}
            onClick=${() => onTab(tab.id)}
          >
            ${label}
            ${tab.id === 'document' && hasArtifact
              ? html`<span className="wb13-tab-badge">v${version}</span>`
              : null}
            ${(tab.id === 'document' && reviewed.document) || (tab.id === 'email' && reviewed.email)
              ? html`<span className="wb13-tab-check"><${Icon} name="check" /></span>`
              : null}
          </button>
        `;
      })}
    </div>
  `;
}

function PacketOverview({ packet, reviewed, onTab }) {
  const outputLabel = packet.labels.output;
  const draftLabel = packet.labels.draft;
  return html`
    <div>
      <section className="wb13-sec">
        <div className="wb13-sec-title">Work summary</div>
        <div className="wb13-read">
          <p>
            ${cleanText(
              packet.meta.read,
              packet.hasArtifact
                ? `This saved ${lowerLabel(outputLabel, 'output')} is ready for review. Open the output, any prepared ${lowerLabel(draftLabel, 'draft')}, context, and activity before taking follow-up action.`
                : 'When IronClaw prepares a brief, reply, memo, research note, or file, this area becomes the review workspace.'
            )}
          </p>
        </div>
      </section>
      ${packet.decisions.length
        ? html`
            <section className="wb13-sec">
              <div className="wb13-sec-title">Decisions</div>
              <div className="wb13-decisions">
                ${packet.decisions.map(
                  (decision, index) => html`
                    <div key=${`${decision.label}-${index}`} className="wb13-decision-row">
                      <div className="dl">${cleanText(decision.label, 'Decision')}</div>
                      <div className="dv">${cleanText(decision.value, 'Prepared')}</div>
                      <div className="src">
                        ${cleanText(decision.source, 'Context attached to output')}
                        <button type="button" onClick=${() => onTab('evidence')}>
                          <${Icon} name="file" />context
                        </button>
                      </div>
                    </div>
                  `
                )}
              </div>
            </section>
          `
        : null}
      <section className="wb13-sec">
        <div className="wb13-sec-title">Before continuing</div>
        <div className="wb13-review">
          <div className="wb13-review-head">
            Open the saved output and any prepared reply before export, sharing, or Chat handoff
          </div>
          <div className=${cn('wb13-review-item', reviewed.document && 'is-done')}>
            ${reviewMark(packet.hasArtifact && reviewed.document)}
            <span
              ><b>${packet.hasArtifact ? `${outputLabel} v${packet.version}` : 'Saved output'}</b> -
              ${packet.hasArtifact
                ? reviewed.document
                  ? 'reviewed'
                  : 'not opened yet'
                : 'not available yet'}</span
            >
            <button
              type="button"
              disabled=${!packet.hasArtifact}
              onClick=${() => onTab('document')}
            >
              ${packet.hasArtifact
                ? reviewed.document
                  ? 'Re-open'
                  : `Review ${lowerLabel(outputLabel, 'output')}`
                : 'No output'}
            </button>
          </div>
          <div className=${cn('wb13-review-item', reviewed.email && 'is-done')}>
            ${reviewMark(packet.hasDraft && reviewed.email)}
            <span
              ><b>${draftLabel}</b> -
              ${packet.hasDraft
                ? reviewed.email
                  ? 'reviewed'
                  : 'not opened yet'
                : 'not saved'}</span
            >
            <button type="button" disabled=${!packet.hasDraft} onClick=${() => onTab('email')}>
              ${packet.hasDraft
                ? reviewed.email
                  ? 'Re-open'
                  : `Review ${lowerLabel(draftLabel, 'draft')}`
                : `No ${lowerLabel(draftLabel, 'draft')}`}
            </button>
          </div>
          <div className="wb13-review-item is-done">
            ${reviewMark(true)}
            <span
              ><b>Linked context</b> -
              ${cleanText(packet.approval?.destination, 'No external destination selected')}</span
            >
          </div>
        </div>
      </section>
      ${packet.item
        ? html`<${Link} to=${packet.href} className="wb13-button is-primary">
            Open in Work <${Icon} name="external" />
          <//>`
        : null}
    </div>
  `;
}

function PacketDocument({ packet }) {
  const preview = packet.artifactPreview || {};
  const outputLabel = packet.labels.output;

  return html`
    <div className="wb13-doc">
      <aside className="wb13-doc-nav">
        <div className="wb13-doc-nav-title">${outputLabel}</div>
        <button type="button" className="is-active">
          ${preview.kind === 'file' ? `Saved ${lowerLabel(outputLabel, 'file')}` : 'Saved content'}
        </button>
      </aside>
      <div className="wb13-doc-main">
        <div className="wb13-doc-bar">
          <strong>${cleanText(preview.title, packet.title)}</strong>
          <span>${cleanText(preview.label, packet.hasArtifact ? 'saved output' : 'empty')}</span>
          <span className="wb13-spacer"></span>
          ${packet.item
            ? html`<${Link} to=${packet.href} className="wb13-button is-sm">Open in Work<//>`
            : null}
        </div>
        <div className="wb13-doc-body">
          ${packet.artifactText
            ? html`<${MarkdownRenderer} content=${packet.artifactText} />`
            : preview.kind === 'file'
              ? html`<div className="wb13-empty">
                  <strong>${cleanText(preview.filename, preview.title)}</strong>
                  <p>
                    ${preview.hasBytes || preview.hasRemoteReference
                      ? 'This saved file is present, but Workbench does not expose a text preview for it here. Open it in Work to save or review the original.'
                      : 'This saved file has metadata, but no readable body is available in the local Work store.'}
                  </p>
                </div>`
              : html`<div className="wb13-empty">
                  No saved output content is available yet. Save a result from Chat or preview a
                  local workspace file when you choose that source.
                </div>`}
        </div>
      </div>
    </div>
  `;
}

function PacketEmail({ packet, emailBody, onEmailBody, editingEmail, onToggleEdit, emailEdited }) {
  const email = packet.email;
  const draftLabel = packet.labels.draft;
  if (!packet.hasDraft) {
    return html`<div className="wb13-empty">
      No ${lowerLabel(draftLabel, 'draft')} or notes are saved with this work item yet.
    </div>`;
  }

  return html`
    <div>
      <div className="wb13-email">
        <div className="wb13-email-head">
          <span>To</span
          ><b
            >${cleanText(
              email.to,
              cleanText(packet.approval?.destination, 'No destination selected')
            )}</b
          >
          <span>Subject</span><b>${cleanText(email.subject, 'Prepared response draft')}</b>
        </div>
        <textarea
          aria-label=${`${draftLabel} text`}
          readonly=${!editingEmail}
          value=${emailBody}
          onInput=${(event) => onEmailBody(event.currentTarget.value)}
        />
        <div className="wb13-email-attachment">
          <${Icon} name="file" />
          <b
            >${cleanText(
              email.attachment,
              cleanText(packet.artifactPreview?.title, 'No output attached')
            )}</b
          >
          <span>v${packet.version}${emailEdited ? ' - refreshed after edit' : ''}</span>
        </div>
      </div>
      <div className="wb13-email-actions">
        <button type="button" className="wb13-button" onClick=${onToggleEdit}>
          ${editingEmail
            ? `Save ${lowerLabel(draftLabel, 'draft')}`
            : `Edit ${lowerLabel(draftLabel, 'draft')}`}
        </button>
        ${emailEdited
          ? html`<span className="wb13-stale"
              ><${Icon} name="flag" />Edited - review refreshed</span
            >`
          : null}
      </div>
    </div>
  `;
}

function PacketEvidence({ packet }) {
  const rows = packet.evidence.length
    ? packet.evidence
    : listValue(packet.artifact?.provenance).map((entry) => ({
        title: entry,
        detail: 'Captured with the saved output.',
        source: 'saved'
      }));

  if (!rows.length) {
    return html`<div className="wb13-empty">
      Context will populate from saved work metadata and future output references.
    </div>`;
  }

  return html`
    <div className="wb13-list">
      ${rows.map(
        (row, index) => html`
          <div key=${`${row.title}-${index}`} className="wb13-row">
            <span className="wb13-row-icon"
              ><${Icon} name=${contextIcon(row.source || row.title)}
            /></span>
            <span>
              <span className="wb13-row-title">${cleanText(row.title, 'Context')}</span>
              <span className="wb13-row-copy"
                >${cleanText(row.detail, 'Context attached to output.')}</span
              >
            </span>
            <span className="wb13-row-meta"
              >${cleanText(row.when, cleanText(row.status, 'saved'))}</span
            >
          </div>
        `
      )}
    </div>
  `;
}

function PacketActivity({ packet, localActivity }) {
  const rows = [...packet.activity, ...listValue(packet.receipts), ...localActivity];
  if (!rows.length) {
    return html`<div className="wb13-empty">
      No activity receipts are saved for this item yet.
    </div>`;
  }

  return html`
    <ul className="wb13-activity">
      ${rows.map(
        (row, index) => html`
          <li
            key=${`${row.label || row.title}-${index}`}
            className=${index === rows.length - 1 ? 'now' : ''}
          >
            <span className="ad"></span>
            <span className="at">${cleanText(row.label || row.title, 'Activity')}</span>
            <span className="atime">${cleanText(row.when || row.status, '')}</span>
            ${row.detail ? html`<div className="adetail">${row.detail}</div>` : null}
          </li>
        `
      )}
    </ul>
  `;
}

function PacketAppbar({ packet, reviewed, onReview }) {
  if (!packet.approval) return null;
  return html`
    <div className="wb13-appbar">
      <div className="ai"><${Icon} name="shield" /></div>
      <div className="am">
        <div className="at">${cleanText(packet.approval.barTitle, 'Linked Chat action')}</div>
        <div className="aw">
          ${cleanText(
            packet.approval.barDetail,
            'Workbench is a viewer for the saved output. Continue in Chat for any real external action.'
          )}
        </div>
        <div className="rev">
          <span>${reviewMark(reviewed.document)}${packet.labels.output} v${packet.version}</span>
          <span>${reviewMark(reviewed.email)}${packet.labels.draft}</span>
          <span>${reviewMark(true)}Linked context</span>
        </div>
      </div>
      <button type="button" className="wb13-button is-hold" onClick=${onReview}>
        View Chat handoff
      </button>
    </div>
  `;
}

function ApprovalModal({ packet, reviewed, onClose, onTab }) {
  const { panelRef, onKeyDown } = useDialogFocus(true, { trap: true });
  const ready = reviewed.document && reviewed.email;
  const outputLabel = packet.labels.output;
  const draftLabel = packet.labels.draft;
  return html`
    <div
      className="wb13-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Linked Chat action details"
      onKeyDown=${onKeyDown}
    >
      <div ref=${panelRef} tabindex=${-1} className="wb13-approve">
        <div className="wb13-approve-head">
          <span className="eyebrow"><${Icon} name="shield" />Chat handoff</span>
          <h2>${cleanText(packet.approval?.title, 'Review linked action')}</h2>
        </div>
        <div className="wb13-approve-body">
          <div className="wb13-frozen">
            <${Icon} name="lock" />Saved version v${packet.version} is the version shown here
          </div>
          <dl className="wb13-pkg">
            <dt>Linked action</dt>
            <dd>${cleanText(packet.approval?.actionLabel, 'External action')}</dd>
            <dt>Context</dt>
            <dd>${cleanText(packet.approval?.destination, 'Not selected')}</dd>
            <dt>Prepared item</dt>
            <dd>
              ${cleanText(packet.approval?.outbound, cleanText(packet.email.subject, packet.title))}
            </dd>
            <dt>Attachment</dt>
            <dd>
              ${cleanText(
                packet.approval?.attachment,
                cleanText(packet.artifactPreview?.title, 'No output attached')
              )}
            </dd>
            <dt>Action note</dt>
            <dd>
              ${cleanText(
                packet.approval?.reversible,
                'Any external action depends on the destination system'
              )}
            </dd>
          </dl>
          <div className="wb13-bodyprev">
            <div className="bh">Preview</div>
            <div className="bb">
              ${cleanText(
                packet.approval?.bodyPreview,
                cleanText(packet.email.body, 'No outbound body preview is available.')
              )}
            </div>
          </div>
          <div className="wb13-checklist">
            <div className=${cn('ci', reviewed.document && 'done')}>
              ${reviewMark(reviewed.document)}${outputLabel} reviewed
            </div>
            <div className=${cn('ci', reviewed.email && 'done')}>
              ${reviewMark(reviewed.email)}${draftLabel} reviewed
            </div>
            <div className="ci done">${reviewMark(true)}Linked context visible</div>
          </div>
          ${ready
            ? html`<div className="wb13-note">
                Ready to continue. Workbench does not send or approve external actions; continue in
                the linked Chat when one is available.
              </div>`
            : html`<div className="wb13-gatewarn">
                Review the ${lowerLabel(outputLabel, 'output')} and
                ${lowerLabel(draftLabel, 'draft')} first. Any send or approval must happen in a real
                Chat flow.
              </div>`}
        </div>
        <div className="wb13-approve-footer">
          ${ready && packet.threadHref
            ? html`<${Link} to=${packet.threadHref} className="wb13-button is-hold"
                >Open linked Chat<//
              >`
            : html`<button type="button" className="wb13-button is-hold" disabled>
                ${ready ? 'No Chat link' : 'Open required items first'}
              </button>`}
          <button
            type="button"
            className="wb13-button"
            onClick=${() => onTab(!reviewed.document ? 'document' : 'email')}
          >
            Review ${lowerLabel(!reviewed.document ? outputLabel : draftLabel, 'item')}
          </button>
          <button type="button" className="wb13-button" onClick=${onClose}>Close</button>
          <span className="x">No external action runs from this modal.</span>
        </div>
      </div>
    </div>
  `;
}

export function WorkPacketPreview({ savedItems, activeTab, onTab }) {
  const packet = React.useMemo(() => buildPacketModel(savedItems), [savedItems]);
  const [reviewed, setReviewed] = React.useState({ document: false, email: false });
  const [editingEmail, setEditingEmail] = React.useState(false);
  const [emailBody, setEmailBody] = React.useState('');
  const [emailEdited, setEmailEdited] = React.useState(false);
  const [approvalOpen, setApprovalOpen] = React.useState(false);
  const [localActivity, setLocalActivity] = React.useState([]);

  React.useEffect(() => {
    setReviewed({ document: false, email: false });
    setEditingEmail(false);
    setEmailBody(cleanText(packet.email.body));
    setEmailEdited(false);
    setApprovalOpen(false);
    setLocalActivity([]);
  }, [packet.item?.id, packet.artifact?.id]);

  React.useEffect(() => {
    if (!approvalOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setApprovalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [approvalOpen]);

  const setTab = React.useCallback(
    (tab) => {
      if (tab === 'document' && packet.hasArtifact) {
        setReviewed((prev) => ({ ...prev, document: true }));
      }
      if (tab === 'email' && packet.hasDraft) {
        setReviewed((prev) => ({ ...prev, email: true }));
      }
      onTab(tab);
    },
    [onTab, packet.hasArtifact, packet.hasDraft]
  );

  const toggleEmailEdit = React.useCallback(() => {
    if (editingEmail) {
      setEmailEdited(true);
      setReviewed((prev) => ({ ...prev, email: false }));
      setLocalActivity((prev) => [
        ...prev,
        {
          label: `You edited the ${lowerLabel(packet.labels.draft, 'draft')} - review re-armed`,
          when: 'just now'
        }
      ]);
    }
    setEditingEmail((value) => !value);
  }, [editingEmail, packet.labels.draft]);

  return html`
    <div className="wb13-section" data-testid="workbench-document-workspace">
      <${PacketHeader} packet=${packet} />
      <${PacketTabs}
        packet=${packet}
        activeTab=${activeTab}
        onTab=${setTab}
        version=${packet.version + (emailEdited ? 1 : 0)}
        reviewed=${reviewed}
        hasArtifact=${packet.hasArtifact}
      />
      <div className="wb13-tabwrap">
        ${activeTab === 'overview'
          ? html`<${PacketOverview} packet=${packet} reviewed=${reviewed} onTab=${setTab} />`
          : activeTab === 'document'
            ? html`<${PacketDocument} packet=${packet} />`
            : activeTab === 'email'
              ? html`<${PacketEmail}
                  packet=${packet}
                  emailBody=${emailBody}
                  onEmailBody=${setEmailBody}
                  editingEmail=${editingEmail}
                  onToggleEdit=${toggleEmailEdit}
                  emailEdited=${emailEdited}
                />`
              : activeTab === 'evidence'
                ? html`<${PacketEvidence} packet=${packet} />`
                : html`<${PacketActivity} packet=${packet} localActivity=${localActivity} />`}
      </div>
      <${PacketAppbar}
        packet=${packet}
        reviewed=${reviewed}
        onReview=${() => setApprovalOpen(true)}
      />
      ${approvalOpen
        ? html`<${ApprovalModal}
            packet=${packet}
            reviewed=${reviewed}
            onClose=${() => setApprovalOpen(false)}
            onTab=${(tab) => {
              setApprovalOpen(false);
              setTab(tab);
            }}
          />`
        : null}
    </div>
  `;
}
