import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { useInterfaceTheme } from '../../../design-system/theme.js';
import { modelOptionLabel } from '../hooks/useWorkbenchStart.js';
import { useDialogFocus } from '../hooks/useDialogFocus.js';

// Workbench-native settings. The Workbench is its OWN surface: model choice,
// appearance, connections, and identity all live here, in the v13 design — the gear
// never routes into the broader desktop app's settings. Model + connections are the
// same data the command bar and sources inspector use, surfaced in one place.
export function WorkbenchSettings({
  modelId,
  setModelId,
  modelOptions = [],
  modelsLoading,
  modelsError,
  connectorFamilies = [],
  onManageConnections,
  currentUser,
  onClose
}) {
  const { panelRef } = useDialogFocus(true);
  const { theme, toggleTheme } = useInterfaceTheme();
  const identity = currentUser?.displayName || currentUser?.email || '';
  return html`
    <div>
      <button
        type="button"
        className="wb13-scrim"
        aria-label="Close settings"
        onClick=${onClose}
      ></button>
      <aside
        ref=${panelRef}
        tabindex=${-1}
        className="wb13-inspector"
        data-testid="workbench-settings"
        aria-label="Settings"
      >
        <div className="wb13-inspector-head">
          <${Icon} name="settings" />
          Settings
          <button type="button" aria-label="Close" onClick=${onClose}>
            <${Icon} name="close" />
          </button>
        </div>
        <p className="wb13-inspector-sub">
          The Workbench is self-contained. Choose the model that powers your briefing and one-off
          questions, manage your connected tools, and switch the theme — all here.
        </p>

        <div className="wb13-inspector-block">
          <h5>Model</h5>
          <label className="wb13-pill-control wb13-full-control">
            Model
            <select
              aria-label="Workbench model"
              data-testid="workbench-settings-model"
              value=${modelId}
              onChange=${(event) => setModelId(event.currentTarget.value)}
            >
              ${modelOptions.map(
                (model) =>
                  html`<option key=${model} value=${model}>${modelOptionLabel(model)}</option>`
              )}
            </select>
          </label>
          ${modelsLoading
            ? html`<div className="wb13-inspector-note">Loading the model catalog…</div>`
            : null}
          ${modelsError
            ? html`<div className="wb13-inspector-note">
                Could not refresh the model catalog; the active model is still shown.
              </div>`
            : null}
        </div>

        <div className="wb13-inspector-block">
          <h5>Appearance</h5>
          <button
            type="button"
            className="wb13-button is-sm"
            data-testid="workbench-settings-theme"
            onClick=${toggleTheme}
          >
            <${Icon} name=${theme === 'dark' ? 'sun' : 'moon'} />
            ${theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          </button>
        </div>

        <div className="wb13-inspector-block">
          <h5>Connections</h5>
          ${connectorFamilies.length
            ? html`<div
                className="wb13-settings-conns"
                data-testid="workbench-settings-connections-list"
              >
                ${connectorFamilies.map(
                  (family) =>
                    html`<span key=${family.id} className="wb13-settings-conn">
                      <span className="wb13-dot wb13-dot-done"></span>
                      ${family.label}
                    </span>`
                )}
              </div>`
            : html`<div className="wb13-inspector-note">No connected tools yet.</div>`}
          ${typeof onManageConnections === 'function'
            ? html`<button
                type="button"
                className="wb13-button is-sm"
                data-testid="workbench-settings-manage-connections"
                onClick=${onManageConnections}
              >
                Manage connections
              </button>`
            : null}
        </div>

        ${identity
          ? html`<div className="wb13-inspector-foot">
              <${Icon} name="shield" />
              <span>${identity} · NEAR AI Cloud</span>
            </div>`
          : null}
      </aside>
    </div>
  `;
}
