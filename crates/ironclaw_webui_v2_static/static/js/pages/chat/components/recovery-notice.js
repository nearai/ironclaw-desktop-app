import { html } from '../../../lib/html.js';

export function RecoveryNotice({ notice, onRecover }) {
  return html`
    <div
      className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-3 rounded-[12px] border border-[color-mix(in_srgb,var(--v2-warning-text)_30%,var(--v2-panel-border))] bg-[var(--v2-warning-soft)] px-4 py-3 text-sm text-[var(--v2-warning-text)]"
    >
      <span>${notice.message}</span>
      ${notice.status !== 'loading' &&
      html`
        <button
          type="button"
          onClick=${onRecover}
          className="rounded-[8px] border border-[color-mix(in_srgb,var(--v2-warning-text)_40%,var(--v2-panel-border))] px-2.5 py-1 text-xs font-medium hover:bg-[color-mix(in_srgb,var(--v2-warning-text)_10%,transparent)]"
        >
          Reload history
        </button>
      `}
    </div>
  `;
}
