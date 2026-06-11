// v2 gate normalization. Source shapes come from
// `WebChatV2Event::Gate { prompt: GatePromptView }` and
// `WebChatV2Event::AuthRequired { prompt: AuthPromptView }`. The
// browser must hold `run_id` + `gate_ref` so a follow-up
// `resolve_gate` call can fill them into the v2 path params.
export function gateFromEvent(eventType, prompt) {
  if (!prompt) return null;

  if (eventType === 'gate') {
    return {
      kind: 'gate',
      requestId: prompt.request_id || prompt.gate_ref || null,
      runId: prompt.turn_run_id,
      gateRef: prompt.gate_ref,
      headline: prompt.headline,
      body: prompt.body,
      toolName: prompt.tool_name || prompt.toolName || '',
      description: prompt.description || prompt.body || '',
      parameters: formatGateParameters(prompt.parameters),
      allowAlways: Boolean(prompt.allow_always ?? prompt.allowAlways)
    };
  }

  if (eventType === 'auth_required') {
    return {
      kind: 'auth_required',
      // Legacy auth_required prompts predate challenge_kind and are manual
      // token prompts. Explicit unknown/other challenge kinds still route to
      // the neutral auth card in chat.js.
      challengeKind: prompt.challenge_kind || 'manual_token',
      runId: prompt.turn_run_id,
      // AuthPromptView carries `auth_request_ref`, but v2's resolve
      // path is `/runs/{run_id}/gates/{gate_ref}/resolve` — auth
      // prompts therefore round-trip through the same gate_ref slot.
      gateRef: prompt.auth_request_ref,
      // Falls back to null when unpopulated; components render a generic
      // label rather than a misleading provider name.
      provider: prompt.provider || null,
      // Falls back to empty string so auth-token-card subtitle is hidden
      // when not set; card falls back to provider label if non-null.
      accountLabel: prompt.account_label || '',
      // Only present for oauth_url challenges:
      authorizationUrl: prompt.authorization_url || null,
      expiresAt: prompt.expires_at || null,
      headline: prompt.headline,
      body: prompt.body
    };
  }

  return null;
}

export function gateFromProjection(activeRunId, gate) {
  if (!activeRunId || !gate) return null;
  return {
    kind: 'gate',
    requestId: gate.request_id || gate.gate_ref || null,
    runId: activeRunId,
    gateRef: gate.gate_ref,
    headline: gate.headline || '',
    body: gate.body || '',
    toolName: gate.tool_name || gate.toolName || '',
    description: gate.description || gate.body || '',
    parameters: formatGateParameters(gate.parameters),
    allowAlways: Boolean(gate.allow_always ?? gate.allowAlways)
  };
}

export function formatGateParameters(parameters) {
  if (parameters === undefined || parameters === null || parameters === '') return '';
  if (typeof parameters === 'string') return parameters;
  try {
    return JSON.stringify(parameters, null, 2);
  } catch {
    return String(parameters);
  }
}
