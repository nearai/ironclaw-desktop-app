import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { WORKBENCH_EFFORT_LEVELS } from '../lib/workbench-plan.js';
import { modelOptionLabel } from '../hooks/useWorkbenchStart.js';
import { useDialogFocus } from '../hooks/useDialogFocus.js';

function EffortSegment({ effort, onEffort }) {
  return html`
    <div className="wb13-effort" role="group" aria-label="Workbench effort">
      ${WORKBENCH_EFFORT_LEVELS.map(
        (level) => html`
          <button
            key=${level.id}
            type="button"
            className=${effort === level.id ? 'is-active' : ''}
            aria-pressed=${effort === level.id}
            onClick=${() => onEffort(level.id)}
          >
            ${level.label}
          </button>
        `
      )}
    </div>
  `;
}

export function WorkModeInspector({
  modelId,
  setModelId,
  modelOptions,
  modelsLoading,
  modelsError,
  effort,
  setEffort,
  onClose
}) {
  const { panelRef } = useDialogFocus(true);
  return html`
    <div>
      <button
        type="button"
        className="wb13-scrim"
        aria-label="Close work mode"
        onClick=${onClose}
      ></button>
      <aside ref=${panelRef} tabindex=${-1} className="wb13-inspector" aria-label="Work mode">
        <div className="wb13-inspector-head">
          <${Icon} name="spark" />
          Work mode
          <button type="button" aria-label="Close" onClick=${onClose}>
            <${Icon} name="close" />
          </button>
        </div>
        <p className="wb13-inspector-sub">
          Models come from NEAR AI Cloud. Effort is separate and only changes how carefully the
          request is handled.
        </p>
        <div className="wb13-inspector-block">
          <h5>Model</h5>
          <label className="wb13-pill-control wb13-full-control">
            Model
            <select
              aria-label="Workbench model"
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
            ? html`<div className="wb13-inspector-note">
                Loading the NEAR AI Cloud model catalog...
              </div>`
            : null}
          ${modelsError
            ? html`<div className="wb13-inspector-note">
                Could not refresh the model catalog. The current active model is still shown.
              </div>`
            : null}
        </div>
        <div className="wb13-inspector-block">
          <h5>Effort</h5>
          <${EffortSegment} effort=${effort} onEffort=${setEffort} />
        </div>
      </aside>
    </div>
  `;
}
