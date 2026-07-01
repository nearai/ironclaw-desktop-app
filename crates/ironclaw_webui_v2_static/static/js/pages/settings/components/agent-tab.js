import { React, html } from '../../../lib/html.js';
import { AGENT_FIELDS } from '../lib/settings-schema.js';
import { filterSettingsSections } from '../lib/settings-search.js';
import { SettingsField, SettingsGroup } from './settings-field.js';
import { SettingsNotWritable } from './settings-not-writable.js';
import { SettingsSearchEmpty } from './settings-search-empty.js';
import { useT } from '../../../lib/i18n.js';

// Guardrails rank above everything else: the small set of limits that decide
// what the agent may spend, run, and touch before it ever reaches the Advanced
// knobs. auto_approve_tools is the exception — it disables the sacred approval
// gate, so it is NOT a peer toggle in this group; it gets a danger-framed
// control with an inline confirm (see AutoApproveGuardrail).
const GUARDRAIL_KEYS = [
  'agent.max_cost_per_day_cents',
  'agent.max_actions_per_hour',
  'sandbox.enabled',
  'sandbox.policy'
];
const AUTO_APPROVE_KEY = 'agent.auto_approve_tools';

function findField(key) {
  for (const section of AGENT_FIELDS) {
    const found = section.fields.find((field) => field.key === key);
    if (found) return found;
  }
  return null;
}

export function AgentTab({
  settings,
  settingsStatus = 'ready',
  onSave,
  savedKeys,
  isLoading,
  searchQuery = ''
}) {
  const t = useT();
  if (isLoading) {
    return html`<${AgentSkeleton} />`;
  }

  // Every field here writes through `useSettings.save`, which has no v2 persistence
  // endpoint yet (status:'todo'). Editable toggles/selects/inputs that silently
  // fail to save are fake readiness — gate them on a proven settings backend and
  // show an honest explanation instead ("No fake readiness").
  if (settingsStatus === 'todo') {
    return html`<${SettingsNotWritable} />`;
  }

  const guardrailFields = GUARDRAIL_KEYS.map(findField).filter(Boolean);
  const autoApproveField = findField(AUTO_APPROVE_KEY);
  const promotedKeys = new Set([...GUARDRAIL_KEYS, AUTO_APPROVE_KEY]);

  // Advanced = every remaining field, kept in its original group, with the
  // promoted guardrail keys removed so nothing renders twice.
  const advancedSource = AGENT_FIELDS.map((section) => ({
    ...section,
    fields: section.fields.filter((field) => !promotedKeys.has(field.key))
  })).filter((section) => section.fields.length > 0);
  const advancedSections = filterSettingsSections(advancedSource, settings, searchQuery, t);

  // The guardrail block itself is searchable by its field labels/keys.
  const q = searchQuery.trim().toLowerCase();
  const matches = (field) =>
    !q ||
    field.key.toLowerCase().includes(q) ||
    (field.labelKey && t(field.labelKey).toLowerCase().includes(q)) ||
    (field.descKey && t(field.descKey).toLowerCase().includes(q));
  const visibleGuardrails = guardrailFields.filter(matches);
  const showAutoApprove = autoApproveField && matches(autoApproveField);
  const showGuardrailGroup = visibleGuardrails.length > 0 || showAutoApprove;

  if (!showGuardrailGroup && advancedSections.length === 0) {
    return html`<${SettingsSearchEmpty} query=${searchQuery} />`;
  }

  return html`
    <div className="space-y-8">
      ${showGuardrailGroup &&
      html`
        <section
          className="rounded-[var(--v2-radius-card)] border border-[var(--v2-panel-border)] p-4 sm:p-5"
        >
          <h3 className="v2-text-label">Guardrails</h3>
          <p className="mt-1 max-w-prose text-sm text-[var(--v2-text-muted)]">
            The limits IronClaw obeys before it spends, runs, or reaches out. Set these first.
          </p>
          <div className="mt-4">
            ${visibleGuardrails.map(
              (field) => html`
                <${SettingsField}
                  key=${field.key}
                  field=${field}
                  value=${settings[field.key]}
                  onSave=${onSave}
                  isSaved=${savedKeys[field.key]}
                />
              `
            )}
          </div>
          ${showAutoApprove &&
          html`
            <${AutoApproveGuardrail}
              field=${autoApproveField}
              value=${settings[AUTO_APPROVE_KEY]}
              onSave=${onSave}
              isSaved=${savedKeys[AUTO_APPROVE_KEY]}
            />
          `}
        </section>
      `}
      ${advancedSections.length > 0 &&
      html`
        <details className="group">
          <summary
            className="flex cursor-pointer list-none items-center gap-2 py-1 text-left [&::-webkit-details-marker]:hidden"
          >
            <span className="v2-text-label">Advanced</span>
            <span
              aria-hidden="true"
              className="text-[var(--v2-text-faint)] transition-transform group-open:rotate-90"
            >
              ›
            </span>
          </summary>
          <div className="mt-2">
            ${advancedSections.map(
              (section) => html`
                <${SettingsGroup}
                  key=${section.groupKey}
                  groupKey=${section.groupKey}
                  fields=${section.fields}
                  settings=${settings}
                  onSave=${onSave}
                  savedKeys=${savedKeys}
                />
              `
            )}
          </div>
        </details>
      `}
    </div>
  `;
}

