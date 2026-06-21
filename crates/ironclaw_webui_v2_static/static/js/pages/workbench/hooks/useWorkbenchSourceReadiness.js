import { React } from '../../../lib/html.js';
import { sourceReadinessItems } from '../../extensions/lib/registry-readiness.js';

const GENERIC_MCP_EXCLUDE_IDS = new Set(['nearai']);
const SOURCE_READY_STATES = new Set(['ready', 'readable']);

export function availableWorkbenchSourceEntries({
  toolRegistry,
  channelRegistry,
  mcpRegistry
} = {}) {
  return [...(toolRegistry || []), ...(channelRegistry || []), ...(mcpRegistry || [])];
}

function extensionKey(entry) {
  const ref = entry?.package_ref || entry?.packageRef || entry;
  const raw =
    (typeof ref === 'string' ? ref : ref?.id) ||
    entry?.id ||
    entry?.display_name ||
    entry?.name ||
    '';
  const catalogName = String(raw).includes('/')
    ? String(raw).split('/').filter(Boolean).pop()
    : String(raw);
  return catalogName.trim().toLowerCase().replaceAll('_', '-');
}

function extensionActive(entry) {
  const state =
    entry?.onboarding_state ||
    entry?.activation_status ||
    entry?.state ||
    (entry?.active && 'active');
  return state === 'active' || state === 'ready';
}

export function genericWorkbenchMcpReadiness(installedExtensions = []) {
  return (installedExtensions || [])
    .filter((entry) => entry?.kind === 'mcp_server')
    .filter((entry) => extensionActive(entry))
    .filter((entry) => !GENERIC_MCP_EXCLUDE_IDS.has(extensionKey(entry)))
    .map((entry, index) => {
      const displayName =
        entry.display_name || entry.name || extensionKey(entry) || 'Connected MCP';
      return {
        order: 100 + index,
        id: `mcp-${extensionKey(entry) || index}`,
        displayName,
        category: 'Connected MCP',
        iconSource: entry,
        state: 'ready',
        statusLabel: 'Ready',
        tone: 'positive',
        body: 'This MCP server is active. IronClaw can route matching requests through it; app-specific access is checked at run time.',
        nextAction:
          'Next: use Auto sources or describe the app/context you want IronClaw to inspect',
        action: { kind: 'none', label: 'Ready', disabled: true, variant: 'secondary' },
        priority: 5
      };
    });
}

export function deriveWorkbenchSourceReadiness({
  availableSourceEntries = [],
  extensions,
  isLoading,
  loadError,
  connectState
} = {}) {
  const installedExtensions = extensions || [];
  const familyReadiness = sourceReadinessItems({
    gatewayOffline: Boolean(loadError),
    catalogUnavailable: Boolean(
      !isLoading &&
      !loadError &&
      availableSourceEntries.length === 0 &&
      installedExtensions.length === 0
    ),
    availableEntries: availableSourceEntries,
    installedExtensions,
    connectState
  });
  const genericMcpReadiness = genericWorkbenchMcpReadiness(installedExtensions);
  return [...familyReadiness, ...genericMcpReadiness].sort(
    (a, b) => a.priority - b.priority || a.order - b.order
  );
}

export function sourceReadinessUsable(item) {
  return SOURCE_READY_STATES.has(item?.state);
}

export function useWorkbenchSourceReadiness(extensionsState = {}) {
  const {
    toolRegistry,
    channelRegistry,
    mcpRegistry,
    extensions,
    isLoading,
    loadError,
    connectState
  } = extensionsState || {};

  const availableSourceEntries = React.useMemo(
    () => availableWorkbenchSourceEntries({ toolRegistry, channelRegistry, mcpRegistry }),
    [channelRegistry, mcpRegistry, toolRegistry]
  );

  const sourceReadiness = React.useMemo(
    () =>
      deriveWorkbenchSourceReadiness({
        availableSourceEntries,
        extensions,
        isLoading,
        loadError,
        connectState
      }),
    [availableSourceEntries, extensions, isLoading, loadError, connectState]
  );

  return { availableSourceEntries, sourceReadiness };
}
