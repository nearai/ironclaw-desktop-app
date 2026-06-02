// Reborn connector bridge.
//
// The v2 facade does not yet expose legacy install/list/activate endpoints.
// Keep this page useful by showing the bundled Reborn connectors and wiring
// setup through Product Auth. Catalog refs such as `tools/gmail` are display
// metadata only; every lifecycle call is normalized to a bare ExtensionName.

import {
  canonicalExtensionName,
  setupExtension,
  setupManualToken,
  submitManualTokenSecret
} from '../../../lib/api.js';

const STATUS_KEY = 'ironclaw:extension-credential-status';

const BLOCKER_MESSAGES = {
  extension_auth_and_configure_not_yet_wired:
    'Backend can store this credential, but this connector runtime is not wired in this build yet.',
  extension_lifecycle_package_unavailable:
    'No bundled Reborn lifecycle package is available for this connector in this build.'
};

const BUNDLED_CONNECTORS = [
  {
    name: 'gmail',
    catalog_ref: 'tools/gmail',
    display_name: 'Gmail',
    version: 'bundled',
    kind: 'wasm_tool',
    provider: 'google',
    token_label: 'Google access token',
    default_account_label: 'Work Google',
    description: 'Read, draft, and send Gmail with approval-gated actions.',
    tools: ['gmail.list_messages', 'gmail.get_message', 'gmail.create_draft', 'gmail.send_message'],
    setup_instructions:
      'This desktop gateway currently exposes manual Product Auth token setup for Gmail. Paste a Google access token with Gmail scopes; IronClaw stores the secret through Reborn Product Auth and never sends it through chat.'
  },
  {
    name: 'google-calendar',
    catalog_ref: 'tools/google_calendar',
    display_name: 'Google Calendar',
    version: 'bundled',
    kind: 'wasm_tool',
    provider: 'google',
    token_label: 'Google access token',
    default_account_label: 'Work Google',
    description: 'Read calendars, find time, and draft or create events with approval.',
    tools: [
      'google-calendar.list_events',
      'google-calendar.find_free_slots',
      'google-calendar.create_event'
    ],
    setup_instructions:
      'This desktop gateway currently exposes manual Product Auth token setup for Calendar. Paste a Google access token with Calendar scopes; the same Google account can be reused for Gmail and Calendar.'
  },
  {
    name: 'notion',
    catalog_ref: 'mcp-servers/notion',
    display_name: 'Notion',
    version: 'bundled',
    kind: 'mcp_server',
    provider: 'notion',
    token_label: 'Notion integration token',
    default_account_label: 'Work Notion',
    description: 'Search, read, and update Notion through the bundled MCP server.',
    tools: [
      'notion.notion-search',
      'notion.notion-create-pages',
      'notion.notion-query-data-sources'
    ],
    setup_instructions:
      'Paste a Notion integration token. IronClaw stores it through Reborn Product Auth and binds it to the Notion MCP extension.'
  },
  {
    name: 'slack',
    catalog_ref: 'channels/slack',
    display_name: 'Slack',
    version: 'catalog',
    kind: 'wasm_channel',
    provider: 'slack',
    supported: false,
    removable: false,
    has_auth: false,
    description:
      'Slack is listed in the catalog, but this build has no bundled Reborn lifecycle for it yet.',
    tools: [],
    blocked_reason:
      'Slack is blocked: channels/slack is only a catalog reference in this build, and no bundled Reborn lifecycle exists for it yet.'
  }
];

function readStatus() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATUS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeStatus(status) {
  localStorage.setItem(STATUS_KEY, JSON.stringify(status));
}

function connectorFor(name) {
  const canonical = canonicalExtensionName(name);
  const connector = BUNDLED_CONNECTORS.find((entry) => entry.name === canonical);
  if (!connector) {
    throw new Error(`Unknown bundled connector: ${name}`);
  }
  return connector;
}

