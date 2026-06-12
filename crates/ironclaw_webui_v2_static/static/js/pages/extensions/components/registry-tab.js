import { React, html } from '../../../lib/html.js';
import { Button } from '../../../design-system/button.js';
import { Card, CardLabel } from '../../../design-system/card.js';
import { Icon } from '../../../design-system/icons.js';
import { Input } from '../../../design-system/input.js';
import { useT } from '../../../lib/i18n.js';
import { ConnectorAppIcon, RegistryCard } from './extension-card.js';
import { useConnectExtension } from '../hooks/useExtensions.js';

export const CORE_CONNECTIONS = [
  {
    id: 'gmail',
    display_name: 'Gmail',
    kind: 'wasm_tool',
    description: 'Read, triage, draft, and prepare email work with approval gates.',
    package_ref: { kind: 'extension', id: 'tools/gmail' },
    keywords: ['email', 'google', 'inbox']
  },
  {
    id: 'google-calendar',
    display_name: 'Google Calendar',
    kind: 'wasm_tool',
    description: 'Find meetings, protect focus blocks, and prepare schedule changes.',
    package_ref: { kind: 'extension', id: 'tools/google_calendar' },
    keywords: ['calendar', 'google', 'schedule']
  },
  {
    id: 'google-drive',
    display_name: 'Google Drive',
    kind: 'wasm_tool',
    description: 'Ground prep, summaries, and answers in Drive documents and folders.',
    package_ref: { kind: 'extension', id: 'tools/google_drive' },
    keywords: ['drive', 'docs', 'files']
  },
  {
    id: 'google-sheets',
    display_name: 'Google Sheets',
    kind: 'wasm_tool',
    description: 'Append CRM rows, bug reports, and recurring tracker output to Sheets.',
    package_ref: { kind: 'extension', id: 'tools/google_sheets' },
    keywords: ['sheets', 'spreadsheet', 'crm']
  },
  {
    id: 'notion',
    display_name: 'Notion',
    kind: 'mcp_server',
    description: 'Search team knowledge, draft pages, and keep decisions visible.',
    package_ref: { kind: 'extension', id: 'mcp-servers/notion' },
    keywords: ['knowledge', 'docs', 'wiki']
  },
  {
    id: 'slack',
    display_name: 'Slack',
    kind: 'wasm_channel',
    description: 'Summarize channels, prepare replies, and surface urgent asks.',
    package_ref: { kind: 'extension', id: 'channels/slack' },
    keywords: ['messages', 'team', 'channels']
  },
  {
    id: 'telegram',
    display_name: 'Telegram',
    kind: 'wasm_channel',
    description: 'Send scheduled digests and bot messages through Telegram.',
    package_ref: { kind: 'extension', id: 'channels/telegram' },
    keywords: ['bot', 'news', 'dm']
  },
  {
    id: 'github',
    display_name: 'GitHub',
    kind: 'wasm_tool',
    description: 'Watch releases, summarize changes, and route follow-up tasks.',
    package_ref: { kind: 'extension', id: 'tools/github' },
    keywords: ['releases', 'issues', 'code']
  },
  {
    id: 'web-http',
    display_name: 'Web & HTTP',
    kind: 'builtin',
    description: 'Fetch pages, search public sources, and watch endpoint health.',
    package_ref: null,
    keywords: ['web', 'http', 'monitor']
  },
  {
    id: 'routines',
    display_name: 'Routines',
    kind: 'builtin',
    description: 'Schedule recurring checks, prep work, and delivery loops.',
    package_ref: null,
    keywords: ['schedule', 'trigger', 'automation']
  },
  {
    id: 'workspace',
    display_name: 'Workspace files',
    kind: 'builtin',
    description: 'Use local documents, spreadsheets, PDFs, and generated work products in chat.',
    package_ref: null,
    keywords: ['files', 'documents', 'exports']
  }
];

function packageId(entry) {
  return entry.package_ref?.id || '';
}

export function projectedConnectPhase(entry) {
  return entry?.connectPhase || entry?.connect_phase || null;
}

export function coreConnectionButtonState({ entry, gatewayOffline, catalogUnavailable, isBusy }) {
  if (!entry.package_ref) return { disabled: true, label: 'Built in' };
  if (gatewayOffline) return { disabled: true, label: 'Gateway offline' };
  if (catalogUnavailable) return { disabled: true, label: 'Not available' };
  if (isBusy) return { disabled: true, label: 'Connect' };
  return { disabled: false, label: 'Connect' };
}

export function coreConnectionKindLabel(entry) {
  if (entry.id === 'web-http') return 'Web';
  if (entry.id === 'routines') return 'Routine';
  if (entry.id === 'workspace') return 'Files';
  if (entry.kind === 'mcp_server') return 'Knowledge';
  if (entry.kind === 'wasm_channel') return 'Messaging';
  if (entry.kind === 'builtin') return 'Built-in';
  return 'Tool';
}

