import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';

const STYLES = {
  connected:
    'bg-[var(--v2-positive-soft)] text-[var(--v2-positive-text)] border-[color-mix(in_srgb,var(--v2-positive-text)_32%,var(--v2-panel-border))]',
  reconnecting:
    'bg-[var(--v2-warning-soft)] text-[var(--v2-warning-text)] border-[color-mix(in_srgb,var(--v2-warning-text)_34%,var(--v2-panel-border))]',
  disconnected:
    'bg-[var(--v2-danger-soft)] text-[var(--v2-danger-text)] border-[color-mix(in_srgb,var(--v2-danger-text)_36%,var(--v2-panel-border))]',
  connecting: 'bg-[var(--v2-surface)] text-[var(--v2-text)] border-[var(--v2-panel-border)]',
  paused: 'bg-[var(--v2-surface)] text-[var(--v2-text)] border-[var(--v2-panel-border)]',
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
        'sticky top-4 z-20 mx-auto mb-2 mt-4 max-w-md rounded-[8px] border px-4 py-1.5 text-center text-xs font-medium shadow-[var(--v2-shadow-sm)] backdrop-blur-xl md:mt-0',
        STYLES[status] || STYLES.connecting
      ].join(' ')}
    >
      ${label !== labelKey ? label : status}
    </div>
  `;
}
