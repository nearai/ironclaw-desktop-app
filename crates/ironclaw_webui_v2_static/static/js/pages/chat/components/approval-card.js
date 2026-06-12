/**
 * ApprovalCard v2 — tool-approval gate.
 *
 * Adds a heuristic risk badge derived client-side from the tool name (the
 * backend does not currently send a risk classification) and a literal safety
 * summary. Missing target/destination/data stays visibly unknown instead of
 * being inferred from prose.
 */
import { React, html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { Button } from '../../../design-system/button.js';
import { Badge } from '../../../design-system/badge.js';
import { Icon } from '../../../design-system/icons.js';
import { classifyRisk } from '../lib/approval-risk.js';

function isEditableTarget(target) {
  const tag = String(target?.tagName || '').toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag !== 'input') return false;
  return !['button', 'checkbox', 'radio', 'submit'].includes(String(target?.type || ''));
}

const TARGET_KEYS = ['target', 'resource', 'path', 'file', 'filename', 'name', 'id', 'repo'];
const DESTINATION_KEYS = [
  'destination',
  'recipient',
  'recipients',
  'to',
  'email',
  'channel',
  'workspace',
  'account',
  'endpoint'
];
const OUTBOUND_KEYS = [
  'outbound_data',
  'data',
  'payload',
  'body',
  'content',
  'message',
  'text',
  'attachment',
  'attachments',
  'document',
  'diff',
  'patch'
];

function parseParameters(parameters) {
  if (!parameters) return null;
  if (typeof parameters === 'object') return parameters;
  try {
    return JSON.parse(parameters);
  } catch (_) {
    return null;
  }
}

function summarizeValue(value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    if (value.every((item) => typeof item === 'string')) return value.slice(0, 3).join(', ');
    return `${value.length} ${value.length === 1 ? 'item' : 'items'}`;
  }
  if (typeof value === 'object') {
    const label = value.name || value.filename || value.title || value.id || value.url;
    if (label) return String(label);
    const keys = Object.keys(value);
    return keys.length ? `${keys.length} fields` : '';
  }
  const text = String(value).trim().replace(/\s+/g, ' ');
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function findSummary(parameters, keys) {
  if (!parameters || typeof parameters !== 'object') return '';
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(parameters, key)) {
      const summary = summarizeValue(parameters[key]);
      if (summary) return summary;
    }
  }
  for (const value of Object.values(parameters)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const summary = summarizeValue(value[key]);
        if (summary) return summary;
      }
    }
  }
  return '';
}

