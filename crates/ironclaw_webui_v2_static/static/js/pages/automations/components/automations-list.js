import { Link } from 'react-router';
import { Button } from '../../../design-system/button.js';
import { Icon } from '../../../design-system/icons.js';
import { EmptyPanel, StatusPill } from '../../../design-system/primitives.js';
import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { cn } from '../../../utils/cn.js';
import { AUTOMATION_FILTERS, filterAutomations } from '../lib/automations-presenters.js';
import { AutomationDetailPanel } from './automation-detail-panel.js';
import { AutomationsEmptyState } from './automations-empty-state.js';
import { RunDots, RunHistorySummary } from './automation-recent-runs.js';

export function AutomationsList({
  automations,
  filter,
  onFilterChange,
  onRefresh,
  isRefreshing,
  selectedAutomationId,
  onSelectAutomation
}) {
  const t = useT();
  const filtered = filterAutomations(automations, filter);
  const hasAutomations = automations.length > 0;
  const selectedAutomation =
    filtered.find((automation) => automation.automation_id === selectedAutomationId) ||
    filtered[0] ||
    null;

  return html`
    <div className="space-y-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="v2-text-label">${t('automations.eyebrow')}</div>
          <h2 className="mt-2 v2-text-title">${t('automations.title')}</h2>
          <p className="mt-2 max-w-2xl v2-text-body text-[var(--v2-text-muted)]">
            ${t('automations.description')}
          </p>
          <${Button} as=${Link} to="/chat" variant="ghost" className="mt-3 -ml-3.5">
            ${t('nav.chat')}
          <//>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center gap-1"
            role="group"
            aria-label=${t('automations.filterLabel')}
          >
            ${AUTOMATION_FILTERS.map(
              (item) => html`
                <button
                  key=${item.value}
                  type="button"
                  aria-pressed=${filter === item.value}
                  onClick=${() => onFilterChange(item.value)}
                  className=${cn(
                    'flex min-h-[44px] items-center rounded-[var(--v2-radius-control)] px-3.5 v2-text-body font-medium',
                    filter === item.value
                      ? 'bg-[var(--v2-accent-soft)] text-[var(--v2-accent-text)]'
                      : 'text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)]'
                  )}
                >
                  ${t(item.labelKey)}
                </button>
              `
            )}
          </div>
          <button
            type="button"
            aria-label=${t('automations.refresh')}
            title=${isRefreshing ? t('automations.refreshing') : t('automations.refresh')}
            disabled=${isRefreshing}
            onClick=${onRefresh}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--v2-radius-control)] border border-transparent bg-transparent text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-accent)]/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--v2-canvas)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <${Icon} name="retry" className=${cn('h-4 w-4', isRefreshing && 'v2-spin')} />
          </button>
        </div>
      </div>

      ${!filtered.length
        ? hasAutomations
          ? html`
              <${EmptyPanel}
                title=${t('automations.empty.matchingTitle')}
                description=${t('automations.empty.matchingDescription')}
              />
            `
          : html`<${AutomationsEmptyState} />`
        : html`
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(22rem,0.88fr)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--v2-panel-border)] text-left">
                      <th className="px-1 py-3 v2-text-label">${t('automations.table.name')}</th>
                      <th className="px-1 py-3 v2-text-label">
                        ${t('automations.table.schedule')}
                      </th>
                      <th className="px-1 py-3 v2-text-label">${t('automations.table.nextRun')}</th>
                      <th className="px-1 py-3 v2-text-label">
                        ${t('automations.table.recentRuns')}
                      </th>
                      <th className="px-1 py-3 v2-text-label">${t('automations.table.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered.map((automation) => {
                      const selected =
                        automation.automation_id === selectedAutomation?.automation_id;
                      return html`
                        <tr
                          key=${automation.automation_id}
                          className=${cn(
                            'border-b border-[var(--v2-panel-border)] last:border-0 hover:bg-[var(--v2-surface-soft)]',
                            selected && 'bg-[var(--v2-accent-soft)]/30'
                          )}
                        >
                          <td className="max-w-[280px] px-1 py-4 align-top">
                            <button
                              type="button"
                              aria-pressed=${selected}
                              onClick=${() => onSelectAutomation(automation.automation_id)}
                              className="flex w-full min-w-0 items-center gap-2 rounded-[var(--v2-radius-control)] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--v2-accent)]"
                            >
                              ${
                                /* Gold marks agent-owned work (DESIGN.md). The raw
                              automation id no longer leaks into the dense row — it
                              lives behind a copy affordance in the detail panel. */ ''
                              }
                              <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--v2-gold)]"
                              ></span>
                              <span
                                className="truncate v2-text-body font-medium text-[var(--v2-text-strong)]"
                              >
                                ${automation.display_name}
                              </span>
                            </button>
                          </td>
                          <td
                            className="px-1 py-4 align-top v2-text-body text-[var(--v2-text-muted)]"
                          >
                            ${automation.schedule_label}
                          </td>
                          <td
                            className="px-1 py-4 align-top v2-text-body text-[var(--v2-text-muted)]"
                          >
                            ${automation.next_run_label}
                          </td>
                          <td className="px-1 py-4 align-top">
                            <div className="space-y-2">
                              <${RunDots} runs=${automation.recent_runs} />
                              <${RunHistorySummary} runs=${automation.recent_runs} />
                            </div>
                          </td>
                          <td className="px-1 py-4 align-top">
                            <${StatusPill}
                              tone=${automation.has_running_run
                                ? 'info'
                                : automation.has_failed_runs
                                  ? 'danger'
                                  : automation.state_tone}
                              label=${automation.has_running_run
                                ? t('automations.status.running')
                                : automation.has_failed_runs
                                  ? t('automations.status.needsReview')
                                  : automation.state_label}
                            />
                          </td>
                        </tr>
                      `;
                    })}
                  </tbody>
                </table>
              </div>

              <${AutomationDetailPanel} automation=${selectedAutomation} />
            </div>
          `}
    </div>
  `;
}
