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

export function WorkbenchSourcesInspector({
  sourceReadiness,
  isBusy,
  onConnectSource,
  onManualSetupSource,
  onClose
}) {
  const { panelRef } = useDialogFocus(true);
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
          ${sourceReadiness.map((item) => {
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
