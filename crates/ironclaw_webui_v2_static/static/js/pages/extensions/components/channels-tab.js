import { React, html } from '../../../lib/html.js';
import { Icon } from '../../../design-system/icons.js';
import { SlackChannelPicker } from '../../../components/slack-channel-picker.js';
import { SlackPairingSection } from '../../../components/slack-pairing-section.js';
import { ExtensionCard, RegistryCard, StatusText, groupByReadiness } from './extension-card.js';
import { PairingSection } from './pairing-section.js';
import { redeemPairingCode } from '../lib/pairing-api.js';

const SLACK_PAIRING_I18N_KEYS = {
  title: 'pairing.slackTitle',
  instructions: 'pairing.slackInstructions',
  placeholder: 'pairing.slackPlaceholder',
  action: 'pairing.connect',
  success: 'pairing.slackSuccess',
  error: 'pairing.slackError',
  empty: 'pairing.none'
};

const SLACK_PAIRING_QUERY_KEYS = [['extensions'], ['pairing', 'slack'], ['connectable-channels']];

function packageId(item) {
  return item.package_ref?.id || '';
}

export function isSlackChannelEnabled(enabledChannels) {
  return ['slack', 'slack_v2', 'slack-v2'].some((channel) => enabledChannels.includes(channel));
}

export function isSlackPackage(item) {
  return packageId(item) === 'slack';
}

export function isSlackAdminManagedAction(connectAction) {
  return connectAction?.channel === 'slack' && connectAction.strategy === 'admin_managed_channels';
}

export function isSlackInboundProofCodeAction(connectAction) {
  return connectAction?.channel === 'slack' && connectAction.strategy === 'inbound_proof_code';
}

export function findSlackConnectActions(connectableChannels) {
  const channels = connectableChannels || [];
  const actions = [
    channels.find(isSlackAdminManagedAction),
    channels.find(isSlackInboundProofCodeAction)
  ].filter(Boolean);
  if (actions.length > 0) return actions;
  const fallback = channels.find((channel) => channel.channel === 'slack');
  return fallback ? [fallback] : [];
}

function SlackConnectActionSections({ actions }) {
  const sections = (actions || [])
    .map((action) => {
      if (isSlackAdminManagedAction(action)) {
        return html`<${SlackChannelPicker} key="admin-managed" action=${action.action} />`;
      }
      if (isSlackInboundProofCodeAction(action)) {
        return html`<${SlackPairingSection} key="inbound-proof" action=${action.action} />`;
      }
      return null;
    })
    .filter(Boolean);
  return sections.length > 0 ? html`<div className="space-y-3">${sections}</div>` : null;
}

// Desktop chat is "on" only when a live transport is actually connected.
// Gateway reachability alone (no SSE/WS) is honest-neutral, not green —
// "SSE: 0 · WS: 0" must never sit next to a success pill.
export function deriveDesktopChatState({ gatewayOffline, sseConnections, wsConnections }) {
  if (gatewayOffline) {
    return { enabled: false, statusLabel: 'unavailable', statusTone: 'warning' };
  }
  const liveConnections = (sseConnections || 0) + (wsConnections || 0);
  if (liveConnections > 0) {
    return { enabled: true, statusLabel: 'on', statusTone: 'success' };
  }
  return { enabled: false, statusLabel: 'idle', statusTone: 'muted' };
}

export function deriveSlackMessagingState({
  gatewayOffline,
  enabledChannels,
  connectableChannels
}) {
  if (gatewayOffline) {
    return {
      enabled: false,
      connectAction: null,
      statusLabel: 'unavailable',
      statusTone: 'warning'
    };
  }
  const enabled = isSlackChannelEnabled(enabledChannels);
  const connectAction = connectableChannels?.find((channel) => channel.channel === 'slack');
  return {
    enabled,
    connectAction,
    statusLabel: enabled ? 'on' : connectAction ? 'connect' : 'off',
    statusTone: enabled ? 'success' : connectAction ? 'info' : 'muted'
  };
}

