import { Link } from 'react-router';
import { Button } from '../../../design-system/button.js';
import { CardLabel } from '../../../design-system/card.js';
import { Icon } from '../../../design-system/icons.js';
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
import { ConnectorAppIcon, RegistryCard } from './extension-card.js';

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
        <span className="text-[11px] tabular-nums text-[var(--v2-text-faint)]">
          ${filtered.length} / ${allAvailable.length}
        </span>
      </div>

      <section>
        <${CardLabel}>${t('ext.registry.availableTitle')}<//>
        ${filtered.length === 0
          ? html`<p className="py-4 text-sm text-[var(--v2-text-muted)]">
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <${CardLabel}>Core connections<//>
            <h3 className="mt-2 text-xl font-semibold text-[var(--v2-text-strong)]">
              Start with sources that need action.
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--v2-text-muted)]">
              ${gatewayOffline
                ? 'The local gateway is still starting or unavailable. The apps are shown so setup feels predictable; connect buttons unlock when the gateway responds.'
                : catalogUnavailable
                  ? 'This gateway did not expose installable app catalog entries yet. The source list stays honest about what can be connected now.'
                  : 'Installed sources are shown first; missing catalog entries stay marked unavailable instead of pretending they are ready.'}
            </p>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--v2-warning-text)_34%,var(--v2-panel-border))] bg-[var(--v2-warning-soft)] px-3 py-1.5 text-xs font-medium text-[var(--v2-warning-text)]"
          >
            <${Icon}
              name=${gatewayOffline || catalogUnavailable ? 'pulse' : 'check'}
              className="h-3.5 w-3.5"
            />
            ${gatewayOffline
              ? 'Gateway offline'
              : catalogUnavailable
                ? 'Catalog unavailable'
                : 'Catalog empty'}
          </span>
        </div>
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

function readinessToneClasses(tone) {
  if (tone === 'danger') {
    return 'border-[color-mix(in_srgb,var(--v2-danger-text)_36%,var(--v2-panel-border))] bg-[var(--v2-danger-soft)] text-[var(--v2-danger-text)]';
  }
  if (tone === 'warning') {
    return 'border-[color-mix(in_srgb,var(--v2-warning-text)_36%,var(--v2-panel-border))] bg-[var(--v2-warning-soft)] text-[var(--v2-warning-text)]';
  }
  if (tone === 'positive') {
    return 'border-[color-mix(in_srgb,var(--v2-positive-text)_36%,var(--v2-panel-border))] bg-[var(--v2-positive-soft)] text-[var(--v2-positive-text)]';
  }
  return 'border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] text-[var(--v2-text-muted)]';
}

function SourceReadinessPanel({ items = [], isBusy = false, onConnect, onManualSetup }) {
  if (!items.length) return null;
  const hasActionNeeded = items.some(
    (item) =>
      item.state === 'blocked' ||
      item.state === 'needs-setup' ||
      item.state === 'needs-reconnect' ||
      item.state === 'gateway-offline'
  );

  return html`
    <section
      data-testid="source-readiness-panel"
      className="rounded-[18px] border border-[var(--v2-panel-border)] bg-[var(--v2-card-bg)] p-5 shadow-[var(--v2-shadow-sm)] sm:p-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p
            className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--v2-accent-text)]"
          >
            Source readiness
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[var(--v2-text-strong)]">
            ${hasActionNeeded ? 'Fix blocked sources first.' : 'Sources stay quiet until needed.'}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--v2-text-muted)]">
            IronClaw shows the next setup step for sources that need attention and leaves available
            sources as workbench options.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        ${items.map(
          (item) => html`
            <${SourceReadinessCard}
              key=${item.id}
              item=${item}
              isBusy=${isBusy}
              onConnect=${onConnect}
              onManualSetup=${onManualSetup}
            />
          `
        )}
      </div>
    </section>
  `;
}

function SourceReadinessCard({ item, isBusy, onConnect, onManualSetup }) {
  const action = item.action || {};
  const missingHandler =
    (action.kind === 'connect' && !onConnect) || (action.kind === 'manual_setup' && !onManualSetup);
  const disabled = Boolean(isBusy || action.disabled || missingHandler);
  const runAction = () => {
    if (disabled) return;
    if (action.kind === 'connect' && action.entry && onConnect) {
      onConnect(action.entry);
    }
    if (action.kind === 'manual_setup' && action.entry && onManualSetup) {
      onManualSetup(action.entry);
    }
  };

  return html`
    <article
      data-testid=${`source-readiness-${item.id}`}
      data-readiness-state=${item.state}
      className="flex min-w-0 flex-col rounded-[14px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface)] p-4"
    >
      <div className="flex min-w-0 items-start gap-3">
        <${ConnectorAppIcon} source=${item.iconSource} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="min-w-0 truncate text-sm font-semibold text-[var(--v2-text-strong)]">
              ${item.displayName}
            </div>
            <span
              className=${[
                'inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                readinessToneClasses(item.tone)
              ].join(' ')}
            >
              ${item.statusLabel}
            </span>
          </div>
          <p
            className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--v2-text-faint)]"
          >
            ${item.category}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--v2-text-muted)]">${item.body}</p>

      <div
        className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="min-w-0 text-xs leading-5 text-[var(--v2-text-faint)]">${item.nextAction}</p>
        ${action.kind === 'link' &&
        html`
          <${Button}
            as="a"
            href=${action.href}
            variant=${action.variant || 'secondary'}
            size="sm"
            className="min-h-[44px] w-full px-3 text-xs sm:w-auto"
          >
            ${action.label}
          <//>
        `}
        ${action.kind !== 'link' &&
        html`
          <${Button}
            type="button"
            variant=${action.variant || 'secondary'}
            size="sm"
            disabled=${disabled}
            onClick=${runAction}
            className="min-h-[44px] w-full px-3 text-xs sm:w-auto"
          >
            ${action.label || 'No action'}
          <//>
        `}
      </div>
    </article>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <${CardLabel}>Chief-of-staff workflows<//>
          <h3 className="mt-2 text-xl font-semibold text-[var(--v2-text-strong)]">
            Start from outcomes, not app setup.
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--v2-text-muted)]">
            These are the work loops the connection layer should unlock once the required apps are
            configured.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-full border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-3 py-1.5 text-xs font-medium text-[var(--v2-text-muted)]"
        >
          <${Icon}
            name=${gatewayOffline || catalogUnavailable ? 'pulse' : 'check'}
            className="h-3.5 w-3.5"
          />
          ${status}
        </span>
      </div>

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
              className="flex h-full flex-col rounded-[14px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-base font-semibold text-[var(--v2-text-strong)]">
                    ${workflow.title}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-[var(--v2-text-muted)]">
                    ${workflow.outcome}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full bg-[var(--v2-surface-soft)] px-2 py-1 text-[11px] font-medium text-[var(--v2-text-faint)]"
                >
                  ${workflow.surfaces.length} apps
                </span>
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
                        'inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2 text-[11px] font-medium',
                        missingSurfaceSet.has(surface)
                          ? 'border-[color-mix(in_srgb,var(--v2-warning-text)_34%,var(--v2-panel-border))] bg-[var(--v2-warning-soft)] text-[var(--v2-warning-text)]'
                          : 'border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] text-[var(--v2-text-muted)]'
                      ].join(' ')}
                    >
                      <${ConnectorAppIcon} source=${connection} className="h-5 w-5 rounded-[6px]" />
                      <span>${connection?.display_name || surface}</span>
                    </span>
                  `;
                })}
              </div>

              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                <span
                  data-workflow-status-tone=${workflowStatus.tone}
                  className=${[
                    'text-xs font-medium',
                    workflowStatus.tone === 'positive'
                      ? 'text-[var(--v2-positive-text)]'
                      : workflowStatus.tone === 'warning'
                        ? 'text-[var(--v2-warning-text)]'
                        : 'text-[var(--v2-text-faint)] font-normal'
                  ].join(' ')}
                >
                  ${workflowStatus.label}
                </span>
                <${Link}
                  to="/chat"
                  state=${{ composerDraft: workflow.prompt }}
                  aria-label=${`Draft prompt for ${workflow.title}`}
                  className="inline-flex h-11 shrink-0 items-center rounded-[8px] px-3 text-xs font-medium text-[var(--v2-accent-text)] hover:bg-[var(--v2-surface-soft)]"
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
            <h4 className="text-sm font-semibold text-[var(--v2-text-strong)]">
              ${entry.display_name}
            </h4>
            <p className="mt-1 text-sm leading-6 text-[var(--v2-text-muted)]">
              ${entry.description}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-xs text-[var(--v2-text-faint)]">
          ${coreConnectionKindLabel(entry)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          ${(entry.keywords || [])
            .slice(0, 3)
            .map(
              (keyword) => html`
                <span
                  key=${keyword}
                  className="rounded-[6px] bg-[var(--v2-surface-soft)] px-2 py-0.5 text-[11px] text-[var(--v2-text-muted)]"
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
