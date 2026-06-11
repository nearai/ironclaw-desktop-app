/**
 * ApprovalCard v2 — tool-approval gate.
 *
 * Adds a heuristic risk badge derived client-side from the tool name (the
 * backend does not currently send a risk classification), a cleaner parameter
 * block, and a clearer "always allow" affordance. When the operator ticks
 * "always allow", the primary action calls `onAlways` instead of `onApprove`.
 *
 * No fabricated diff or scope claims: parameters are rendered as supplied,
 * and "always allow" wording stays generic because the backend owns the
 * actual persistence scope.
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

export function ApprovalCard({ gate, onApprove, onDeny, onAlways }) {
  const t = useT();
  const { toolName, headline, body, parameters, allowAlways } = gate;
  const description = gate.description || body || '';
  const displayName = toolName || headline || t('approval.thisTool');
  const [always, setAlways] = React.useState(false);

  const risk = React.useMemo(
    () => classifyRisk(toolName || headline, description, parameters),
    [toolName, headline, description, parameters]
  );

  const onPrimary = React.useCallback(() => {
    if (always && allowAlways) {
      onAlways?.();
    } else {
      onApprove?.();
    }
  }, [always, allowAlways, onAlways, onApprove]);

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
      className="mx-auto max-w-lg rounded-xl border border-copper/35 bg-copper/10 p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="grid h-8 w-8 place-items-center rounded-md border border-copper/25 bg-copper/10 text-copper"
        >
          <${Icon} name="lock" className="h-4 w-4" />
        </span>
        <span className="font-semibold text-white">${t('approval.title')}</span>
        <${Badge}
          tone=${risk.tone}
          label=${t(risk.key)}
          dot=${false}
          size="sm"
          className="ml-auto"
        />
      </div>

      <div className="mb-3 rounded-lg border border-copper/25 bg-iron-950/50 p-3">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-copper">
          <${Icon} name="shield" className="h-3.5 w-3.5" />
          ${t('approval.nothingSentYet')}
        </div>
        <dl className="grid gap-2 text-xs">
          <div className="grid gap-1">
            <dt className="font-semibold uppercase tracking-wide text-iron-400">
              ${t('approval.touchesLabel')}
            </dt>
            <dd className="font-mono text-sm font-medium text-iron-100">${displayName}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="font-semibold uppercase tracking-wide text-iron-400">
              ${t('approval.whatLeavesMachineLabel')}
            </dt>
            <dd className="text-sm text-iron-200">${description || t('approval.notSpecified')}</dd>
          </div>
        </dl>
      </div>

      ${parameters &&
      html`<div className="mb-3">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-iron-400">
          ${t('approval.parametersLabel')}
        </div>
        <pre className="overflow-x-auto rounded-md bg-iron-950 p-2 font-mono text-xs text-iron-100">
${parameters}</pre
        >
      </div>`}
      ${allowAlways &&
      html`
        <label className="mb-3 flex items-center gap-2 text-xs text-iron-200">
          <input
            type="checkbox"
            checked=${always}
            onChange=${(event) => setAlways(event.currentTarget.checked)}
            className="h-3.5 w-3.5 accent-[var(--v2-accent)]"
          />
          ${t('approval.alwaysAllowToolLabel', { tool: displayName })}
        </label>
      `}

      <div className="flex flex-wrap gap-2">
        <${Button} variant="primary" onClick=${onPrimary}>
          ${always && allowAlways ? t('approval.approveAndAlways') : t('approval.approve')}
        <//>
        <${Button} variant="secondary" onClick=${() => onDeny?.()}> ${t('approval.deny')} <//>
      </div>
      <div className="mt-3 text-xs text-iron-400">${t('approval.shortcutHint')}</div>
    </div>
  `;
}
