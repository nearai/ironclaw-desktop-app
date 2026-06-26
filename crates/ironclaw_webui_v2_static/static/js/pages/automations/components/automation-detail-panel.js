import { useNavigate } from 'react-router';
import { EmptyPanel, Panel, StatusPill } from '../../../design-system/primitives.js';
import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { cn } from '../../../utils/cn.js';
import {
  RecentRunRow,
  recentRunKey,
  RunDots,
  RunHistorySummary
} from './automation-recent-runs.js';

const META_TONE_CLASS = {
  success: 'text-[var(--v2-positive-text)]',
  danger: 'text-[var(--v2-danger-text)]',
  info: 'text-[var(--v2-info-text)]'
};

function MetaItem({ label, value, tone }) {
  return html`
    <div
      className="min-w-0 rounded-xl border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] p-3"
    >
      <div
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--v2-text-muted)]"
      >
        ${label}
      </div>
      <div
        className=${cn(
          'mt-2 min-w-0 break-words text-sm text-[var(--v2-text-strong)]',
          META_TONE_CLASS[tone]
        )}
      >
        ${value || '-'}
      </div>
    </div>
  `;
}

export function AutomationDetailPanel({ automation }) {
  const t = useT();
  const navigate = useNavigate();

  if (!automation) {
    return html`
      <${Panel} className="p-4 sm:p-5">
        <${EmptyPanel}
          boxed=${false}
          title=${t('automations.detail.emptyTitle')}
          description=${t('automations.detail.emptyDescription')}
        />
      <//>
    `;
  }

  const activeRun = automation.current_run;

  return html`
    <${Panel} className="overflow-hidden">
      <div className="border-b border-[var(--v2-panel-border)] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3
              className="truncate text-xl font-semibold tracking-tight text-[var(--v2-text-strong)]"
            >
              ${automation.display_name}
            </h3>
            <div
              className="mt-2 truncate font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--v2-text-muted)]"
            >
              ${automation.automation_id}
            </div>
          </div>
          <${StatusPill}
            tone=${automation.has_running_run ? 'info' : automation.state_tone}
            label=${automation.has_running_run
              ? t('automations.status.running')
              : automation.state_label}
          />
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <${MetaItem}
            label=${t('automations.detail.schedule')}
            value=${automation.schedule_label}
          />
          <${MetaItem}
            label=${t('automations.detail.successRate')}
            value=${automation.success_rate_label}
            tone=${automation.has_failed_runs ? 'danger' : 'success'}
          />
          <${MetaItem}
            label=${t('automations.detail.lastCompleted')}
            value=${automation.last_run_label}
          />
          <${MetaItem}
            label=${t('automations.detail.currentRun')}
            value=${activeRun?.run_id ||
            activeRun?.thread_id ||
            t('automations.detail.noCurrentRun')}
            tone=${automation.has_running_run ? 'info' : null}
          />
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-[var(--v2-text-strong)]">
              ${t('automations.detail.recentRuns')}
            </h4>
            <div className="flex flex-col items-end gap-1">
              <${RunDots} runs=${automation.recent_runs} />
              <${RunHistorySummary} runs=${automation.recent_runs} />
            </div>
          </div>

          ${automation.recent_runs.length
            ? html`
                <div>
                  ${automation.recent_runs.map(
                    (run) => html`
                      <${RecentRunRow} key=${recentRunKey(run)} run=${run} onOpenRun=${navigate} />
                    `
                  )}
                </div>
              `
            : html`
                <div
                  className="rounded-xl border border-dashed border-[var(--v2-panel-border)] p-4 text-sm text-[var(--v2-text-muted)]"
                >
                  ${t('automations.detail.noRuns')}
                </div>
              `}
        </div>
      </div>
    <//>
  `;
}
