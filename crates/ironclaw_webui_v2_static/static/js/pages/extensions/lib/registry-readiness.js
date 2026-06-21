import { connectorFamily, connectorKey, googleOauthSettingsHref } from './extension-actions.js';
import {
  ACCEPTANCE_WORKFLOWS,
  CORE_CONNECTIONS,
  WORKBENCH_SOURCE_FAMILIES
} from './registry-catalog.js';

export function packageId(entry) {
  const ref = entry?.package_ref || entry?.packageRef;
  if (typeof ref === 'string') return ref;
  return ref?.id || '';
}

export function projectedConnectPhase(entry) {
  return entry?.connectPhase || entry?.connect_phase || null;
}

function extensionState(entry) {
  return (
    entry?.onboarding_state ||
    entry?.activation_status ||
    entry?.state ||
    (entry?.active ? 'active' : 'installed')
  );
}

function coreConnectionForFamily(family) {
  return connectionBySurfaceId(family.surfaceId);
}

function sourceMatchesFamily(source, family) {
  const connection = coreConnectionForFamily(family);
  const familyKeys = catalogKeys(connection);
  familyKeys.add(family.surfaceId);
  familyKeys.add(family.id);

  if (family.id === 'drive') {
    familyKeys.add('drive');
    familyKeys.add('google-drive');
    familyKeys.add('tools/google_drive');
  }
  if (family.id === 'sheets') {
    familyKeys.add('sheets');
    familyKeys.add('google-sheets');
    familyKeys.add('tools/google_sheets');
  }
  if (family.id === 'calendar') {
    familyKeys.add('calendar');
    familyKeys.add('google-calendar');
    familyKeys.add('tools/google_calendar');
  }

  const sourceKeys = catalogKeys(source);
  sourceKeys.add(connectorKey(source));
  return Array.from(sourceKeys).some((key) => familyKeys.has(key));
}

function readinessButtonForPhase(family, entry, phase) {
  const isGoogle = connectorFamily(entry) === 'google';

  if (phase === 'blocked-google-client-id' || (isGoogle && phase === 'needs-token')) {
    return {
      kind: 'link',
      label: 'Open Google setup',
      href: googleOauthSettingsHref(),
      variant: 'secondary'
    };
  }

  if (phase === 'needs-token') {
    return {
      kind: 'manual_setup',
      label: family.setupLabel || 'Open setup',
      entry,
      variant: 'secondary'
    };
  }

  if (phase === 'error') {
    return {
      kind: 'connect',
      label: family.reconnectLabel || `Reconnect ${family.displayName}`,
      entry,
      variant: 'primary'
    };
  }

  if (
    phase === 'installing' ||
    phase === 'authorizing' ||
    phase === 'waiting' ||
    phase === 'activating'
  ) {
    return { kind: 'none', label: 'In progress', disabled: true, variant: 'secondary' };
  }

  if (phase === 'connected') {
    return { kind: 'none', label: 'Ready', disabled: true, variant: 'secondary' };
  }

  return {
    kind: 'connect',
    label: family.connectLabel || `Connect ${family.displayName}`,
    entry,
    variant: 'secondary'
  };
}