export function RegistryTab({
  toolRegistry,
  channelRegistry,
  mcpRegistry,
  loadError,
  onInstall,
  onConfigure,
  isBusy
}) {
  const t = useT();
  const { connect, connectState } = useConnectExtension();
  const allAvailable = [...toolRegistry, ...channelRegistry, ...mcpRegistry];
  const [filter, setFilter] = React.useState('');

  const filtered = filter
    ? allAvailable.filter(
        (e) =>
          (e.display_name || packageId(e)).toLowerCase().includes(filter.toLowerCase()) ||
          (e.description || '').toLowerCase().includes(filter.toLowerCase()) ||
          (e.keywords || []).some((kw) => kw.toLowerCase().includes(filter.toLowerCase()))
      )
    : allAvailable;
  const openManualSetup = React.useCallback(
    (entry) => {
      if (!entry?.package_ref || !onConfigure) return;
      onConfigure({
        packageRef: entry.package_ref,
        displayName: entry.display_name || packageId(entry)
      });
    },
    [onConfigure]
  );

  if (allAvailable.length === 0) {
    return html`<${CoreConnectionsEmpty}
      loadError=${loadError}
      onInstall=${onInstall}
      isBusy=${isBusy}
    />`;
  }

  return html`
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <${Input}
          type="text"
          value=${filter}
          onChange=${(e) => setFilter(e.target.value)}
          placeholder=${t('ext.registry.searchPlaceholder')}
          size="sm"
          className="flex-1"
        />
        <span className="font-mono text-[11px] text-[var(--v2-text-faint)]">
          ${filtered.length} / ${allAvailable.length}
        </span>
      </div>

      <${Card} variant="bordered" radius="lg" padding="md">
        <${CardLabel} className="mb-4 text-[var(--v2-accent-text)]">
          ${t('ext.registry.availableTitle')}
        <//>
        ${filtered.length === 0
          ? html`<p className="py-4 text-sm text-[var(--v2-text-muted)]">
              ${t('ext.registry.noMatch')}
            </p>`
          : html`<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              ${filtered.map(
                (entry) => html`
                  <${RegistryCard}
                    key=${packageId(entry)}
                    entry=${entry}
                    onConnect=${connect}
                    onManualSetup=${openManualSetup}
                    connectPhase=${connectState[packageId(entry)] || projectedConnectPhase(entry)}
                    onInstall=${onInstall}
                    isBusy=${isBusy}
                  />
                `
              )}
            </div>`}
      <//>
    </div>
  `;
}

function CoreConnectionsEmpty({ loadError, onInstall, isBusy }) {
  const gatewayOffline = Boolean(loadError);
  const catalogUnavailable = !gatewayOffline;
  return html`
    <div className="space-y-4">
      <section
        className="rounded-[18px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface)] p-5 shadow-[var(--v2-shadow-sm)] sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p
              className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--v2-accent-text)]"
            >
              Core connections
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[var(--v2-text-strong)]">
              Connect the tools IronClaw should handle for you.
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--v2-text-muted)]">
              ${gatewayOffline
                ? 'The local gateway is still starting or unavailable. The apps are shown so setup feels predictable; connect buttons unlock when the gateway responds.'
                : 'This gateway did not expose installable app catalog entries yet. These are the high-leverage connections IronClaw should support when the catalog is available.'}
            </p>
          </div>
          <div
            className=${[
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
              gatewayOffline || catalogUnavailable
                ? 'border-[color-mix(in_srgb,var(--v2-warning-text)_34%,var(--v2-panel-border))] bg-[var(--v2-warning-soft)] text-[var(--v2-warning-text)]'
                : 'border-[color-mix(in_srgb,var(--v2-positive-text)_34%,var(--v2-panel-border))] bg-[var(--v2-positive-soft)] text-[var(--v2-positive-text)]'
            ].join(' ')}
          >
            <${Icon}
              name=${gatewayOffline || catalogUnavailable ? 'pulse' : 'check'}
              className="h-3.5 w-3.5"
            />
            ${gatewayOffline ? 'Gateway offline' : 'Catalog unavailable'}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${CORE_CONNECTIONS.map(
          (entry) => html`
            <${CoreConnectionCard}
              key=${entry.id}
              entry=${entry}
              gatewayOffline=${gatewayOffline}
              catalogUnavailable=${catalogUnavailable}
              isBusy=${isBusy}
              onInstall=${onInstall}
            />
          `
        )}
      </div>
    </div>
  `;
}

function CoreConnectionCard({ entry, gatewayOffline, catalogUnavailable, isBusy, onInstall }) {
  const canInstall = Boolean(entry.package_ref && onInstall);
  const { disabled, label } = coreConnectionButtonState({
    entry,
    gatewayOffline,
    catalogUnavailable,
    isBusy
  });
  return html`
    <article
      className="rounded-[16px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface)] p-4 shadow-[var(--v2-shadow-sm)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <${ConnectorAppIcon} source=${entry} />
          <div className="min-w-0">
            <h4 className="text-base font-semibold text-[var(--v2-text-strong)]">
              ${entry.display_name}
            </h4>
            <p className="mt-1 text-sm leading-6 text-[var(--v2-text-muted)]">
              ${entry.description}
            </p>
          </div>
        </div>
        <span
          className="rounded-full bg-[var(--v2-surface-soft)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--v2-text-faint)]"
        >
          ${coreConnectionKindLabel(entry)}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          ${(entry.keywords || [])
            .slice(0, 3)
            .map(
              (keyword) => html`
                <span
                  key=${keyword}
                  className="rounded-full bg-[var(--v2-surface-soft)] px-2 py-1 text-[11px] text-[var(--v2-text-muted)]"
                >
                  ${keyword}
                </span>
              `
            )}
        </div>
        <${Button}
          type="button"
          variant=${canInstall && !disabled ? 'primary' : 'secondary'}
          size="sm"
          disabled=${disabled}
          onClick=${() =>
            canInstall &&
            onInstall({ packageRef: entry.package_ref, displayName: entry.display_name })}
        >
          ${label}
        <//>
      </div>
    </article>
  `;
}
