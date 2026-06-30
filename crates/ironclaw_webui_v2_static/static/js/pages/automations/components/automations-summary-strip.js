import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { StatCard } from '../../../design-system/primitives.js';
import { cn } from '../../../utils/cn.js';

export function AutomationsSummaryStrip({ summary, activeFilter, onSelectFilter }) {
  const t = useT();
  const cards = [
    {
      key: 'scheduled',
      label: t('automations.summary.scheduled'),
      value: summary?.scheduled ?? 0,
      tone: 'muted',
      detail: t('automations.summary.scheduledDetail'),
      filter: 'all'
    },
    {
      key: 'active',
      // Agent attribution, not a live-success signal: keep the summary tone in
      // step with the table's gold "Active"/"Scheduled" state pills.
      label: t('automations.summary.active'),
      value: summary?.active ?? 0,
      tone: 'gold',
      detail: t('automations.summary.activeDetail'),
      filter: 'active'
    },
    {
      key: 'running',
      label: t('automations.summary.running'),
      value: summary?.running ?? 0,
      tone: 'info',
      detail: t('automations.summary.runningDetail'),
      filter: 'running'
    },
    {
      key: 'failures',
      label: t('automations.summary.failures'),
      value: summary?.failures ?? 0,
      tone: (summary?.failures ?? 0) > 0 ? 'danger' : 'success',
      detail: t('automations.summary.failuresDetail'),
      filter: (summary?.failures ?? 0) > 0 ? 'failures' : null
    },
    {
      key: 'nextRun',
      label: t('automations.summary.nextRun'),
      value: summary?.nextRun || t('automations.summary.none'),
      tone: 'info',
      detail: t('automations.summary.nextRunDetail')
    }
  ];

  return html`
    <div className="grid gap-x-7 gap-y-4 sm:grid-cols-2 xl:grid-cols-5">
      ${cards.map((card) => {
        const interactive = Boolean(card.filter && onSelectFilter);
        const isActive = interactive && activeFilter === card.filter;
        const inner = html`
          <${StatCard}
            label=${card.label}
            value=${card.value}
            tone=${card.tone}
            badgeLabel=${t(`automations.badge.${card.tone}`)}
            detail=${card.detail}
            showDivider=${false}
            className="px-0 py-0"
          />
        `;
        if (!interactive) {
          return html`<div key=${card.key} className="px-0 py-0">${inner}</div>`;
        }
        return html`
          <button
            key=${card.key}
            type="button"
            aria-pressed=${isActive}
            title=${t('automations.summary.filterAction', { label: card.label })}
            onClick=${() => onSelectFilter(card.filter)}
            className=${cn(
              'rounded-[8px] px-2 py-1.5 text-left',
              'hover:bg-[var(--v2-surface-muted)]',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--v2-accent)]',
              isActive && 'bg-[var(--v2-accent-soft)]/40'
            )}
          >
            ${inner}
          </button>
        `;
      })}
    </div>
  `;
}
