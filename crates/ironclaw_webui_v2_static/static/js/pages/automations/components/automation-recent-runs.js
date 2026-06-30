import { Button } from '../../../design-system/button.js';
import { Icon } from '../../../design-system/icons.js';
import { StatusPill } from '../../../design-system/primitives.js';
import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { cn } from '../../../utils/cn.js';
import { runSummaryView } from '../lib/automations-presenters.js';

const MAX_VISIBLE_DOTS = 8;

const DOT_TONE_CLASS = {
  ok: 'border-[color-mix(in_srgb,var(--v2-positive-text)_50%,transparent)] bg-[var(--v2-positive-text)]',
  error:
    'border-[color-mix(in_srgb,var(--v2-danger-text)_50%,transparent)] bg-[var(--v2-danger-text)]',
  running:
    'border-[color-mix(in_srgb,var(--v2-info-text)_60%,transparent)] bg-[var(--v2-info-text)]',
  unknown:
    'border-[color-mix(in_srgb,var(--v2-text-muted)_50%,transparent)] bg-[var(--v2-text-muted)]'
};

const CHIP_TONE_CLASS = {
  success: 'text-[var(--v2-positive-text)]',
  danger: 'text-[var(--v2-danger-text)]',
  info: 'text-[var(--v2-info-text)]',
  muted: 'text-[var(--v2-text-muted)]'
};

export function recentRunKey(run) {
  return run.run_id || run.thread_id || run.submitted_at || run.timestamp_source;
}

export function RunDots({ runs = [] }) {
  const t = useT();
  const visibleRuns = runs.slice(0, MAX_VISIBLE_DOTS);
  if (!visibleRuns.length) {
    return html`<span className="text-xs text-[var(--v2-text-muted)]">
      ${t('automations.table.noRuns')}
    </span>`;
  }
  const overflow = runs.length - visibleRuns.length;

  return html`
    <div
      className="flex items-center gap-1.5"
      aria-label=${t('automations.runs.showingOf', {
        shown: visibleRuns.length,
        total: runs.length
      })}
    >
      ${visibleRuns.map(
        (run) => html`
          <span
            key=${recentRunKey(run)}
            title=${`${run.status_label} - ${run.fired_label}`}
            className=${cn(
              'h-3 w-3 rounded-full border',
              DOT_TONE_CLASS[run.status] || DOT_TONE_CLASS.unknown
            )}
          />
        `
      )}
      ${overflow > 0 &&
      html`<span
        className="ml-0.5 font-mono text-[11px] text-[var(--v2-text-muted)]"
        title=${t('automations.runs.showingOf', { shown: visibleRuns.length, total: runs.length })}
      >
        +${overflow}
      </span>`}
    </div>
  `;
}

export function RunHistorySummary({ runs = [], className = '' }) {
  const t = useT();
  const view = runSummaryView(runs, t);
  if (!view.total) {
    return html`<span className=${cn('text-[11px] text-[var(--v2-text-muted)]', className)}>
      ${t('automations.table.noRuns')}
    </span>`;
  }

  return html`
    <div className=${cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]', className)}>
      <span className="text-[var(--v2-text-muted)]">${view.totalText}</span>
      ${view.chips.map(
        (chip) => html`
          <span key=${chip.key} className=${CHIP_TONE_CLASS[chip.tone] || CHIP_TONE_CLASS.muted}>
            ${chip.text}
          </span>
        `
      )}
    </div>
  `;
}

export function RecentRunRow({ run, onOpenRun }) {
  const t = useT();
  const canOpen = Boolean(run.chat_path);

  return html`
    <div
      className="grid gap-3 border-b border-[var(--v2-panel-border)] py-3 last:border-0 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-center"
    >
      <div>
        <${StatusPill} tone=${run.status_tone} label=${run.status_label} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--v2-text-strong)]">${run.fired_label}</div>
        <div className="mt-1 truncate font-mono text-[11px] text-[var(--v2-text-muted)]">
          ${run.thread_id
            ? `${t('automations.detail.thread')} ${run.thread_id}`
            : t('automations.detail.noThread')}
        </div>
        ${run.run_id &&
        html`
          <div className="mt-1 truncate font-mono text-[11px] text-[var(--v2-text-faint)]">
            ${t('automations.detail.run')} ${run.run_id}
          </div>
        `}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <${Button}
          variant="secondary"
          size="sm"
          disabled=${!canOpen}
          onClick=${canOpen ? () => onOpenRun(run.chat_path) : undefined}
        >
          <${Icon} name="chat" className="mr-1.5 h-4 w-4" />
          ${t('automations.detail.openRun')}
        <//>
      </div>
    </div>
  `;
}
