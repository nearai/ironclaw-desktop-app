import { React, html } from '../../../lib/html.js';
import { Link } from 'react-router';
import { Button } from '../../../design-system/button.js';
import { Card, CardLabel } from '../../../design-system/card.js';
import { Icon } from '../../../design-system/icons.js';
import { Input } from '../../../design-system/input.js';
import { useT } from '../../../lib/i18n.js';
import { ConnectorAppIcon, RegistryCard } from './extension-card.js';
import { useConnectExtension } from '../hooks/useExtensions.js';
import {
  connectorFamily,
  connectorKey,
  googleOauthSettingsHref
} from '../lib/extension-actions.js';

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

export const WORKBENCH_SOURCE_FAMILIES = [
  {
    id: 'gmail',
    surfaceId: 'gmail',
    displayName: 'Gmail',
    category: 'Email',
    availableBody: 'Email can be connected when a task needs inbox context or drafts.',
    readyBody: 'Email is ready for workbench requests that need inbox context or drafts.',
    connectLabel: 'Connect Gmail'
  },
  {
    id: 'calendar',
    surfaceId: 'google-calendar',
    displayName: 'Calendar',
    category: 'Calendar',
    availableBody: 'Calendar can be connected when a task needs meeting context or timing.',
    readyBody: 'Calendar is ready for meeting prep and schedule-aware routines.',
    connectLabel: 'Connect Calendar'
  },
  {
    id: 'slack',
    surfaceId: 'slack',
    displayName: 'Slack',
    category: 'Messaging',
    availableBody: 'Slack can be connected when a task needs channel context or replies.',
    readyBody: 'Slack is ready for channel summaries, prepared replies, and urgent asks.',
    connectLabel: 'Connect Slack',
    reconnectLabel: 'Reconnect Slack'
  },
  {
    id: 'telegram',
    surfaceId: 'telegram',
    displayName: 'Telegram',
    category: 'Messaging',
    availableBody: 'Telegram can be connected when a task needs bot delivery or digests.',
    readyBody: 'Telegram is ready for scheduled digests and bot delivery.',
    connectLabel: 'Connect Telegram',
    reconnectLabel: 'Reconnect Telegram'
  },
  {
    id: 'notion',
    surfaceId: 'notion',
    displayName: 'Notion',
    category: 'Knowledge app',
    availableBody: 'Notion can be connected when a task needs team knowledge or pages.',
    readyBody: 'Notion is ready for team knowledge search and page drafting.',
    connectLabel: 'Connect Notion',
    setupLabel: 'Open Notion setup'
  },
  {
    id: 'drive',
    surfaceId: 'google-drive',
    displayName: 'Drive',
    category: 'Docs',
    availableBody: 'Drive can be connected when a task needs documents or folders.',
    readyBody: 'Drive is ready for document-grounded prep and summaries.',
    connectLabel: 'Connect Drive'
  },
  {
    id: 'sheets',
    surfaceId: 'google-sheets',
    displayName: 'Sheets',
    category: 'Spreadsheet',
    availableBody: 'Sheets can be connected when a task needs tracker rows or CRM updates.',
    readyBody: 'Sheets is ready for tracker rows, bug logs, and CRM updates.',
    connectLabel: 'Connect Sheets'
  },
  {
    id: 'github',
    surfaceId: 'github',
    displayName: 'GitHub',
    category: 'Code',
    availableBody: 'GitHub can be connected when a task needs issues, releases, or repos.',
    readyBody: 'GitHub is ready for issues, releases, and repo context.',
    connectLabel: 'Connect GitHub'
  },
  {
    id: 'web',
    surfaceId: 'web-http',
    displayName: 'Web & HTTP',
    category: 'Research',
    builtin: true,
    availableBody: 'Web and HTTP checks run through the gateway when web access is available.',
    readyBody: 'Web and HTTP checks are available for public search and endpoint health.',
    builtinStatusLabel: 'Available',
    builtinNextAction: 'Next: ask chat to search or check an endpoint'
  },
  {
    id: 'routines',
    surfaceId: 'routines',
    displayName: 'Routines',
    category: 'Schedule',
    builtin: true,
    availableBody: 'Routines are saved from scheduled chat prompts and listed in Scheduled.',
    readyBody: 'Routines are available for recurring checks, prep, and delivery loops.',
    builtinStatusLabel: 'Available',
    builtinNextAction: 'Next: ask chat to run something on a schedule'
  },
  {
    id: 'workspace',
    surfaceId: 'workspace',
    displayName: 'Local workspace',
    category: 'Files',
    builtin: true,
    availableBody: 'Local workspace files are readable when a task needs project context.',
    readyBody: 'Local workspace files are readable when a task needs project context.'
  }
];

