import { SlackPairingSection } from '../../../components/slack-pairing-section.js';
import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';

export function ChannelConnectCard({ connectAction, onDismiss }) {
  if (!connectAction) return null;
  const channel = connectAction.channel;

  return html`
    <div
      className="rounded-[8px] border border-[var(--v2-panel-border)] bg-[var(--v2-card-bg)] p-3 shadow-[var(--v2-card-shadow)]"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--v2-accent-text)]"
          >
            Connect ${connectAction.display_name || channel}
          </div>
        </div>
        ${onDismiss &&
        html`
          <button
            type="button"
            aria-label="Dismiss connect action"
            onClick=${onDismiss}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] text-[var(--v2-text-muted)] hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text-strong)]"
          >
            <${Icon} name="close" className="h-4 w-4" />
          </button>
        `}
      </div>

      ${channel === 'slack' && connectAction.strategy === 'inbound_proof_code'
        ? html`<${SlackPairingSection} action=${connectAction.action} />`
        : connectAction.strategy === 'extension_setup_link'
          ? html`
              <div
                className="rounded-[8px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] p-4 text-xs leading-5 text-[var(--v2-text-muted)]"
                data-testid="connector-recovery-card"
              >
                <p>${connectAction.action?.instructions || 'Open Connections to finish setup.'}</p>
                <a
                  href=${connectAction.action?.href || '/extensions/registry'}
                  className="v2-button mt-3 inline-flex items-center gap-1.5 rounded-[7px] border border-[color-mix(in_srgb,var(--v2-accent)_30%,var(--v2-panel-border))] bg-[var(--v2-accent-soft)] px-3 py-2 text-xs font-medium text-[var(--v2-accent-text)] hover:bg-[color-mix(in_srgb,var(--v2-accent)_16%,transparent)]"
                >
                  ${connectAction.action?.label || 'Open setup'}
                  <${Icon} name="chevron" className="h-3 w-3 -rotate-90" />
                </a>
              </div>
            `
          : html`
              <div
                className="rounded-[8px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] p-4 text-xs leading-5 text-[var(--v2-text-muted)]"
              >
                ${connectAction.action?.instructions ||
                'This channel exposes a connect action, but the WebUI has no renderer for its strategy yet.'}
              </div>
            `}
    </div>
  `;
}
