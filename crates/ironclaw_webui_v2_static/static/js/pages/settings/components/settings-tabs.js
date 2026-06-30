import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { SETTINGS_TABS } from '../lib/settings-schema.js';

function useVisibleTabs(isAdmin) {
  return React.useMemo(
    () => SETTINGS_TABS.filter((tab) => isAdmin || tab.id !== 'users'),
    [isAdmin]
  );
}

export function SettingsTabs({ activeTab, onTabChange, isAdmin = true }) {
  const t = useT();
  const tabs = useVisibleTabs(isAdmin);
  return html`
    <div className="flex flex-col gap-1">
      ${tabs.map(
        (tab) => html`
          <button
            key=${tab.id}
            onClick=${() => onTabChange(tab.id)}
            className=${[
              'group flex items-center gap-3 rounded-[7px] border px-3 py-2.5 text-left text-sm',
              activeTab === tab.id
                ? 'v2-nav-active'
                : 'border-transparent text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text-strong)]'
            ].join(' ')}
          >
            <span
              className=${[
                'grid h-7 w-7 shrink-0 place-items-center rounded-[6px] border',
                activeTab === tab.id
                  ? 'border-[color-mix(in_srgb,var(--v2-accent)_35%,var(--v2-panel-border))] bg-[var(--v2-accent-soft)] text-[var(--v2-accent-text)]'
                  : 'border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] text-[var(--v2-text-muted)] group-hover:border-[color-mix(in_srgb,var(--v2-accent)_35%,var(--v2-panel-border))] group-hover:text-[var(--v2-accent-text)]'
              ].join(' ')}
            >
              <${Icon} name=${tab.icon} className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 truncate">${t(tab.labelKey)}</span>
          </button>
        `
      )}
    </div>
  `;
}

export function SettingsTabsMobile({ activeTab, onTabChange, isAdmin = true }) {
  const t = useT();
  const tabs = useVisibleTabs(isAdmin);
  const active = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  return html`
    <details className="group">
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[8px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface)] px-4 py-3 text-sm text-[var(--v2-text-strong)] [&::-webkit-details-marker]:hidden"
      >
        <span className="flex min-w-0 items-center gap-2">
          <${Icon} name=${active.icon} className="h-4 w-4 shrink-0 text-[var(--v2-accent-text)]" />
          <span className="min-w-0 truncate">${t(active.labelKey)}</span>
        </span>
        <span aria-hidden="true" className="text-[var(--v2-text-faint)] group-open:rotate-180">
          <${Icon} name="chevron" className="h-3.5 w-3.5" />
        </span>
      </summary>
      <div
        className="mt-2 grid gap-1 rounded-[8px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface)] p-1"
      >
        ${tabs.map(
          (tab) => html`
            <button
              key=${tab.id}
              onClick=${() => onTabChange(tab.id)}
              className=${[
                'flex w-full items-center gap-3 rounded-[7px] px-3 py-2 text-left text-sm',
                activeTab === tab.id
                  ? 'bg-[var(--v2-accent-soft)] text-[var(--v2-accent-text)]'
                  : 'text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text-strong)]'
              ].join(' ')}
            >
              <span
                className=${[
                  'grid h-7 w-7 shrink-0 place-items-center rounded-[6px] border',
                  activeTab === tab.id
                    ? 'border-[color-mix(in_srgb,var(--v2-accent)_35%,var(--v2-panel-border))] bg-[var(--v2-accent-soft)] text-[var(--v2-accent-text)]'
                    : 'border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] text-[var(--v2-text-muted)]'
                ].join(' ')}
              >
                <${Icon} name=${tab.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 truncate">${t(tab.labelKey)}</span>
            </button>
          `
        )}
      </div>
    </details>
  `;
}