function sourceReadinessFromPhase(family, entry, phaseState, catalogUnavailable) {
  const phase = typeof phaseState === 'string' ? phaseState : phaseState?.phase || '';
  const message =
    phaseState?.message || entry?.connectPhase?.message || entry?.connect_phase?.message;
  const bodyForSetup =
    message ||
    (family.id === 'notion'
      ? 'Finish Notion setup before team knowledge can be searched.'
      : 'Finish setup before this source can be used in workbench requests.');

  if (phase === 'blocked-google-client-id') {
    return {
      state: 'blocked',
      statusLabel: 'Blocked by setup',
      tone: 'danger',
      body:
        message ||
        'Google sign-in needs a Desktop app client ID before browser authorization can start.',
      nextAction: 'Next: add Google sign-in setup',
      action: readinessButtonForPhase(family, entry, phase),
      priority: 0
    };
  }

  if (phase === 'needs-token') {
    const isGoogle = connectorFamily(entry) === 'google';
    if (isGoogle) {
      return {
        state: 'blocked',
        statusLabel: 'Blocked by setup',
        tone: 'danger',
        body:
          message ||
          'Google sign-in needs a Desktop app client ID before browser authorization can start.',
        nextAction: 'Next: add Google sign-in setup',
        action: readinessButtonForPhase(family, entry, phase),
        priority: 0
      };
    }

    return {
      state: 'needs-setup',
      statusLabel: family.id === 'notion' ? 'Blocked by setup' : 'Needs setup',
      tone: 'warning',
      body: bodyForSetup,
      nextAction: `Next: ${family.setupLabel || 'open setup'}`,
      action: readinessButtonForPhase(family, entry, phase),
      priority: 0
    };
  }

  if (phase === 'error') {
    return {
      state: 'needs-reconnect',
      statusLabel: 'Needs reconnect',
      tone: 'danger',
      body: message || `${family.displayName} needs a fresh connection before work can use it.`,
      nextAction: `Next: ${family.reconnectLabel || `reconnect ${family.displayName}`}`,
      action: readinessButtonForPhase(family, entry, phase),
      priority: 0
    };
  }

  if (
    phase === 'installing' ||
    phase === 'authorizing' ||
    phase === 'waiting' ||
    phase === 'activating'
  ) {
    return {
      state: 'in-progress',
      statusLabel: 'Setup in progress',
      tone: 'warning',
      body: `${family.displayName} setup has started. Finish the current setup step before using it in work.`,
      nextAction: 'Next: finish the current setup step',
      action: readinessButtonForPhase(family, entry, phase),
      priority: 1
    };
  }

  if (phase === 'connected') {
    return {
      state: 'ready',
      statusLabel: 'Ready',
      tone: 'positive',
      body: family.readyBody,
      nextAction: 'Next: use in a workbench request',
      action: readinessButtonForPhase(family, entry, phase),
      priority: 5
    };
  }

  return {
    state: catalogUnavailable ? 'catalog-unavailable' : 'available',
    statusLabel: catalogUnavailable ? 'Catalog unavailable' : 'Available',
    tone: catalogUnavailable ? 'warning' : 'muted',
    body: catalogUnavailable
      ? `${family.displayName} cannot be connected until the app catalog responds.`
      : family.availableBody,
    nextAction: catalogUnavailable
      ? 'Next: wait for the app catalog'
      : `Next: ${family.connectLabel || `connect ${family.displayName}`} when needed`,
    action: catalogUnavailable
      ? { kind: 'none', label: 'Waiting on catalog', disabled: true, variant: 'secondary' }
      : readinessButtonForPhase(family, entry, phase),
    priority: catalogUnavailable ? 2 : 4
  };
}

function sourceReadinessFromInstalled(family, installed) {
  const state = extensionState(installed);
  const error = installed?.activation_error || installed?.error || installed?.message;

  if (state === 'active' || state === 'ready') {
    return {
      state: 'ready',
      statusLabel: 'Ready',
      tone: 'positive',
      body: family.readyBody,
      nextAction: 'Next: use in a workbench request',
      action: { kind: 'none', label: 'Ready', disabled: true, variant: 'secondary' },
      priority: 5
    };
  }

  if (state === 'failed') {
    return {
      state: 'needs-reconnect',
      statusLabel: 'Needs reconnect',
      tone: 'danger',
      body: error || `${family.displayName} needs a fresh connection before work can use it.`,
      nextAction: `Next: ${family.reconnectLabel || `reconnect ${family.displayName}`}`,
      action: {
        kind: 'manual_setup',
        label: family.reconnectLabel || `Reconnect ${family.displayName}`,
        entry: installed,
        variant: 'primary'
      },
      priority: 0
    };
  }

  if (
    state === 'auth_required' ||
    state === 'setup_required' ||
    state === 'installed' ||
    state === 'inactive' ||
    state === 'pairing_required' ||
    state === 'pairing'
  ) {
    const isGoogle = connectorFamily(installed) === 'google';
    const isSlack = family.id === 'slack';
    return {
      state: isSlack ? 'needs-reconnect' : 'needs-setup',
      statusLabel: isSlack ? 'Needs reconnect' : 'Blocked by setup',
      tone: 'warning',
      body: isSlack
        ? 'Reconnect or finish Slack pairing before channel work can run.'
        : `${family.displayName} setup or activation must finish before work can use it.`,
      nextAction: isGoogle
        ? 'Next: add Google sign-in setup'
        : `Next: ${family.setupLabel || family.reconnectLabel || 'open setup'}`,
      action: isGoogle
        ? {
            kind: 'link',
            label: 'Open Google setup',
            href: googleOauthSettingsHref(),
            variant: 'secondary'
          }
        : {
            kind: 'manual_setup',
            label: family.setupLabel || family.reconnectLabel || 'Open setup',
            entry: installed,
            variant: 'secondary'
          },
      priority: 0
    };
  }

  return null;
}