function isBackendActive(projection) {
  const phase = projection?.phase || projection?.activation_status || '';
  return phase === 'active';
}

function hasAccountReadinessProof(projection) {
  if (projection?.account_ready === true) return true;
  if (projection?.credential_ready === true) return true;
  const readiness = projection?.readiness || projection?.payload?.readiness || {};
  return (
    readiness?.account === 'ready' ||
    readiness?.account === 'connected' ||
    readiness?.credential === 'ready' ||
    readiness?.credential === 'connected'
  );
}

function lifecycleBlockerMessage(projection) {
  const blockers = Array.isArray(projection?.blockers) ? projection.blockers : [];
  if (!blockers.length) return null;
  return blockers
    .map((blocker) => {
      if (typeof blocker === 'string') return blocker;
      return (
        blocker?.message ||
        BLOCKER_MESSAGES[blocker?.ref_id] ||
        blocker?.code ||
        blocker?.ref_id ||
        JSON.stringify(blocker)
      );
    })
    .filter(Boolean)
    .join(', ');
}

function isRuntimeBlocked(projection) {
  if (!projection) return false;
  if (projection.phase === 'unsupported_or_legacy') return true;
  return Array.isArray(projection.blockers) && projection.blockers.length > 0;
}

function statusFromProjection(projection) {
  return {
    backend_phase: projection?.phase || projection?.activation_status || null,
    backend_blocker:
      lifecycleBlockerMessage(projection) ||
      (projection?.phase === 'unsupported_or_legacy'
        ? 'Connector runtime is not wired in this build yet.'
        : null),
    runtime_blocked: isRuntimeBlocked(projection)
  };
}

function connectorWithProjection(connector, projection, projectionError = null) {
  const status = readStatus()[connector.name];
  const credentialStored = Boolean(status?.credential_ref);
  const storedRuntimeBlocked = Boolean(status?.runtime_blocked || status?.backend_blocker);
  const runtimeBlocked = storedRuntimeBlocked || isRuntimeBlocked(projection);
  const lifecyclePhase = projection?.phase || status?.backend_phase || null;
  const backendActive = isBackendActive(projection);
  const accountReady = hasAccountReadinessProof(projection);
  const requiresAuth =
    connector.has_auth !== false &&
    Boolean(connector.provider || connector.token_label || connector.default_account_label);
  const active = backendActive && (!requiresAuth || accountReady);
  const blockerMessage = lifecycleBlockerMessage(projection) || status?.backend_blocker || null;
  if (connector.supported === false) {
    return {
      ...connector,
      active: false,
      authenticated: false,
      has_auth: false,
      needs_setup: false,
      onboarding_state: 'unsupported',
      activation_status: 'unsupported',
      account_label: connector.default_account_label || '',
      credential_ref: null,
      configured_at: null,
      lifecycle_phase: null,
      credential_stored: false,
      activation_error: connector.blocked_reason,
      can_activate: false
    };
  }
  if (projectionError) {
    return {
      ...connector,
      active: false,
      authenticated: credentialStored,
      has_auth: true,
      needs_setup: true,
      onboarding_state: 'failed',
      activation_status: 'failed',
      account_label: status?.account_label || connector.default_account_label,
      credential_ref: status?.credential_ref || null,
      configured_at: status?.configured_at || null,
      lifecycle_phase: null,
      credential_stored: credentialStored,
      activation_error: projectionError.message || 'Lifecycle projection failed',
      can_activate: false
    };
  }
  return {
    ...connector,
    active,
    backend_active: backendActive,
    account_ready: accountReady,
    authenticated: credentialStored,
    has_auth: requiresAuth,
    needs_setup: !credentialStored && !accountReady,
    onboarding_state: active
      ? 'active'
      : runtimeBlocked
        ? 'runtime_blocked'
        : credentialStored
          ? 'credential_stored'
          : 'auth_required',
    activation_status:
      (runtimeBlocked ? 'runtime_blocked' : lifecyclePhase) ||
      (credentialStored ? 'credential_stored' : 'auth_required'),
    account_label: status?.account_label || connector.default_account_label,
    credential_ref: status?.credential_ref || null,
    configured_at: status?.configured_at || null,
    lifecycle_phase: lifecyclePhase,
    credential_stored: credentialStored,
    activation_error: blockerMessage,
    can_activate: credentialStored && !runtimeBlocked
  };
}