export function ApprovalCard({ gate, onApprove, onDeny, onAlways }) {
  const t = useT();
  const { toolName, headline, body, parameters, allowAlways } = gate;
  const description = gate.description || body || '';
  const displayName = toolName || headline || t('approval.thisTool');
  const [always, setAlways] = React.useState(false);
  const parsedParameters = React.useMemo(() => parseParameters(parameters), [parameters]);

  const risk = React.useMemo(
    () => classifyRisk(toolName || headline, description, parameters),
    [toolName, headline, description, parameters]
  );
  const allowAlwaysAvailable = Boolean(allowAlways && risk.allowAlways === true);
  const summaryRows = React.useMemo(
    () => [
      {
        label: t('approval.actionLabel'),
        value: headline || displayName
      },
      {
        label: t('approval.targetLabel'),
        value: findSummary(parsedParameters, TARGET_KEYS)
      },
      {
        label: t('approval.destinationLabel'),
        value: findSummary(parsedParameters, DESTINATION_KEYS)
      },
      {
        label: t('approval.outboundDataLabel'),
        value: findSummary(parsedParameters, OUTBOUND_KEYS)
      }
    ],
    [displayName, headline, parsedParameters, t]
  );

  const onPrimary = React.useCallback(() => {
    if (always && allowAlwaysAvailable) {
      onAlways?.();
    } else {
      onApprove?.();
    }
  }, [always, allowAlwaysAvailable, onAlways, onApprove]);

  React.useEffect(() => {
    const onKeyDown = (event) => {
      if (isEditableTarget(event.target)) return;
      const key = String(event.key || '').toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'enter') {
        event.preventDefault();
        onPrimary();
      } else if (key === 'escape') {
        event.preventDefault();
        onDeny?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDeny, onPrimary]);

  return html`
    <div
      role="group"
      aria-label=${t('approval.title')}
      className="mx-auto w-full max-w-xl rounded-[16px] border border-[color-mix(in_srgb,var(--v2-gold)_40%,var(--v2-panel-border))] bg-[color-mix(in_srgb,var(--v2-gold-soft)_72%,var(--v2-card-bg))] p-4"
    >
      <div className="mb-3 flex items-start gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-[color-mix(in_srgb,var(--v2-gold)_34%,var(--v2-panel-border))] bg-[var(--v2-gold-soft)] text-[var(--v2-gold-text)]"
        >
          <${Icon} name="lock" className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--v2-gold-text)]"
          >
            ${t('approval.agentContext')}
          </div>
          <h3 className="mt-1 text-base font-semibold leading-6 text-[var(--v2-text-strong)]">
            ${displayName}
          </h3>
        </div>
        <${Badge}
          tone=${risk.tone}
          label=${t(risk.key)}
          dot=${false}
          size="sm"
          className="shrink-0"
        />
      </div>

      <div
        className="mb-3 rounded-[12px] border border-[var(--v2-panel-border)] bg-[var(--v2-card-bg)] p-3"
      >
        <div
          className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--v2-gold-text)]"
        >
          <${Icon} name="shield" className="h-3.5 w-3.5" />
          ${t('approval.nothingSentYet')}
        </div>
        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          ${summaryRows.map(
            (row) => html`
              <div key=${row.label} className="grid gap-1">
                <dt
                  className="font-semibold uppercase tracking-[0.08em] text-[var(--v2-text-faint)]"
                >
                  ${row.label}
                </dt>
                <dd className="text-sm leading-5 text-[var(--v2-text-muted)]">
                  ${row.value || t('approval.notSpecified')}
                </dd>
              </div>
            `
          )}
        </dl>
      </div>

      ${parameters &&
      html`<div className="mb-3">
        <div
          className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--v2-text-faint)]"
        >
          ${t('approval.parametersLabel')}
        </div>
        <pre
          className="max-h-44 overflow-auto rounded-[8px] border border-[var(--v2-panel-border)] bg-[var(--v2-canvas-strong)] p-3 font-mono text-xs leading-5 text-[var(--v2-text)]"
        >
${parameters}</pre
        >
      </div>`}
      ${allowAlwaysAvailable &&
      html`
        <label
          className="mb-3 flex items-start gap-2 rounded-[8px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--v2-text-muted)]"
        >
          <input
            type="checkbox"
            checked=${always}
            onChange=${(event) => setAlways(event.currentTarget.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-[var(--v2-accent)]"
          />
          ${t('approval.alwaysAllowToolLabel', { tool: displayName })}
        </label>
      `}
      ${allowAlways &&
      !allowAlwaysAvailable &&
      html`
        <div
          className="mb-3 rounded-[8px] border border-[color-mix(in_srgb,var(--v2-warning-text)_32%,var(--v2-panel-border))] bg-[var(--v2-warning-soft)] px-3 py-2 text-xs leading-5 text-[var(--v2-warning-text)]"
        >
          ${t('approval.alwaysUnavailable')}
        </div>
      `}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs leading-5 text-[var(--v2-text-faint)]">
          ${t('approval.shortcutHint')}
        </div>
        <div className="flex flex-wrap gap-2">
          <${Button} variant="secondary" onClick=${() => onDeny?.()}> ${t('approval.deny')} <//>
          <${Button} variant="primary" onClick=${onPrimary}>
            ${always && allowAlwaysAvailable
              ? t('approval.approveAndAlways')
              : t('approval.approve')}
          <//>
        </div>
      </div>
    </div>
  `;
}
