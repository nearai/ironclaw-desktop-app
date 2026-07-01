import { Button } from '../../../design-system/button.js';
import { Icon } from '../../../design-system/icons.js';
import { StatusPill } from '../../../design-system/primitives.js';
import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { cn } from '../../../utils/cn.js';
import { runSummaryView } from '../lib/automations-presenters.js';

const MAX_VISIBLE_DOTS = 8;

// Squint test: only a failed run should jump. Healthy + unknown runs are quiet
// faint dots; a genuine in-flight run breathes (accent); a failure is the single
// amber/danger moment. No four-colour run history that reads as decoration.
const DOT_TONE_CLASS = {
  ok: 'bg-[var(--v2-text-faint)]',
  error: 'bg-[var(--v2-danger-text)]',
  running: 'bg-[var(--v2-accent)] v2-breathing-dot',
  unknown: 'bg-[var(--v2-text-faint)]'
};

const CHIP_TONE_CLASS = {
  success: 'text-[var(--v2-text-muted)]',
  danger: 'text-[var(--v2-danger-text)]',
  info: 'text-[var(--v2-text-muted)]',
  muted: 'text-[var(--v2-text-muted)]'
};

export function recentRunKey(run) {
  return run.run_id || run.thread_id || run.submitted_at || run.timestamp_source;
}

export function RunDots({ runs = [] }) {
  const t = useT();
  const visibleRuns = runs.slice(0, MAX_VISIBLE_DOTS);
  if (!visibleRuns.length) {
    return html`<span className="v2-text-meta">${t('automations.table.noRuns')}</span>`;
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
              'h-2 w-2 shrink-0 rounded-full',
              DOT_TONE_CLASS[run.status] || DOT_TONE_CLASS.unknown
            )}
          />
        `
      )}
      ${overflow > 0 &&
      html`<span
        className="ml-0.5 v2-text-meta"
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
    return html`<span className=${cn('v2-text-meta', className)}>
      ${t('automations.table.noRuns')}
    </span>`;
  }

  return html`
    <div className=${cn('flex flex-wrap items-center gap-x-2 gap-y-1 v2-text-meta', className)}>
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
        <div className="v2-text-body font-medium text-[var(--v2-text-strong)]">
          ${run.fired_label}
        </div>
        <div className="mt-1 truncate v2-text-meta">
          ${run.thread_id
            ? `${t('automations.detail.thread')} ${run.thread_id}`
            : t('automations.detail.noThread')}
        </div>
        ${run.run_id &&
        html`
          <div className="mt-1 truncate v2-text-meta">
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
