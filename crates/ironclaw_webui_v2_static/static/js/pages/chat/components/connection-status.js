import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';

const STYLES = {
  reconnecting:
    'bg-[var(--v2-warning-soft)] text-[var(--v2-warning-text)] border-[color-mix(in_srgb,var(--v2-warning-text)_30%,var(--v2-panel-border))]',
  disconnected:
    'bg-[var(--v2-danger-soft)] text-[var(--v2-danger-text)] border-[color-mix(in_srgb,var(--v2-danger-text)_36%,var(--v2-panel-border))]',
  connecting:
    'bg-[var(--v2-surface-soft)] text-[var(--v2-text-muted)] border-[var(--v2-panel-border)]',
  paused: 'bg-[var(--v2-surface-soft)] text-[var(--v2-text-muted)] border-[var(--v2-panel-border)]',
  idle: 'hidden'
};

export function ConnectionStatus({ status }) {
  const t = useT();
  if (status === 'idle' || status === 'connected' || !status) return null;

  const labelKey = 'connection.' + status;
  const label = t(labelKey);

  return html`
    <div
      className=${[
        'sticky top-4 z-20 mx-auto mt-4 md:mt-0 mb-2 max-w-md rounded-full border px-4 py-1.5 text-center text-xs font-medium backdrop-blur-xl',
        STYLES[status] || STYLES.connecting
      ].join(' ')}
    >
      ${label !== labelKey ? label : status}
    </div>
  `;
}
