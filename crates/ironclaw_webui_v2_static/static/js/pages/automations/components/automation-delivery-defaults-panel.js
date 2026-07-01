import { Button } from '../../../design-system/button.js';
import { Icon } from '../../../design-system/icons.js';
import { Badge, Panel } from '../../../design-system/primitives.js';
import { React, html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { cn } from '../../../utils/cn.js';

/**
 * Resolve a Badge tone for a delivery target option.
 *   "available"   → success (green, animated dot)
 *   "unavailable" → warning (yellow)
 *   anything else → muted
 */
function targetTone(status) {
  if (status === 'available') return 'success';
  if (status === 'unavailable') return 'warning';
  return 'muted';
}

/**
 * Interpolate a simple {placeholder} template — used for the footnote.
 * Returns an array of string/element segments so React renders the <code> inline.
 */
function interpolateTemplate(template, slots) {
  const parts = template.split(/(\{[^}]+\})/);
  return parts.map((part, i) => {
    const key = part.match(/^\{(.+)\}$/)?.[1];
    return key && slots[key] != null ? slots[key] : part;
  });
}

export function AutomationDeliveryDefaultsPanel({ deliveryState }) {
  const t = useT();
  const currentTargetId = deliveryState.currentTarget?.target_id || '';
  const [draftTargetId, setDraftTargetId] = React.useState(currentTargetId);
  const [showSaved, setShowSaved] = React.useState(false);
  const savedTimerRef = React.useRef(null);

  React.useEffect(() => {
    setDraftTargetId(currentTargetId);
  }, [currentTargetId]);

  React.useEffect(
    () => () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    },
    []
  );

  const isDirty = draftTargetId !== currentTargetId;
  const isBusy = deliveryState.isLoading || deliveryState.isSaving;
  const hasLoadError = Boolean(deliveryState.error);
  const canSave = isDirty && !isBusy && !hasLoadError;
  // Clear is only meaningful when there is a saved target to remove, and
  // nothing is in-flight.
  const canClear = Boolean(currentTargetId) && !isBusy && !hasLoadError;

  const hasTargets = deliveryState.finalReplyTargets.length > 0;
  // Whether we have at least one Slack-style (external) pairable target that is
  // NOT yet available — used to render the "not paired" notice row.
  const hasUnpairedTargets = deliveryState.targets.some(
    (opt) => opt?.capabilities?.final_replies && opt?.target?.status === 'unavailable'
  );
  // The Slack approval footnote only makes sense when an external (Slack-style)
  // target exists at all — paired or not. Web-only deployments shouldn't see a
  // "reply in Slack" hint.
  const hasExternalTargets = hasTargets || hasUnpairedTargets;

  // Flash the "Saved" confirmation; the mutation's rejection is reflected
  // through `deliveryState.saveError` (rendered below), so the catch here only
  // prevents an unhandled promise rejection. Clear any lingering "Saved" flash
  // up front: the error alert is gated on `!showSaved`, so a stale flash from a
  // prior success would otherwise hide the error of a new failing attempt.
  const flashSavedOnSuccess = (promise) => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setShowSaved(false);
    return promise
      .then(() => {
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        setShowSaved(true);
        savedTimerRef.current = setTimeout(() => setShowSaved(false), 2200);
      })
      .catch(() => {});
  };

  const handleSave = () => {
    if (!canSave) return;
    flashSavedOnSuccess(deliveryState.saveFinalReplyTarget(draftTargetId || null));
  };

  const handleClear = () => {
    if (!canClear) return;
    setDraftTargetId('');
    flashSavedOnSuccess(deliveryState.saveFinalReplyTarget(null));
  };

  // ── Derived display values ──────────────────────────────────────────
  const currentDisplayName =
    deliveryState.currentTarget?.display_name || t('automations.delivery.none');
  const currentStatus = deliveryState.currentStatus;
  // "none_configured" maps to muted; "available" → success; "unavailable" → warning
  const currentTone =
    currentStatus === 'available'
      ? 'success'
      : currentStatus === 'unavailable'
        ? 'warning'
        : 'muted';
  const currentPillLabel =
    currentStatus === 'available'
      ? t('automations.delivery.pill.ready')
      : currentStatus === 'unavailable'
        ? t('automations.delivery.pill.unavailable')
        : t('automations.delivery.pill.notSet');

  // Only show the "Current default" green row when there is an actual target set.
  const hasCurrentTarget = Boolean(deliveryState.currentTarget);

  // Section label used for the radio group: when a target is already configured
  // we show "Change target"; when nothing is configured yet we show
  // "Available targets".
  const radioSectionLabel = hasCurrentTarget
    ? t('automations.delivery.changeTarget')
    : t('automations.delivery.availableTargets');

  // The footnote template — {command} is rendered as a <code> element.
  const footnoteSegments = interpolateTemplate(t('automations.delivery.footnote'), {
    command: html`<code
      key="cmd"
      className="rounded-[var(--v2-radius-control)] px-1.5 py-0.5 font-mono text-[0.6875rem] bg-[var(--v2-surface-muted)] text-[var(--v2-accent-text)]"
    >
      approve &lt;code&gt;
    </code>`
  });

  return html`
    <${Panel} className="p-5 sm:p-6">
      <div className="flex flex-col gap-5">
        <!-- ── Header ──────────────────────────────────────────────── -->
        <div className="flex flex-col gap-1">
          <div className="v2-text-label">${t('automations.delivery.eyebrow')}</div>
          <h2 className="mt-1 v2-text-title">${t('automations.delivery.title')}</h2>
          <p className="mt-1 v2-text-body text-[var(--v2-text-muted)]">
            ${t('automations.delivery.explainer')}
          </p>
        </div>

        <hr className="border-t border-[var(--v2-panel-border)]" />

        ${hasLoadError &&
        html`
          <div
            role="alert"
            className="rounded-[var(--v2-radius-card)] border border-[color-mix(in_srgb,var(--v2-danger-text)_28%,var(--v2-panel-border))] bg-[var(--v2-danger-soft)] px-4 py-3.5"
          >
            <div className="flex items-start gap-3">
              <${Icon}
                name="close"
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--v2-danger-text)]"
              />
              <div className="min-w-0 flex-1">
                <div className="v2-text-body font-semibold text-[var(--v2-text-strong)]">
                  ${t('automations.delivery.loadFailedTitle')}
                </div>
                <div className="mt-1 v2-text-meta text-[var(--v2-text-muted)]">
                  ${t('automations.delivery.loadFailedDesc')}
                </div>
                <${Button}
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  disabled=${deliveryState.isRefreshing}
                  onClick=${deliveryState.refetch}
                >
                  <${Icon}
                    name="retry"
                    className=${cn('h-3.5 w-3.5', deliveryState.isRefreshing && 'v2-spin')}
                  />
                  ${t('automations.delivery.retry')}
                <//>
              </div>
            </div>
          </div>
        `}

        <!-- ── Current default row (only when a target is configured) ── -->
        ${!hasLoadError &&
        hasCurrentTarget &&
        html`
          <div>
            <span className="mb-1.5 block v2-text-label">
              ${t('automations.delivery.currentDefault')}
            </span>
            <div
              className="flex items-center gap-3 rounded-[var(--v2-radius-card)] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-4 py-3"
            >
              <span
                className="min-w-0 flex-1 truncate v2-text-body font-medium text-[var(--v2-text-strong)]"
              >
                ${currentDisplayName}
              </span>
              <${Badge} tone=${currentTone} label=${currentPillLabel} />
            </div>
          </div>
        `}

        <!-- ── Radio option rows ────────────────────────────────────── -->
        ${!hasLoadError &&
        html`<div>
          <span className="mb-1.5 block v2-text-label">${radioSectionLabel}</span>
          <div
            className="flex flex-col gap-3"
            role="radiogroup"
            aria-label=${t('automations.delivery.title')}
          >
            <!-- Available external targets -->
            ${deliveryState.finalReplyTargets.map((option) => {
              const tid = option?.target?.target_id ?? '';
              const label = option?.target?.display_name || option?.target?.target_id || '';
              const desc = option?.target?.description || '';
              const optStatus = option?.target?.status ?? 'available';
              const isSelected = draftTargetId === tid;
              return html`
                <label
                  key=${tid}
                  className=${cn(
                    'flex items-start gap-3.5 rounded-[var(--v2-radius-control)] border px-4 py-3.5 cursor-pointer',
                    'transition-colors duration-100',
                    'bg-[var(--v2-surface-soft)] border-[var(--v2-panel-border)]',
                    'hover:bg-[var(--v2-surface-muted)] hover:border-[color-mix(in_srgb,var(--v2-accent)_30%,var(--v2-panel-border))]',
                    isSelected &&
                      'border-[color-mix(in_srgb,var(--v2-accent)_45%,var(--v2-panel-border))] bg-[var(--v2-accent-soft)]'
                  )}
                >
                  <input
                    type="radio"
                    name="delivery-target"
                    value=${tid}
                    checked=${isSelected}
                    disabled=${isBusy}
                    onChange=${() => setDraftTargetId(tid)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--v2-accent)]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="v2-text-body font-medium text-[var(--v2-text-strong)]">
                      ${label}
                    </div>
                    ${desc &&
                    html`<div className="mt-0.5 v2-text-meta text-[var(--v2-text-muted)]">
                      ${desc}
                    </div>`}
                  </div>
                  <${Badge}
                    tone=${targetTone(optStatus)}
                    label=${optStatus === 'unavailable'
                      ? t('automations.delivery.pill.unavailable')
                      : t('automations.delivery.pill.ready')}
                    className="self-center shrink-0"
                  />
                </label>
              `;
            })}

            <!-- Unpaired notice rows (targets present but status=unavailable
                 and NOT already shown above because they lack final_replies) -->
            ${hasUnpairedTargets &&
            html`
              <div
                className="flex items-center gap-3 rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-4 py-3.5"
              >
                <${Icon}
                  name="link"
                  className="h-4 w-4 shrink-0 text-[var(--v2-text-faint)]"
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <span className="v2-text-body font-medium text-[var(--v2-text-muted)]">
                    ${t('automations.delivery.unpairedNotice')}
                  </span>
                  <div className="mt-0.5 v2-text-meta">
                    ${t('automations.delivery.unpairedDesc')}
                  </div>
                </div>
                <${Badge}
                  tone="warning"
                  label=${t('automations.delivery.pill.notPaired')}
                  className="shrink-0"
                />
              </div>
            `}

            <!-- Web app only / fallback row -->
            <label
              className=${cn(
                'flex items-start gap-3.5 rounded-[var(--v2-radius-control)] border px-4 py-3.5',
                'transition-colors duration-100',
                'bg-[var(--v2-surface-soft)] border-[var(--v2-panel-border)]',
                hasTargets
                  ? 'cursor-pointer hover:bg-[var(--v2-surface-muted)] hover:border-[color-mix(in_srgb,var(--v2-accent)_30%,var(--v2-panel-border))]'
                  : 'cursor-default',
                draftTargetId === '' &&
                  'border-[color-mix(in_srgb,var(--v2-accent)_45%,var(--v2-panel-border))] bg-[var(--v2-accent-soft)]'
              )}
            >
              <input
                type="radio"
                name="delivery-target"
                value=""
                checked=${draftTargetId === ''}
                disabled=${isBusy || !hasTargets}
                onChange=${() => setDraftTargetId('')}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--v2-accent)]"
              />
              <div className="flex-1 min-w-0">
                <div className="v2-text-body font-medium text-[var(--v2-text-strong)]">
                  ${t('automations.delivery.webOption')}
                </div>
                <div className="mt-0.5 v2-text-meta text-[var(--v2-text-muted)]">
                  ${t('automations.delivery.webOptionDesc')}
                </div>
              </div>
              <${Badge}
                tone="muted"
                label=${t('automations.delivery.pill.fallback')}
                className="self-center shrink-0"
              />
            </label>
          </div>
        </div>`}

        <!-- ── Save row ─────────────────────────────────────────────── -->
        ${!hasLoadError &&
        html`<div className="flex flex-wrap items-center gap-3">
          <${Button} variant="primary" size="sm" disabled=${!canSave} onClick=${handleSave}>
            <${Icon} name="check" className="h-3.5 w-3.5" />
            ${t('automations.delivery.save')}
          <//>
          <${Button} variant="secondary" size="sm" disabled=${!canClear} onClick=${handleClear}>
            ${t('automations.delivery.clear')}
          <//>
          ${showSaved &&
          html`
            <span
              role="status"
              className="flex items-center gap-1.5 v2-text-meta text-[var(--v2-positive-text)]"
            >
              <${Icon} name="check" className="h-3 w-3" />
              ${t('automations.delivery.saved')}
            </span>
          `}
          ${deliveryState.saveError &&
          !showSaved &&
          html`
            <span
              role="alert"
              className="flex items-center gap-1.5 v2-text-meta text-[var(--v2-danger-text)]"
            >
              <${Icon} name="close" className="h-3 w-3" />
              ${t('automations.delivery.saveFailed')}
            </span>
          `}
        </div>`}

        <!-- ── Footnote (only when an external Slack-style target exists) ── -->
        ${!hasLoadError &&
        hasExternalTargets &&
        html`
          <div
            className="rounded-[var(--v2-radius-card)] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-4 py-3 v2-text-meta leading-relaxed"
          >
            ${footnoteSegments}
          </div>
        `}
      </div>
    <//>
  `;
}