export const ACCEPTANCE_WORKFLOWS = [
  {
    id: 'daily-news-digest',
    title: 'Daily news digest',
    outcome: 'Find NEAR AI news, summarize it, and deliver a short Telegram digest on a routine.',
    surfaces: ['telegram', 'web-http', 'routines'],
    prompt:
      "Create a recurring Telegram digest of the most important NEAR AI news. Start by drafting today's summary, then schedule the routine."
  },
  {
    id: 'calendar-prep-assistant',
    title: 'Calendar prep assistant',
    outcome:
      'Prepare meeting briefs from Gmail, Calendar, Drive documents, public news, and a timed routine.',
    surfaces: ['gmail', 'google-calendar', 'google-drive', 'web-http', 'routines'],
    prompt:
      'Thirty minutes before my next meeting, prepare a company brief from Gmail, Calendar, Drive docs, and recent news.'
  },
  {
    id: 'deployment-health-watcher',
    title: 'Deployment health watcher',
    outcome: 'Ping an endpoint on a schedule and send a Slack DM when health checks fail.',
    surfaces: ['slack', 'web-http', 'routines'],
    prompt:
      'Watch a deployment endpoint every five minutes and DM me in Slack if the status is not healthy.'
  },
  {
    id: 'competitor-release-tracker',
    title: 'Competitor release tracker',
    outcome: 'Watch GitHub releases, summarize meaningful changes, and email the result.',
    surfaces: ['gmail', 'github', 'routines'],
    prompt:
      'Track competitor GitHub releases, summarize meaningful changes, and email me a recurring update.'
  },
  {
    id: 'slack-ama',
    title: 'AMA in Slack',
    outcome:
      'Answer Slack questions from a Drive strategy document without losing source grounding.',
    surfaces: ['slack', 'google-drive'],
    prompt:
      'Use the strategy document in Drive as a knowledge base and answer Slack DMs with grounded answers.'
  },
  {
    id: 'crm-inbound-tracker',
    title: 'CRM inbound tracker',
    outcome: 'Find inbound Gmail from near.ai domains and append structured rows to Google Sheets.',
    surfaces: ['gmail', 'google-sheets', 'routines'],
    prompt:
      'Every thirty minutes, find new near.ai-domain inbound emails and append the right fields to a Google Sheet.'
  },
  {
    id: 'slack-sheet-bug-logger',
    title: 'Slack to Sheet bug logger',
    outcome: 'Turn Slack messages that start with "bug:" into rows in a product bug spreadsheet.',
    surfaces: ['slack', 'google-sheets', 'routines'],
    prompt:
      'Watch the product Slack channel for messages that start with bug: and append them to a Google Sheet.'
  },
  {
    id: 'hn-keyword-monitor',
    title: 'HN keyword monitor',
    outcome:
      'Search Hacker News for IronClaw and NEAR AI mentions and send Slack summaries hourly.',
    surfaces: ['slack', 'web-http', 'routines'],
    prompt:
      'Search Hacker News hourly for IronClaw or NEAR AI mentions and send a concise Slack summary.'
  }
];

function packageId(entry) {
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
  if (phase === 'blocked-google-client-id') {
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
        : `${family.displayName} setup must finish before work can use it.`,
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
    <div className="space-y-4">
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
    <div className="space-y-4">
      <section
        className="rounded-[18px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface)] p-5 shadow-[var(--v2-shadow-sm)] sm:p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p
              className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--v2-accent-text)]"
            >
              Source setup
            </p>
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
            ${gatewayOffline
              ? 'Gateway offline'
              : catalogUnavailable
                ? 'Catalog unavailable'
                : 'Catalog empty'}
          </div>
        </div>
      </section>

      <${SourceReadinessPanel}
        items=${readinessItems}
        isBusy=${isBusy}
        onManualSetup=${onManualSetup}
      />

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
    <section
      data-testid="acceptance-workflows"
      className="rounded-[18px] border border-[var(--v2-panel-border)] bg-[var(--v2-card-bg)] p-5 shadow-[var(--v2-shadow-sm)] sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p
            className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--v2-accent-text)]"
          >
            Chief-of-staff workflows
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[var(--v2-text-strong)]">
            Start from outcomes, not app setup.
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--v2-text-muted)]">
            These are the work loops the connection layer should unlock once the required apps are
            configured.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 rounded-full border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--v2-text-muted)]"
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
                    'text-xs',
                    workflowStatus.tone === 'positive'
                      ? 'font-semibold text-[var(--v2-positive-text)]'
                      : workflowStatus.tone === 'warning'
                        ? 'font-semibold text-[var(--v2-warning-text)]'
                        : 'text-[var(--v2-text-faint)]'
                  ].join(' ')}
                >
                  ${workflowStatus.label}
                </span>
                <${Link}
                  to="/chat"
                  state=${{ composerDraft: workflow.prompt }}
                  aria-label=${`Draft prompt for ${workflow.title}`}
                  className="inline-flex h-11 shrink-0 items-center rounded-[8px] border border-[var(--v2-panel-border)] bg-[var(--v2-surface-soft)] px-3 text-xs font-semibold text-[var(--v2-text-strong)] hover:border-[color-mix(in_srgb,var(--v2-accent)_45%,var(--v2-panel-border))] hover:text-[var(--v2-accent-text)]"
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