async function connectorWithStatus(connector) {
  if (connector.supported === false) {
    return connectorWithProjection(connector);
  }
  try {
    const projection = await setupExtension(connector.name, {
      action: 'begin',
      payload: { catalog_ref: connector.catalog_ref }
    });
    return connectorWithProjection(connector, projection);
  } catch (err) {
    return connectorWithProjection(connector, null, err);
  }
}

export function resolveConnectorName(name) {
  return connectorFor(name).name;
}

export function getConnectorBlockedReason(name) {
  const connector = connectorFor(name);
  return connector.supported === false ? connector.blocked_reason : null;
}

export async function fetchExtensions() {
  return {
    extensions: await Promise.all(BUNDLED_CONNECTORS.map(connectorWithStatus)),
    source: 'reborn_static_catalog'
  };
}
export function fetchExtensionRegistry() {
  return Promise.resolve({
    entries: BUNDLED_CONNECTORS.map((entry) => ({ ...entry })),
    source: 'reborn_static_catalog'
  });
}
export function installExtension(name, _kind) {
  const connector = connectorFor(name);
  if (connector.supported === false) {
    return Promise.resolve({
      success: false,
      unsupported: true,
      message: connector.blocked_reason
    });
  }
  return setupExtension(connector.name, {
    action: 'install',
    payload: { catalog_ref: connector.catalog_ref }
  })
    .then((projection) => ({
      success: true,
      message: `${connector.display_name} lifecycle projected as ${projection?.phase || 'unknown'}`,
      projection
    }))
    .catch((err) => ({
      success: false,
      message: err.message || 'Install failed'
    }));
}
export function activateExtension(name) {
  const connector = connectorFor(name);
  if (connector.supported === false) {
    return Promise.resolve({
      success: false,
      unsupported: true,
      message: connector.blocked_reason
    });
  }
  const existing = readStatus()[connector.name];
  const configured = Boolean(existing?.credential_ref);
  if (!configured) {
    return Promise.resolve({
      success: false,
      awaiting_token: true,
      message: `${connector.display_name} needs credentials first`
    });
  }
  if (
    existing?.runtime_blocked ||
    existing?.backend_blocker ||
    existing?.backend_phase === 'unsupported_or_legacy'
  ) {
    return Promise.resolve({
      success: false,
      awaiting_lifecycle: true,
      message:
        existing.backend_blocker ||
        `${connector.display_name} runtime is not wired in this build yet`
    });
  }
  return setupExtension(connector.name, {
    action: 'activate',
    payload: { catalog_ref: connector.catalog_ref }
  })
    .then((projection) => {
      const phase = projection?.phase || 'unknown';
      const active = isBackendActive(projection);
      return {
        success: active,
        awaiting_lifecycle: !active,
        message: active
          ? `${connector.display_name} backend reports active`
          : `${connector.display_name} is not active yet; backend phase is ${phase}`,
        projection
      };
    })
    .catch((err) => ({
      success: false,
      awaiting_lifecycle: true,
      message: err.message || `${connector.display_name} activation failed`
    }));
}
export function removeExtension(name) {
  const connector = connectorFor(name);
  const status = readStatus();
  delete status[connector.name];
  writeStatus(status);
  return Promise.resolve({
    success: true,
    message: `${connector.display_name} credential record cleared locally`
  });
}
export function fetchExtensionSetup(name) {
  const connector = connectorFor(name);
  if (connector.supported === false) {
    return Promise.reject(new Error(connector.blocked_reason));
  }
  const status = readStatus()[connector.name];
  const credentialStored = Boolean(status?.credential_ref);
  return Promise.resolve({
    display_name: connector.display_name,
    provider: connector.provider,
    secrets: [
      {
        name: 'token',
        prompt: connector.token_label,
        optional: false,
        provided: credentialStored
      }
    ],
    fields: [
      {
        name: 'account_label',
        prompt: 'Account label',
        placeholder: connector.default_account_label,
        optional: false,
        value: status?.account_label || connector.default_account_label
      }
    ],
    onboarding: {
      credential_instructions: connector.setup_instructions,
      credential_next_step:
        'After saving, ask IronClaw to use this workspace source. The model will still pause before sending or writing externally. One-click OAuth is not exposed by this local gateway yet.'
    },
    source: 'reborn_product_auth'
  });
}
export async function submitExtensionSetup(name, secrets, fields) {
  const connector = connectorFor(name);
  if (connector.supported === false) {
    throw new Error(connector.blocked_reason);
  }
  const status = readStatus();
  const existing = status[connector.name];
  const token = (secrets?.token || '').trim();
  if (!token && existing?.credential_ref) {
    const projection = await setupExtension(connector.name, {
      action: 'configure',
      payload: {
        catalog_ref: connector.catalog_ref,
        provider: connector.provider,
        account_label: existing.account_label || connector.default_account_label,
        credential_ref: existing.credential_ref
      }
    }).catch((err) => ({ warning: err.message || 'Lifecycle projection failed' }));
    status[connector.name] = {
      ...existing,
      ...statusFromProjection(projection)
    };
    writeStatus(status);
    const phase = projection?.phase || 'unknown';
    const active = isBackendActive(projection);
    const blocker = lifecycleBlockerMessage(projection);
    return {
      success: true,
      connected: active,
      message: active
        ? `${connector.display_name} backend reports active`
        : blocker || `${connector.display_name} credential is stored; backend phase is ${phase}`,
      credential_ref: existing.credential_ref,
      projection
    };
  }
  if (!token) {
    throw new Error(`${connector.display_name} needs a token to connect`);
  }
  const accountLabel = (fields?.account_label || '').trim() || connector.default_account_label;
  const setup = await setupManualToken({
    provider: connector.provider,
    accountLabel
  });
  const submitted = await submitManualTokenSecret({
    interactionId: setup.interaction_id,
    invocationId: setup.invocation_id,
    token
  });
  const projection = await setupExtension(connector.name, {
    action: 'configure',
    payload: {
      catalog_ref: connector.catalog_ref,
      provider: connector.provider,
      account_label: accountLabel,
      credential_ref: submitted.credential_ref
    }
  });
  status[connector.name] = {
    provider: connector.provider,
    account_label: accountLabel,
    credential_ref: submitted.credential_ref,
    configured_at: new Date().toISOString(),
    ...statusFromProjection(projection)
  };
  writeStatus(status);
  const phase = projection?.phase || 'unknown';
  const active = isBackendActive(projection);
  const blocker = lifecycleBlockerMessage(projection);
  return {
    success: true,
    connected: active,
    message: active
      ? `${connector.display_name} backend reports active`
      : blocker || `${connector.display_name} credential stored; backend phase is ${phase}`,
    credential_ref: submitted.credential_ref,
    projection
  };
}

export function projectExtensionSetup(name, payload = {}) {
  const connector = connectorFor(name);
  if (connector.supported === false) {
    return Promise.reject(new Error(connector.blocked_reason));
  }
  return setupExtension(connector.name, {
    action: 'configure',
    payload
  });
}
export function fetchPairingRequests(_channel) {
  return Promise.resolve({ requests: [], todo: true });
}
export function approvePairingCode(_channel, _code) {
  return Promise.resolve({ success: false, message: 'TODO: requires v2 pairing endpoint' });
}
