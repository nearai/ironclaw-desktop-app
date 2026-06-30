import { SlackPairingSection } from '../../../components/slack-pairing-section.js';
import { Button } from '../../../design-system/button.js';
import { Icon } from '../../../design-system/icons.js';
import { appScopedPath } from '../../../lib/app-path.js';
import { html } from '../../../lib/html.js';

export function ChannelConnectCard({ connectAction, onDismiss }) {
  if (!connectAction) return null;
  const channel = connectAction.channel;

  return html`
    <div
      className="rounded-[14px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] p-3"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-[var(--v2-text-muted)]">
            Connect ${connectAction.display_name || channel}
          </div>
        </div>
        ${onDismiss &&
        html`
          <button
            type="button"
            aria-label="Dismiss connect action"
            onClick=${onDismiss}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[var(--v2-text-faint)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text-strong)]"
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
                className="text-xs leading-5 text-[var(--v2-text-muted)]"
                data-testid="connector-recovery-card"
              >
                <p>${connectAction.action?.instructions || 'Open Connections to finish setup.'}</p>
                <a
                  href=${connectAction.action?.href || '/extensions/registry'}
                  className="v2-button mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--v2-accent-text)] hover:underline"
                >
                  ${connectAction.action?.label || 'Open setup'}
                  <${Icon} name="chevron" className="h-3 w-3 -rotate-90" />
                </a>
              </div>
            `
          : html`
              <div className="grid gap-3 text-xs leading-5 text-[var(--v2-text-muted)]">
                <p>
                  ${connectAction.action?.instructions ||
                  `Finish connecting ${
                    connectAction.display_name || channel
                  } from the Connections page.`}
                </p>
                <${Button}
                  as="a"
                  href=${appScopedPath('/extensions/registry')}
                  variant="secondary"
                  size="sm"
                  className="w-fit"
                >
                  Open Connections
                  <${Icon} name="chevron" className="ml-1.5 h-3 w-3 -rotate-90" />
                <//>
              </div>
            `}
    </div>
  `;
}
