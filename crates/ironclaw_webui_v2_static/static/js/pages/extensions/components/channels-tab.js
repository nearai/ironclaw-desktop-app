import { StatusPill } from '../../../design-system/primitives.js';
import { html } from '../../../lib/html.js';
import { ExtensionCard, RegistryCard } from './extension-card.js';
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
  const {
    enabled: slackEnabled,
    connectAction: slackConnectAction,
    statusLabel: slackStatusLabel,
    statusTone: slackStatusTone
  } = deriveSlackMessagingState({ gatewayOffline, enabledChannels, connectableChannels });

  return html`
    <div className="space-y-5">
      ${gatewayOffline &&
      html`
        <div
          className="rounded-[14px] border border-[color-mix(in_srgb,var(--v2-warning-text)_34%,var(--v2-panel-border))] bg-[var(--v2-warning-soft)] px-4 py-3 text-sm leading-6 text-[var(--v2-warning-text)]"
          role="status"
        >
          IronClaw cannot reach the local gateway yet. Messaging setup will unlock when the gateway
          is available.
        </div>
      `}
      <div className="v2-panel rounded-[18px] p-5 sm:p-6">
        <h3 className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-signal">
          Built-in messaging paths
        </h3>
        <${BuiltinRow}
          name="Desktop chat"
          description="The live chat connection used by this app"
          enabled=${!gatewayOffline}
          statusLabel=${gatewayOffline ? 'unavailable' : 'on'}
          statusTone=${gatewayOffline ? 'warning' : 'success'}
          detail=${'SSE: ' +
          (status.sse_connections || 0) +
          ' · WS: ' +
          (status.ws_connections || 0)}
        />
        <${BuiltinRow}
          name="External webhook"
          description="A controlled inbound path for approved external events"
          enabled=${!gatewayOffline && enabledChannels.includes('http')}
          statusLabel=${gatewayOffline ? 'unavailable' : undefined}
          statusTone=${gatewayOffline ? 'warning' : undefined}
          detail=${gatewayOffline ? null : 'ENABLE_HTTP=true'}
        />
        <${BuiltinRow}
          name="Slack"
          description="DMs and app mentions from the workspace Slack app"
          enabled=${slackEnabled}
          statusLabel=${slackStatusLabel}
          statusTone=${slackStatusTone}
          detail=${gatewayOffline ? null : 'Workspace Slack app'}
        >
          ${slackConnectAction &&
          html`<${PairingSection}
            channel="slack"
            redeemFn=${redeemPairingCode}
            i18nKeys=${SLACK_PAIRING_I18N_KEYS}
            copy=${slackConnectAction.action}
            queryKeys=${SLACK_PAIRING_QUERY_KEYS}
            showPendingRequests=${false}
          />`}
        <//>
        <${BuiltinRow}
          name="CLI"
          description="Local operator console for development and debugging"
          enabled=${!gatewayOffline && enabledChannels.includes('cli')}
          statusLabel=${gatewayOffline ? 'unavailable' : undefined}
          statusTone=${gatewayOffline ? 'warning' : undefined}
          detail=${gatewayOffline ? null : 'ironclaw run --cli'}
        />
        <${BuiltinRow}
          name="Developer console"
          description="Low-level local testing path"
          enabled=${!gatewayOffline && enabledChannels.includes('repl')}
          statusLabel=${gatewayOffline ? 'unavailable' : undefined}
          statusTone=${gatewayOffline ? 'warning' : undefined}
          detail=${gatewayOffline ? null : 'ironclaw run --repl'}
        />
      </div>

      ${channels.length > 0 &&
      html`
        <div className="v2-panel rounded-[18px] p-5 sm:p-6">
          <h3 className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-signal">
            Connected messaging apps
          </h3>
          <div className="grid grid-cols-1 gap-4">
            ${channels.map(
              (ch) => html`
                <div key=${packageId(ch)} className="flex flex-col gap-3">
                  <${ExtensionCard}
                    ext=${ch}
                    onActivate=${onActivate}
                    onConfigure=${onConfigure}
                    onRemove=${onRemove}
                    isBusy=${isBusy}
                  />
                  ${(ch.onboarding_state === 'pairing_required' ||
                    ch.onboarding_state === 'pairing') &&
                  html` <${PairingSection} channel=${packageId(ch)} /> `}
                </div>
              `
            )}
          </div>
        </div>
      `}
      ${channelRegistry.length > 0 &&
      html`
        <div className="v2-panel rounded-[18px] p-5 sm:p-6">
          <h3 className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-signal">
            Available messaging apps
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
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
        </div>
      `}
    </div>
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
  return html`
    <div className="border-t border-white/[0.06] py-4 first:border-0 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-iron-200">${name}</span>
            <${StatusPill} tone=${statusTone} label=${statusLabel} />
          </div>
          <div className="mt-1 text-xs text-iron-300">${description}</div>
          ${detail &&
          html`<div className="mt-1 font-mono text-[11px] text-iron-700">${detail}</div>`}
        </div>
      </div>
      ${children}
    </div>
  `;
}
