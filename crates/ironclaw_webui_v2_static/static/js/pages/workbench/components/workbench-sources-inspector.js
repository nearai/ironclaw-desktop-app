import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';
import { useDialogFocus } from '../hooks/useDialogFocus.js';

function sourceStateClass(readiness) {
  if (readiness?.tone === 'positive') return 'is-positive';
  if (readiness?.tone === 'danger') return 'is-danger';
  if (readiness?.tone === 'warning') return 'is-warning';
  return '';
}

function sourceActionDisabled(action, isBusy, onConnectSource, onManualSetupSource) {
  return Boolean(
    isBusy ||
    action?.disabled ||
    (action?.kind === 'connect' && !onConnectSource) ||
    (action?.kind === 'manual_setup' && !onManualSetupSource)
  );
}

function liveConnectorReadinessItem(family) {
  if (family?.state !== 'ready') return null;
  const via = family.via || 'connected account';
  return {
    id: family.id,
    displayName: family.label || family.id,
    category: `Connector via ${via}`,
    iconSource: { id: family.id },
    state: 'ready',
    statusLabel: family.statusLabel || 'Ready',
    tone: 'positive',
    body: `${family.label || family.id} is connected via ${via} and can be read for Workbench requests.`,
    action: {
      kind: 'none',
      label: `Ready via ${via}`,
      disabled: true,
      variant: 'secondary'
    },
    priority: 5
  };
}

function mergedSourceReadiness(sourceReadiness = [], connectorFamilies = []) {
  const liveItems = (connectorFamilies || []).map(liveConnectorReadinessItem).filter(Boolean);
  if (liveItems.length === 0) return sourceReadiness || [];

  const liveIds = new Set(liveItems.map((item) => item.id));
  const existingById = new Map((sourceReadiness || []).map((item) => [item.id, item]));
  return [
    ...(sourceReadiness || []).filter((item) => !liveIds.has(item.id)),
    ...liveItems.map((item) => {
      const existing = existingById.get(item.id) || {};
      return {
        ...item,
        order: existing.order ?? item.order,
        priority: existing.priority ?? item.priority
      };
    })
  ].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99) || (a.order ?? 99) - (b.order ?? 99));
}

export function WorkbenchSourcesInspector({
  sourceReadiness,
  connectorFamilies,
  isBusy,
  onConnectSource,
  onManualSetupSource,
  onClose
}) {
  const { panelRef } = useDialogFocus(true);
  const readableSources = mergedSourceReadiness(sourceReadiness, connectorFamilies);
  const runSourceAction = (item) => {
    const action = item?.action || {};
    if (sourceActionDisabled(action, isBusy, onConnectSource, onManualSetupSource)) return;
    if (action.kind === 'connect') onConnectSource(action.entry);
    if (action.kind === 'manual_setup') onManualSetupSource(action.entry);
  };

  return html`
    <div>
      <button
        type="button"
        className="wb13-scrim"
        aria-label="Close inspector"
        onClick=${onClose}
      ></button>
      <aside
        ref=${panelRef}
        tabindex=${-1}
        className="wb13-inspector"
        aria-label="Allowed sources and boundaries"
      >
        <div className="wb13-inspector-head">
          <${Icon} name="plug" />
          Sources for this task
          <button type="button" aria-label="Close" onClick=${onClose}>
            <${Icon} name="close" />
          </button>
        </div>
        <p className="wb13-inspector-sub">
          Live connector readiness for the current request. Disconnected sources stay unavailable
          until setup succeeds.
        </p>
        <div className="wb13-inspector-block">
          <h5>Readable now or after setup</h5>
          ${readableSources.map((item) => {
            const action = item.action || {};
            const disabled = sourceActionDisabled(
              action,
              isBusy,
              onConnectSource,
              onManualSetupSource
            );
            return html`
              <div key=${item.id} className="wb13-source-pill">
                <${Icon}
                  name=${item.id === 'workspace' ? 'file' : item.id === 'web' ? 'search' : 'plug'}
                />
                <span>
                  <strong>${item.displayName}</strong>
                  <span>${item.body}</span>
                </span>
                <span className="wb13-source-meta">
                  <span className=${cn('wb13-source-state', sourceStateClass(item))}
                    >${item.statusLabel}</span
                  >
                  ${action.kind === 'link'
                    ? html`<a className="wb13-source-action" href=${action.href}
                        >${action.label}</a
                      >`
                    : action.kind && action.kind !== 'none'
                      ? html`<button
                          type="button"
                          className="wb13-source-action"
                          disabled=${disabled}
                          onClick=${() => runSourceAction(item)}
                        >
                          ${action.label}
                        </button>`
                      : null}
                </span>
              </div>
            `;
          })}
        </div>
        <div className="wb13-inspector-note">
          IronClaw can read available sources and prepare private drafts. Sending, posting, sharing,
          filing, or saving durable memory still requires an explicit approval step in Chat.
        </div>
      </aside>
    </div>
  `;
}