export function sourceFamilyReadiness({
  family,
  gatewayOffline = false,
  catalogUnavailable = false,
  availableEntries = [],
  installedExtensions = [],
  connectState = {}
}) {
  const connection = coreConnectionForFamily(family);
  const iconSource = {
    ...(connection || {}),
    id: family.surfaceId,
    display_name: family.displayName
  };

  if (family.builtin) {
    const label = family.builtinStatusLabel || 'Readable';
    return {
      id: family.id,
      displayName: family.displayName,
      category: family.category,
      iconSource,
      state: 'readable',
      statusLabel: label,
      tone: 'positive',
      body: family.readyBody,
      nextAction: family.builtinNextAction || 'Next: attach or reference local files in chat',
      action: { kind: 'none', label, disabled: true, variant: 'secondary' },
      priority: 6
    };
  }

  if (gatewayOffline) {
    return {
      id: family.id,
      displayName: family.displayName,
      category: family.category,
      iconSource,
      state: 'gateway-offline',
      statusLabel: 'Gateway offline',
      tone: 'warning',
      body: `${family.displayName} setup cannot start until the local gateway responds.`,
      nextAction: 'Next: reconnect the local gateway',
      action: { kind: 'none', label: 'Gateway offline', disabled: true, variant: 'secondary' },
      priority: 1
    };
  }

  const installed = installedExtensions.find((entry) => sourceMatchesFamily(entry, family));
  const installedReadiness = installed ? sourceReadinessFromInstalled(family, installed) : null;
  if (installedReadiness) {
    return {
      id: family.id,
      displayName: family.displayName,
      category: family.category,
      iconSource: installed,
      ...installedReadiness
    };
  }

  const registryEntry = availableEntries.find((entry) => sourceMatchesFamily(entry, family));
  if (!registryEntry) {
    return {
      id: family.id,
      displayName: family.displayName,
      category: family.category,
      iconSource,
      state: catalogUnavailable ? 'catalog-unavailable' : 'not-in-catalog',
      statusLabel: catalogUnavailable ? 'Catalog unavailable' : 'Not in catalog',
      tone: 'warning',
      body: catalogUnavailable
        ? `${family.displayName} cannot be connected until the app catalog responds.`
        : `${family.displayName} was not advertised by this gateway catalog.`,
      nextAction: catalogUnavailable
        ? 'Next: wait for the app catalog'
        : 'Next: check this gateway source catalog',
      action: {
        kind: 'none',
        label: catalogUnavailable ? 'Waiting on catalog' : 'Unavailable',
        disabled: true,
        variant: 'secondary'
      },
      priority: catalogUnavailable ? 2 : 3
    };
  }

  const phase = connectState[packageId(registryEntry)] || projectedConnectPhase(registryEntry);
  return {
    id: family.id,
    displayName: family.displayName,
    category: family.category,
    iconSource: registryEntry,
    ...sourceReadinessFromPhase(family, registryEntry, phase, catalogUnavailable)
  };
}

export function sourceReadinessItems({
  gatewayOffline = false,
  catalogUnavailable = false,
  availableEntries = [],
  installedExtensions = [],
  connectState = {}
} = {}) {
  return WORKBENCH_SOURCE_FAMILIES.map((family, order) => ({
    order,
    ...sourceFamilyReadiness({
      family,
      gatewayOffline,
      catalogUnavailable,
      availableEntries,
      installedExtensions,
      connectState
    })
  })).sort((a, b) => a.priority - b.priority || a.order - b.order);
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

function connectionBySurfaceId(surfaceId) {
  return CORE_CONNECTIONS.find((entry) => entry.id === surfaceId) || null;
}

function catalogKeys(entry) {
  const keys = new Set();
  if (!entry) return keys;
  if (entry.id) keys.add(String(entry.id));
  if (entry.package_ref?.id) keys.add(String(entry.package_ref.id));
  if (entry.packageRef?.id) keys.add(String(entry.packageRef.id));
  if (typeof entry.package_ref === 'string') keys.add(entry.package_ref);
  if (typeof entry.packageRef === 'string') keys.add(entry.packageRef);
  return keys;
}

export function acceptanceWorkflowStatus({ gatewayOffline, catalogUnavailable, availableEntries }) {
  if (gatewayOffline) return 'Gateway offline';
  if (catalogUnavailable) return 'Waiting on app catalog';
  if (Array.isArray(availableEntries) && availableEntries.length > 0) return 'Catalog loaded';
  return 'Connect required apps';
}

export function workflowCatalogStatus(
  workflow,
  { gatewayOffline = false, catalogUnavailable = false, availableEntries = [] } = {}
) {
  if (gatewayOffline) {
    return { label: 'Gateway offline', tone: 'warning', missingSurfaces: [] };
  }
  if (catalogUnavailable) {
    return { label: 'Waiting on app catalog', tone: 'muted', missingSurfaces: [] };
  }

  const availableKeys = new Set(
    availableEntries.flatMap((entry) => Array.from(catalogKeys(entry)))
  );
  const missingSurfaces = (workflow?.surfaces || []).filter((surfaceId) => {
    const connection = connectionBySurfaceId(surfaceId);
    if (!connection?.package_ref) return false;
    const requiredKeys = catalogKeys(connection);
    return !Array.from(requiredKeys).some((key) => availableKeys.has(key));
  });

  if (missingSurfaces.length > 0) {
    const label =
      missingSurfaces.length === 1
        ? '1 app missing from catalog'
        : `${missingSurfaces.length} apps missing from catalog`;
    return { label, tone: 'warning', missingSurfaces };
  }

  return { label: 'Ready to connect', tone: 'positive', missingSurfaces: [] };
}

export { ACCEPTANCE_WORKFLOWS, CORE_CONNECTIONS, WORKBENCH_SOURCE_FAMILIES };