// auto_approve_tools disables the approval gate — the product's sacred contract.
// It is framed in danger weight (danger left-rail, danger copy) and cannot be
// turned on with a single tap: enabling requires an inline confirm so the choice
// is deliberate. Turning it back OFF is safe and immediate.
function AutoApproveGuardrail({ field, value, onSave, isSaved }) {
  const t = useT();
  const enabled = value === true || value === 'true';
  const [confirming, setConfirming] = React.useState(false);
  const label = field.labelKey ? t(field.labelKey) : field.label || '';
  const description = field.descKey ? t(field.descKey) : field.description || '';

  const enable = () => {
    onSave(field.key, 'true');
    setConfirming(false);
  };
  const disable = () => onSave(field.key, 'false');

  return html`
    <div
      className=${[
        'mt-4 border-l-2 pl-4',
        enabled ? 'border-l-[var(--v2-danger-text)]' : 'border-l-[var(--v2-panel-border)]'
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--v2-danger-text)]">${label}</span>
            ${enabled &&
            html`<span className="v2-text-meta text-[var(--v2-danger-text)]">gate off</span>`}
          </div>
          <div className="mt-1 max-w-prose text-xs leading-5 text-[var(--v2-text-muted)]">
            ${description}. This turns off the approval gate — IronClaw will act without asking.
          </div>
        </div>
        <div className="shrink-0">
          ${enabled
            ? html`
                <button
                  type="button"
                  onClick=${disable}
                  className="rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] px-3 py-1.5 text-sm text-[var(--v2-text-strong)] hover:bg-[var(--v2-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-accent)]"
                >
                  Re-enable gate
                </button>
              `
            : confirming
              ? html`
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick=${enable}
                      className="rounded-[var(--v2-radius-control)] border border-[color-mix(in_srgb,var(--v2-danger-text)_55%,transparent)] bg-transparent px-3 py-1.5 text-sm text-[var(--v2-danger-text)] hover:bg-[color-mix(in_srgb,var(--v2-danger-text)_8%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-danger-text)]"
                    >
                      Turn off gate
                    </button>
                    <button
                      type="button"
                      onClick=${() => setConfirming(false)}
                      className="rounded-[var(--v2-radius-control)] px-3 py-1.5 text-sm text-[var(--v2-text-muted)] hover:text-[var(--v2-text-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-accent)]"
                    >
                      ${t('common.cancel')}
                    </button>
                  </div>
                `
              : html`
                  <button
                    type="button"
                    onClick=${() => setConfirming(true)}
                    className="rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] px-3 py-1.5 text-sm text-[var(--v2-text-strong)] hover:bg-[var(--v2-surface-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-accent)]"
                  >
                    Disable gate…
                  </button>
                `}
        </div>
      </div>
      ${confirming &&
      !enabled &&
      html`
        <p className="mt-2 text-xs leading-5 text-[var(--v2-danger-text)]">
          Confirm: IronClaw will run every tool — including sending and destructive ones — with no
          approval prompt.
        </p>
      `}
      ${isSaved &&
      html`
        <span
          className="mt-2 inline-block text-[11px] font-medium text-[var(--v2-positive-text)]"
          role="status"
        >
          ${t('tools.saved')}
        </span>
      `}
    </div>
  `;
}

function AgentSkeleton() {
  return html`
    <div>
      ${[1, 2, 3].map(
        (i) => html`
          <section key=${i} className="mt-9 first:mt-0">
            <div className="v2-skeleton mb-4 h-3 w-20 rounded" />
            ${[1, 2, 3, 4].map(
              (j) => html`
                <div
                  key=${j}
                  className="flex items-center justify-between border-t border-[var(--v2-panel-border)] py-4 first:border-0"
                >
                  <div>
                    <div className="v2-skeleton h-4 w-32 rounded" />
                    <div className="v2-skeleton mt-1 h-3 w-48 rounded" />
                  </div>
                  <div className="v2-skeleton h-9 w-36 rounded" />
                </div>
              `
            )}
          </section>
        `
      )}
    </div>
  `;
}