export function ChannelsTab({
  status,
  channels,
  connectableChannels,
  channelRegistry,
  loadError,
  onActivate,
  onConfigure,
  onRemove,
  onInstall,
  isBusy
}) {
  const gatewayOffline = Boolean(loadError);
  const enabledChannels = status.enabled_channels || [];
  const slackConnectActions = findSlackConnectActions(connectableChannels);
  const hasInstalledSlackPackage = channels.some(isSlackPackage);
  const {
    enabled: slackEnabled,
    connectAction: slackConnectAction,
    statusLabel: slackStatusLabel,
    statusTone: slackStatusTone
  } = deriveSlackMessagingState({ gatewayOffline, enabledChannels, connectableChannels });
  const {
    enabled: desktopChatEnabled,
    statusLabel: desktopChatStatusLabel,
    statusTone: desktopChatStatusTone
  } = deriveDesktopChatState({
    gatewayOffline,
    sseConnections: status.sse_connections,
    wsConnections: status.ws_connections
  });

  const { needsYou, healthy } = groupByReadiness(channels);

  const renderChannelRow = (ch) => html`
    <div key=${packageId(ch)} className="flex flex-col gap-3">
      <${ExtensionCard}
        ext=${ch}
        onActivate=${onActivate}
        onConfigure=${onConfigure}
        onRemove=${onRemove}
        isBusy=${isBusy}
      />
      ${isSlackPackage(ch) &&
      html`<${SlackConnectActionSections} actions=${slackConnectActions} />`}
      ${(ch.onboarding_state === 'pairing_required' || ch.onboarding_state === 'pairing') &&
      html` <${PairingSection} channel=${packageId(ch)} /> `}
    </div>
  `;

  return html`
    <div className="space-y-8">
      ${gatewayOffline &&
      html`
        <div
          className="rounded-[var(--v2-radius-card)] border-l-2 border-[var(--v2-warning-text)] bg-[var(--v2-warning-soft)] px-4 py-3 v2-text-body text-[var(--v2-warning-text)]"
          role="status"
        >
          IronClaw cannot reach the local gateway yet. Messaging setup will unlock when the gateway
          is available.
        </div>
      `}

      <section>
        <div className="v2-text-label">Connect messaging</div>
        <div className="mt-2">
          <${BuiltinRow}
            name="Slack"
            description="DMs and app mentions from the workspace Slack app"
            enabled=${slackEnabled}
            statusLabel=${slackStatusLabel}
            statusTone=${slackStatusTone}
            detail=${gatewayOffline ? null : 'Workspace Slack app'}
          >
            ${!hasInstalledSlackPackage &&
            html`
              <${SlackConnectActionSections} actions=${slackConnectActions} />
              ${slackConnectAction &&
              !slackConnectActions.some(
                (action) =>
                  isSlackAdminManagedAction(action) || isSlackInboundProofCodeAction(action)
              ) &&
              html`<${PairingSection}
                channel="slack"
                redeemFn=${redeemPairingCode}
                i18nKeys=${SLACK_PAIRING_I18N_KEYS}
                copy=${slackConnectAction.action}
                queryKeys=${SLACK_PAIRING_QUERY_KEYS}
                showPendingRequests=${false}
              />`}
            `}
          <//>
          <${BuiltinRow}
            name="Desktop chat"
            description="The live chat connection used by this app"
            enabled=${desktopChatEnabled}
            statusLabel=${desktopChatStatusLabel}
            statusTone=${desktopChatStatusTone}
            detail=${'SSE: ' +
            (status.sse_connections || 0) +
            ' · WS: ' +
            (status.ws_connections || 0)}
          />
        </div>
      </section>

      ${needsYou.length > 0 &&
      html`
        <section>
          <div className="v2-text-label text-[var(--v2-warning-text)]">Needs you</div>
          <div className="mt-2 grid grid-cols-1 gap-4">${needsYou.map(renderChannelRow)}</div>
        </section>
      `}
      ${healthy.length > 0 &&
      html`
        <section>
          <div className="v2-text-label">Connected messaging apps</div>
          <div className="mt-2 grid grid-cols-1 gap-4">${healthy.map(renderChannelRow)}</div>
        </section>
      `}
      ${channelRegistry.length > 0 &&
      html`
        <section>
          <div className="v2-text-label">Available messaging apps</div>
          <div className="mt-2 grid grid-cols-1">
            ${channelRegistry.map(
              (entry) => html`
                <${RegistryCard}
                  key=${packageId(entry)}
                  entry=${entry}
                  onInstall=${onInstall}
                  isBusy=${isBusy}
                />
              `
            )}
          </div>
        </section>
      `}

      <${DeveloperPaths} gatewayOffline=${gatewayOffline} enabledChannels=${enabledChannels} />
    </div>
  `;
}

