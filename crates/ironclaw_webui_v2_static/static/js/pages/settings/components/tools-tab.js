import { Icon } from '../../../design-system/icons.js';
import { Badge } from '../../../design-system/badge.js';
import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { useTools } from '../hooks/useTools.js';
import { matchesSearch } from '../lib/settings-search.js';

// Blast radius, not alphabetical order. A tool that sends, posts, writes, or
// deletes can move data off the desk or destroy it; a read-only tool cannot.
// The distinction drives the segmentation below AND the weight of an
// `always_allow` choice — auto-allowing a sending tool is a deliberate act, not
// a peer select.
const OUTBOUND_PATTERN =
  /(send|post|email|message|write|create|update|delete|remove|exec|run|shell|deploy|publish|transfer|pay|upload|push|patch|put|drop|destroy|revoke|grant)/i;

function isOutboundTool(tool) {
  const haystack = `${tool.name || ''} ${tool.description || ''}`;
  return OUTBOUND_PATTERN.test(haystack);
}

function ToolRow({ tool, onPermissionChange, isSaved, canEdit, outbound }) {
  const t = useT();
  const permissionStates = [
    { value: 'always_allow', label: t('tools.alwaysAllow'), tone: 'positive' },
    { value: 'ask', label: t('tools.askEachTime'), tone: 'warning' },
    { value: 'disabled', label: t('tools.disabled'), tone: 'danger' }
  ];

  // A locked tool, or any tool when the gateway has no v2 tools-write endpoint
  // (canEdit:false), shows its permission as a read-only badge. Rendering an
  // editable select whose change silently fails to persist is fake readiness.
  const isLocked = tool.locked || !canEdit;
  const current = permissionStates.find((p) => p.value === tool.state) || permissionStates[1];
  const isDefault = tool.state === tool.default_state;
  // Auto-allowing a sending/destructive tool is the weighted, deliberate case:
  // it removes the approval prompt for an action that can leave the desk. Flag
  // it with a danger left-rail so it never reads as an equal choice.
  const autoAllowedOutbound = outbound && tool.state === 'always_allow';

  return html`
    <div
      className=${[
        'flex items-center justify-between gap-4 border-t border-[var(--v2-panel-border)] py-3.5 first:border-0 first:pt-0',
        autoAllowedOutbound ? 'border-l-2 border-l-[var(--v2-danger-text)] pl-3' : ''
      ].join(' ')}
    >
      <div className="flex min-w-0 items-center gap-3">
        ${isLocked &&
        html`<${Icon}
          name="lock"
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 text-[var(--v2-text-faint)]"
        />`}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="v2-text-label truncate text-[var(--v2-text)]">${tool.name}</span>
            ${isDefault &&
            html`
              <span
                className="rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--v2-text-faint)]"
              >
                ${t('tools.default')}
              </span>
            `}
          </div>
          ${tool.description &&
          html`
            <div className="mt-0.5 truncate text-xs text-[var(--v2-text-muted)]">
              ${tool.description}
            </div>
          `}
          ${autoAllowedOutbound &&
          html`
            <div className="mt-0.5 text-xs text-[var(--v2-danger-text)]">
              Runs without approval and can leave the desk.
            </div>
          `}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        ${isLocked
          ? html`<${Badge} tone=${current.tone} label=${current.label} size="sm" />`
          : html`
              <select
                value=${tool.state}
                onChange=${(e) => onPermissionChange(tool.name, e.target.value)}
                aria-label=${t('tools.permissionFor', { name: tool.name })}
                className=${[
                  'v2-select h-8 rounded-[var(--v2-radius-control)] border bg-[var(--v2-surface-soft)] px-2.5 font-mono text-xs text-[var(--v2-text-strong)] outline-none focus:border-[color-mix(in_srgb,var(--v2-accent)_45%,var(--v2-panel-border))]',
                  autoAllowedOutbound
                    ? 'border-[color-mix(in_srgb,var(--v2-danger-text)_45%,var(--v2-panel-border))]'
                    : 'border-[var(--v2-panel-border)]'
                ].join(' ')}
              >
                ${permissionStates.map(
                  (p) => html`<option key=${p.value} value=${p.value}>${p.label}</option>`
                )}
              </select>
            `}
        ${isSaved &&
        html`
          <span className="font-mono text-[11px] text-[var(--v2-accent-text)]"
            >${t('tools.saved')}</span
          >
        `}
      </div>
    </div>
  `;
}

