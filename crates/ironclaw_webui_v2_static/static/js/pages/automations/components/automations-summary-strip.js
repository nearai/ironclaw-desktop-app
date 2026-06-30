import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { StatCard } from '../../../design-system/primitives.js';

export function AutomationsSummaryStrip({ summary }) {
  const t = useT();
  const cards = [
    {
      key: 'scheduled',
      label: t('automations.summary.scheduled'),
      value: summary?.scheduled ?? 0,
      tone: 'muted',
      detail: t('automations.summary.scheduledDetail')
    },
    {
      key: 'active',
      // Agent attribution, not a live-success signal: keep the summary tone in
      // step with the table's gold "Active"/"Scheduled" state pills.
      label: t('automations.summary.active'),
      value: summary?.active ?? 0,
      tone: 'gold',
      detail: t('automations.summary.activeDetail')
    },
    {
      key: 'paused',
      label: t('automations.summary.paused'),
      value: summary?.paused ?? 0,
      tone: 'warning',
      detail: t('automations.summary.pausedDetail')
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
    <div className="grid gap-x-7 md:grid-cols-2 xl:grid-cols-4">
      ${cards.map(
        (card) => html`
          <${StatCard}
            key=${card.key}
            label=${card.label}
            value=${card.value}
            tone=${card.tone}
            detail=${card.detail}
            showDivider=${false}
          />
        `
      )}
    </div>
  `;
}