// Developer inbound paths (webhook / CLI / REPL) are escape hatches, not the
// common path. They collapse into one "Advanced" disclosure below the primary
// connect so the resting surface leads with Slack.
function DeveloperPaths({ gatewayOffline, enabledChannels }) {
  const [open, setOpen] = React.useState(false);
  return html`
    <section className="border-t border-[var(--v2-panel-border)] pt-6">
      <button
        type="button"
        aria-expanded=${open ? 'true' : 'false'}
        aria-controls="channels-developer-panel"
        onClick=${() => setOpen((v) => !v)}
        className="flex min-h-[44px] w-full items-center gap-1.5 rounded-[var(--v2-radius-control)] text-left"
      >
        <${Icon}
          name="chevron"
          aria-hidden="true"
          className=${['h-3.5 w-3.5 text-[var(--v2-text-faint)]', open ? 'rotate-180' : ''].join(
            ' '
          )}
        />
        <span className="v2-text-label">Advanced: developer paths</span>
      </button>
      ${open &&
      html`
        <div id="channels-developer-panel" className="mt-2">
          <${BuiltinRow}
            name="External webhook"
            description="A controlled inbound path for approved external events"
            enabled=${!gatewayOffline && enabledChannels.includes('http')}
            statusLabel=${gatewayOffline ? 'unavailable' : undefined}
            statusTone=${gatewayOffline ? 'warning' : undefined}
            detail=${gatewayOffline ? null : 'ENABLE_HTTP=true'}
          />
          <${BuiltinRow}
            name="CLI"
            description="Local command bridge for development and debugging"
            enabled=${!gatewayOffline && enabledChannels.includes('cli')}
            statusLabel=${gatewayOffline ? 'unavailable' : undefined}
            statusTone=${gatewayOffline ? 'warning' : undefined}
            detail=${gatewayOffline ? null : 'ironclaw run --cli'}
          />
          <${BuiltinRow}
            name="Developer bridge"
            description="Low-level local testing path"
            enabled=${!gatewayOffline && enabledChannels.includes('repl')}
            statusLabel=${gatewayOffline ? 'unavailable' : undefined}
            statusTone=${gatewayOffline ? 'warning' : undefined}
            detail=${gatewayOffline ? null : 'ironclaw run --repl'}
          />
        </div>
      `}
    </section>
  `;
}

function BuiltinRow({
  name,
  description,
  enabled,
  detail,
  children,
  statusLabel = enabled ? 'on' : 'off',
  statusTone = enabled ? 'success' : 'muted'
}) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  return html`
    <div className="border-t border-[var(--v2-panel-border)] py-4 first:border-0 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="v2-text-section text-[var(--v2-text-strong)]">${name}</span>
          </div>
          <div className="mt-1">
            <${StatusText} label=${statusLabel} tone=${statusTone} live=${enabled} />
          </div>
          <div className="mt-1 v2-text-body text-[var(--v2-text-muted)]">${description}</div>
          ${detail &&
          html`
            <button
              type="button"
              aria-expanded=${detailsOpen ? 'true' : 'false'}
              onClick=${() => setDetailsOpen((v) => !v)}
              className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--v2-radius-control)] v2-text-meta hover:text-[var(--v2-accent-text)]"
            >
              <span>Details</span>
              <${Icon}
                name="chevron"
                aria-hidden="true"
                className=${['h-3 w-3', detailsOpen ? 'rotate-180' : ''].join(' ')}
              />
            </button>
            ${detailsOpen && html`<div className="mt-1 v2-text-meta">${detail}</div>`}
          `}
        </div>
      </div>
      ${children}
    </div>
  `;
}
