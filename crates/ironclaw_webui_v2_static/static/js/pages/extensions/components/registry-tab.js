import { Link } from 'react-router';
import { Button } from '../../../design-system/button.js';
import { Input } from '../../../design-system/input.js';
import { React, html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';
import { ACCEPTANCE_WORKFLOWS, CORE_CONNECTIONS } from '../lib/registry-catalog.js';
import {
  acceptanceWorkflowStatus,
  coreConnectionButtonState,
  coreConnectionKindLabel,
  packageId,
  projectedConnectPhase,
  sourceReadinessItems,
  workflowCatalogStatus
} from '../lib/registry-readiness.js';
import { useConnectExtension } from '../hooks/useExtensions.js';
import { ConnectorAppIcon, RegistryCard, StatusText } from './extension-card.js';

export function RegistryTab({
  toolRegistry,
  channelRegistry,
  mcpRegistry,
  installedExtensions = [],
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
      installedExtensions=${installedExtensions}
      onManualSetup=${openManualSetup}
      onInstall=${onInstall}
      isBusy=${isBusy}
    />`;
  }

  const readinessItems = sourceReadinessItems({
    availableEntries: allAvailable,
    installedExtensions,
    connectState
  });

  return html`
    <div className="space-y-8">
      <${SourceReadinessPanel}
        items=${readinessItems}
        isBusy=${isBusy}
        onConnect=${connect}
        onManualSetup=${openManualSetup}
      />

      <div className="flex items-center gap-3">
        <${Input}
          type="text"
          value=${filter}
          onChange=${(e) => setFilter(e.target.value)}
          placeholder=${t('ext.registry.searchPlaceholder')}
          size="sm"
          className="min-h-[44px] flex-1"
        />
        <span className="v2-text-meta tabular-nums">
          ${filtered.length} / ${allAvailable.length}
        </span>
      </div>

      <section>
        <div className="v2-text-label">${t('ext.registry.availableTitle')}</div>
        ${filtered.length === 0
          ? html`<p className="py-4 v2-text-body text-[var(--v2-text-muted)]">
              ${t('ext.registry.noMatch')}
            </p>`
          : html`<div className="mt-2 grid grid-cols-1">
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
      </section>
      <${AcceptanceWorkflowsPanel}
        gatewayOffline=${false}
        catalogUnavailable=${false}
        availableEntries=${allAvailable}
      />
    </div>
  `;
}

function CoreConnectionsEmpty({
  loadError,
  installedExtensions = [],
  onManualSetup,
  onInstall,
  isBusy
}) {
  const gatewayOffline = Boolean(loadError);
  const catalogUnavailable = !gatewayOffline && installedExtensions.length === 0;
  const readinessItems = sourceReadinessItems({
    gatewayOffline,
    catalogUnavailable,
    installedExtensions
  });
  return html`
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between gap-3">
          <div className="v2-text-label">Core connections</div>
          <${StatusText}
            label=${gatewayOffline
              ? 'Gateway offline'
              : catalogUnavailable
                ? 'Catalog unavailable'
                : 'Catalog empty'}
            tone="warning"
          />
        </div>
        <p className="mt-2 max-w-2xl v2-text-body text-[var(--v2-text-muted)]">
          ${gatewayOffline
            ? 'The local gateway is still starting or unavailable. The apps are shown so setup feels predictable; connect buttons unlock when the gateway responds.'
            : catalogUnavailable
              ? 'This gateway did not expose installable app catalog entries yet. The source list stays honest about what can be connected now.'
              : 'Installed sources are shown first; missing catalog entries stay marked unavailable instead of pretending they are ready.'}
        </p>
      </section>

      <${SourceReadinessPanel}
        items=${readinessItems}
        isBusy=${isBusy}
        onManualSetup=${onManualSetup}
      />

      <div className="grid grid-cols-1">
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
      <${AcceptanceWorkflowsPanel}
        gatewayOffline=${gatewayOffline}
        catalogUnavailable=${catalogUnavailable}
      />
    </div>
  `;
}

const READINESS_NEEDS_YOU_STATES = new Set([
  'blocked',
  'needs-setup',
  'needs-reconnect',
  'gateway-offline'
]);

function readinessStatusTone(tone) {
  if (tone === 'danger') return 'danger';
  if (tone === 'warning') return 'warning';
  if (tone === 'positive') return 'success';
  return 'muted';
}

// One depth: source readiness is a single bordered section of de-boxed hairline
// rows, not a shadowed panel full of nested cards. Sources that need the user
// are grouped into a "Needs you" focal zone at the top with a tone left-rail;
// available/readable sources sit quietly below.
function SourceReadinessPanel({ items = [], isBusy = false, onConnect, onManualSetup }) {
  if (!items.length) return null;
  const needsYou = items.filter((item) => READINESS_NEEDS_YOU_STATES.has(item.state));
  const ready = items.filter((item) => !READINESS_NEEDS_YOU_STATES.has(item.state));

  const renderRow = (item) => html`
    <${SourceReadinessRow}
      key=${item.id}
      item=${item}
      isBusy=${isBusy}
      onConnect=${onConnect}
      onManualSetup=${onManualSetup}
    />
  `;

  return html`
    <section
      data-testid="source-readiness-panel"
      aria-labelledby="source-readiness-heading"
      className="space-y-6"
    >
      <h3
        id="source-readiness-heading"
        className=${[
          'v2-text-label',
          needsYou.length > 0 ? 'text-[var(--v2-warning-text)]' : ''
        ].join(' ')}
      >
        ${needsYou.length > 0 ? 'Fix blocked sources first.' : 'Sources'}
      </h3>
      ${needsYou.length > 0 &&
      html`
        <div>
          <h4 className="v2-text-label text-[var(--v2-warning-text)]">Needs you</h4>
          <div className="mt-2 grid grid-cols-1">${needsYou.map(renderRow)}</div>
        </div>
      `}
      ${ready.length > 0 &&
      html`
        <div>
          <h4 className="v2-text-label">${needsYou.length > 0 ? 'Sources' : 'All sources'}</h4>
          <div className="mt-2 grid grid-cols-1">${ready.map(renderRow)}</div>
        </div>
      `}
    </section>
  `;
}

function SourceReadinessRow({ item, isBusy, onConnect, onManualSetup }) {
  const action = item.action || {};
  const missingHandler =
    (action.kind === 'connect' && !onConnect) || (action.kind === 'manual_setup' && !onManualSetup);
  const disabled = Boolean(isBusy || action.disabled || missingHandler);
  const needsYou = READINESS_NEEDS_YOU_STATES.has(item.state);
  const runAction = () => {
    if (disabled) return;
    if (action.kind === 'connect' && action.entry && onConnect) {
      onConnect(action.entry);
    }
    if (action.kind === 'manual_setup' && action.entry && onManualSetup) {
      onManualSetup(action.entry);
    }
  };

  const railClass =
    item.tone === 'danger'
      ? '-mx-3 rounded-[var(--v2-radius-control)] border-l-2 border-[var(--v2-danger-text)] bg-[var(--v2-danger-soft)] px-3'
      : needsYou
        ? '-mx-3 rounded-[var(--v2-radius-control)] border-l-2 border-[var(--v2-warning-text)] bg-[var(--v2-warning-soft)] px-3'
        : 'border-t border-[var(--v2-panel-border)] first:border-t-0';

  return html`
    <div
      data-testid=${`source-readiness-${item.id}`}
      data-readiness-state=${item.state}
      className=${['flex min-w-0 flex-col py-4', railClass].join(' ')}
    >
      <div className="flex min-w-0 items-start gap-3">
        <${ConnectorAppIcon} source=${item.iconSource} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 truncate v2-text-section text-[var(--v2-text-strong)]">
              ${item.displayName}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2">
            <${StatusText} label=${item.statusLabel} tone=${readinessStatusTone(item.tone)} />
            <span className="v2-text-meta">${item.category}</span>
          </div>
        </div>
      </div>

      ${item.body &&
      html`<p className="mt-2 v2-text-body text-[var(--v2-text-muted)]">${item.body}</p>`}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 v2-text-body text-[var(--v2-text-faint)]">${item.nextAction}</p>
        ${action.kind === 'link' &&
        html`
          <${Button}
            as="a"
            href=${action.href}
            variant=${needsYou ? 'primary' : action.variant || 'secondary'}
            size="sm"
            className="min-h-[44px] w-full px-3 sm:w-auto"
          >
            ${action.label}
          <//>
        `}
        ${action.kind !== 'link' &&
        html`
          <${Button}
            type="button"
            variant=${needsYou ? 'primary' : action.variant || 'secondary'}
            size="sm"
            disabled=${disabled}
            onClick=${runAction}
            className="min-h-[44px] w-full px-3 sm:w-auto"
          >
            ${action.label || 'No action'}
          <//>
        `}
      </div>
    </div>
  `;
}

function AcceptanceWorkflowsPanel({ gatewayOffline, catalogUnavailable, availableEntries = [] }) {
  const connectionsById = Object.fromEntries(CORE_CONNECTIONS.map((entry) => [entry.id, entry]));
  const status = acceptanceWorkflowStatus({
    gatewayOffline,
    catalogUnavailable,
    availableEntries
  });

  return html`
    <section data-testid="acceptance-workflows">
      <div className="flex items-center justify-between gap-3">
        <div className="v2-text-label">Chief-of-staff workflows</div>
        <${StatusText}
          label=${status}
          tone=${gatewayOffline || catalogUnavailable ? 'warning' : 'muted'}
        />
      </div>
      <p className="mt-2 max-w-2xl v2-text-body text-[var(--v2-text-muted)]">
        These are the work loops the connection layer should unlock once the required apps are
        configured.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
        ${ACCEPTANCE_WORKFLOWS.map((workflow) => {
          const workflowStatus = workflowCatalogStatus(workflow, {
            gatewayOffline,
            catalogUnavailable,
            availableEntries
          });
          const missingSurfaceSet = new Set(workflowStatus.missingSurfaces);
          return html`
            <article
              key=${workflow.id}
              data-testid="acceptance-workflow-card"
              className="flex h-full flex-col rounded-[var(--v2-radius-card)] border border-[var(--v2-panel-border)] bg-[var(--v2-surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="v2-text-section text-[var(--v2-text-strong)]">
                    ${workflow.title}
                  </h4>
                  <p className="mt-1 v2-text-body text-[var(--v2-text-muted)]">
                    ${workflow.outcome}
                  </p>
                </div>
                <span className="shrink-0 v2-text-meta">${workflow.surfaces.length} apps</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                ${workflow.surfaces.map((surface) => {
                  const connection = connectionsById[surface];
                  return html`
                    <span
                      key=${surface}
                      data-workflow-surface-state=${missingSurfaceSet.has(surface)
                        ? 'missing'
                        : 'available'}
                      className=${[
                        'inline-flex items-center gap-1.5 rounded-[var(--v2-radius-control)] border py-1 pl-1 pr-2 v2-text-meta',
                        missingSurfaceSet.has(surface)
                          ? 'border-[color-mix(in_srgb,var(--v2-warning-text)_34%,var(--v2-panel-border))] bg-[var(--v2-warning-soft)] text-[var(--v2-warning-text)]'
                          : 'border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] text-[var(--v2-text-muted)]'
                      ].join(' ')}
                    >
                      <${ConnectorAppIcon}
                        source=${connection}
                        className="h-5 w-5 rounded-[var(--v2-radius-control)]"
                      />
                      <span>${connection?.display_name || surface}</span>
                    </span>
                  `;
                })}
              </div>

              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                <${StatusText}
                  label=${workflowStatus.label}
                  tone=${workflowStatus.tone === 'positive'
                    ? 'success'
                    : workflowStatus.tone === 'warning'
                      ? 'warning'
                      : 'muted'}
                />
                <${Link}
                  to="/chat"
                  state=${{ composerDraft: workflow.prompt }}
                  aria-label=${`Draft prompt for ${workflow.title}`}
                  data-workflow-status-tone=${workflowStatus.tone}
                  className="inline-flex h-11 shrink-0 items-center rounded-[var(--v2-radius-control)] px-3 v2-text-label text-[var(--v2-accent-text)] hover:bg-[var(--v2-surface-soft)]"
                >
                  Draft prompt
                <//>
              </div>
            </article>
          `;
        })}
      </div>
    </section>
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
    <article className="border-t border-[var(--v2-panel-border)] py-4 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <${ConnectorAppIcon} source=${entry} />
          <div className="min-w-0">
            <h4 className="v2-text-section text-[var(--v2-text-strong)]">${entry.display_name}</h4>
            <p className="mt-1 v2-text-body text-[var(--v2-text-muted)]">${entry.description}</p>
          </div>
        </div>
        <span className="shrink-0 v2-text-meta">${coreConnectionKindLabel(entry)}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          ${(entry.keywords || [])
            .slice(0, 3)
            .map(
              (keyword) => html`
                <span
                  key=${keyword}
                  className="rounded-[var(--v2-radius-control)] bg-[var(--v2-surface-soft)] px-2 py-0.5 v2-text-meta text-[var(--v2-text-muted)]"
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
          className="min-h-[44px] shrink-0 px-3.5"
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
