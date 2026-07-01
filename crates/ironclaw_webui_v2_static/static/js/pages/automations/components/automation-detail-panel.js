import { React } from '../../../lib/html.js';
import { useNavigate } from 'react-router';
import { EmptyPanel, Panel, StatusPill } from '../../../design-system/primitives.js';
import { Icon } from '../../../design-system/icons.js';
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
  danger: 'text-[var(--v2-danger-text)]',
  info: 'text-[var(--v2-info-text)]'
};

// Hairline key-value row, not a rounded-xl tinted box. Only a real failure carries
// colour (danger); a healthy success rate is quiet text — no decorative green card.
function MetaRow({ label, value, tone }) {
  return html`
    <div
      className="flex items-baseline justify-between gap-4 border-b border-[var(--v2-panel-border)] py-2.5 last:border-b-0"
    >
      <span className="v2-text-label">${label}</span>
      <span
        className=${cn(
          'min-w-0 break-words text-right v2-text-body font-medium text-[var(--v2-text-strong)]',
          META_TONE_CLASS[tone]
        )}
        >${value || '—'}</span
      >
    </div>
  `;
}

// Mono id demoted behind a copy affordance — no raw machine leakage sitting in the
// open. The id reads faint until hovered/copied; the button carries the accessible
// name so the id itself is decorative-quiet.
function CopyableId({ value, label }) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef(null);
  React.useEffect(() => () => clearTimeout(timerRef.current), []);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (_) {
      // Clipboard may be blocked; the id stays visible for manual selection.
    }
  };
  return html`<button
    type="button"
    onClick=${onCopy}
    aria-label=${label}
    title=${label}
    className="group inline-flex max-w-full items-center gap-1.5 rounded-[var(--v2-radius-control)] py-0.5 text-left text-[var(--v2-text-faint)] hover:text-[var(--v2-text-muted)]"
  >
    <span className="truncate v2-text-meta">${value}</span>
    <${Icon}
      name=${copied ? 'check' : 'copy'}
      className=${cn(
        'h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100',
        copied && 'opacity-100 text-[var(--v2-positive-text)]'
      )}
      aria-hidden="true"
    />
  </button>`;
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
            <h3 className="truncate v2-text-title">${automation.display_name}</h3>
            <div className="mt-2">
              <${CopyableId} value=${automation.automation_id} label="Copy automation id" />
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
        <div>
          <${MetaRow}
            label=${t('automations.detail.schedule')}
            value=${automation.schedule_label}
          />
          <${MetaRow}
            label=${t('automations.detail.successRate')}
            value=${automation.success_rate_label}
            tone=${automation.has_failed_runs ? 'danger' : null}
          />
          <${MetaRow}
            label=${t('automations.detail.lastCompleted')}
            value=${automation.last_run_label}
          />
          <${MetaRow}
            label=${t('automations.detail.currentRun')}
            value=${activeRun?.run_id ||
            activeRun?.thread_id ||
            t('automations.detail.noCurrentRun')}
            tone=${automation.has_running_run ? 'info' : null}
          />
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="v2-text-label">${t('automations.detail.recentRuns')}</h4>
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
                  className="rounded-[var(--v2-radius-card)] border border-[var(--v2-panel-border)] p-4 v2-text-body text-[var(--v2-text-muted)]"
                >
                  ${t('automations.detail.noRuns')}
                </div>
              `}
        </div>
      </div>
    <//>
  `;
}
