import { html } from '../../../lib/html.js';

// One honest mono headline instead of a 5-up metric-box strip. The counts read as
// a single quiet line (Geist Mono via .v2-text-meta); the table below is the focus.
// Failed jobs are the surface's single accent moment — the "needs review" clause is
// the only coloured token here, so a squint lands only on real failures. Filtering
// lives in the list's own filter row, so this line no longer competes for that job.
export function AutomationsSummaryStrip({ summary }) {
  const scheduled = summary?.scheduled ?? 0;
  const active = summary?.active ?? 0;
  const running = summary?.running ?? 0;
  const failures = summary?.failures ?? 0;

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const parts = [plural(scheduled, 'scheduled', 'scheduled'), plural(active, 'active', 'active')];
  if (running > 0) parts.push(plural(running, 'running', 'running'));

  return html`
    <p className="v2-text-meta" data-testid="automations-summary-line">
      ${parts.join(' · ')}${failures > 0
        ? html`<span> · </span
            ><span className="text-[var(--v2-danger-text)]"
              >${plural(failures, 'needs review', 'need review')}</span
            >`
        : ''}
    </p>
  `;
}