function ToolSection({
  titleKey,
  title,
  description,
  tools,
  canEdit,
  outbound,
  onPermissionChange,
  savedTools
}) {
  return html`
    <section className="mt-8 first:mt-0">
      <h3 className="v2-text-label">${titleKey}</h3>
      ${description &&
      html`<p className="mt-1 max-w-prose text-xs text-[var(--v2-text-muted)]">${description}</p>`}
      <div className="mt-3">
        ${tools.map(
          (tool) => html`
            <${ToolRow}
              key=${tool.name}
              tool=${tool}
              canEdit=${canEdit}
              outbound=${outbound}
              onPermissionChange=${onPermissionChange}
              isSaved=${savedTools[tool.name]}
            />
          `
        )}
      </div>
    </section>
  `;
}

export function ToolsTab({ searchQuery = '' }) {
  const t = useT();
  const { tools, query, status, setPermission, savedTools } = useTools();

  // No v2 tools-write endpoint exists yet (useTools status:'todo'): permission
  // changes resolve against a stub that never persists. Gate the editable
  // controls behind a real backend so the rows present as read-only instead of
  // implying a capability the gateway cannot prove ("No fake readiness").
  const canEdit = status !== 'todo';

  if (query.isLoading) {
    return html`
      <section className="mt-8 first:mt-0">
        <div className="v2-skeleton mb-4 h-3 w-28 rounded" />
        ${[1, 2, 3, 4, 5].map(
          (i) => html`
            <div
              key=${i}
              className="flex items-center justify-between border-t border-[var(--v2-panel-border)] py-3.5 first:border-0"
            >
              <div className="v2-skeleton h-4 w-36 rounded" />
              <div className="v2-skeleton h-8 w-28 rounded" />
            </div>
          `
        )}
      </section>
    `;
  }

  if (query.error) {
    return html`
      <p className="text-sm text-[var(--v2-danger-text)]">
        ${t('tools.failedLoad', { message: query.error.message })}
      </p>
    `;
  }

  const filtered = tools.filter((tool) =>
    matchesSearch(searchQuery, [
      tool.name,
      tool.description,
      tool.state,
      tool.default_state,
      tool.locked ? t('tools.disabled') : ''
    ])
  );

  const outboundTools = filtered.filter(isOutboundTool);
  const readOnlyTools = filtered.filter((tool) => !isOutboundTool(tool));

  return html`
    <div>
      ${searchQuery &&
      html`
        <div className="flex justify-end">
          <span className="v2-text-meta tabular-nums"> ${filtered.length} / ${tools.length} </span>
        </div>
      `}
      ${filtered.length === 0
        ? html`<p className="mt-4 py-4 text-sm text-[var(--v2-text-muted)]">
            ${t('tools.noMatch')}
          </p>`
        : html`
            ${outboundTools.length > 0 &&
            html`
              <${ToolSection}
                titleKey="Sending and destructive"
                description=${'These can move data off the desk or change it. Keep them on ask unless you have a reason not to.'}
                tools=${outboundTools}
                canEdit=${canEdit}
                outbound=${true}
                onPermissionChange=${setPermission}
                savedTools=${savedTools}
              />
            `}
            ${readOnlyTools.length > 0 &&
            html`
              <${ToolSection}
                titleKey="Read-only"
                description=${'These only read. Auto-allow is low risk here.'}
                tools=${readOnlyTools}
                canEdit=${canEdit}
                outbound=${false}
                onPermissionChange=${setPermission}
                savedTools=${savedTools}
              />
            `}
          `}
    </div>
  `;
}
