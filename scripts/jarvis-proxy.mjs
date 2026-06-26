// Dev-harness proxy for the jarvis (pm-backend) MCP. The packaged desktop gateway will
// serve /api/jarvis/* natively; until then the standalone webui server uses this so the
// Workbench has a LIVE project-management surface (commitments / projects / decisions).
//
// The credential lives ONLY in JARVIS_API_KEY (env) — never the browser, never committed.
// Read-only: only list/get tools are called here; no create/update/archive ever runs.
// Honest degrade: { configured:false } with no key; { error } on any failure — never
// fabricates rows.

const DEFAULT_BASE = 'https://api.staging.jarvis.near.org/mcp/mcp';

// The MCP streamable-HTTP transport replies with Server-Sent Events — possibly several
// `data:` frames per response (progress notifications / keepalives before the result).
// Return the JSON-RPC envelope (the frame carrying `result` or `error`), preferring the
// one whose id matches the request; fall back to the first parseable frame.
export function parseSseJson(text, wantId) {
  let fallback = null;
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch (_) {
      continue;
    }
    const isEnvelope = parsed && (parsed.result !== undefined || parsed.error !== undefined);
    if (isEnvelope && (wantId === undefined || parsed.id === wantId)) return parsed;
    if (!fallback) fallback = parsed;
  }
  if (fallback) return fallback;
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

// Unwrap a tools/call result into an array of parsed row objects. pm-backend returns
// each row as its own text content block (or a single block holding a JSON array).
export function toolRows(json) {
  const content = json?.result?.content;
  if (!Array.isArray(content)) return [];
  const rows = [];
  for (const block of content) {
    if (!block || block.type !== 'text' || typeof block.text !== 'string') continue;
    let parsed;
    try {
      parsed = JSON.parse(block.text);
    } catch (_) {
      continue;
    }
    if (Array.isArray(parsed)) rows.push(...parsed);
    else if (parsed && typeof parsed === 'object') rows.push(parsed);
  }
  return rows;
}

async function mcpPost(base, key, sessionId, body, fetchImpl) {
  const headers = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream'
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const res = await fetchImpl(base, { method: 'POST', headers, body: JSON.stringify(body) });
  const sid = res.headers.get('mcp-session-id') || sessionId || '';
  const text = await res.text();
  return { ok: res.ok, status: res.status, sessionId: sid, json: parseSseJson(text, body?.id) };
}

// Turn one settled tool-call into rows, or throw a precise reason. A non-2xx status, a
// JSON-RPC { error } envelope, or a missing/!array content block is a FAILURE — never a
// silent empty list (that would read as "nothing owed" when the read actually broke).
function rowsOrThrow(label, settled) {
  if (settled.status !== 'fulfilled') {
    throw new Error(`${label}: ${settled.reason?.message || 'request failed'}`);
  }
  const res = settled.value;
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  const json = res.json;
  if (json?.error) throw new Error(`${label}: ${json.error.message || 'jarvis error'}`);
  if (!json?.result || !Array.isArray(json.result.content)) {
    throw new Error(`${label}: malformed response`);
  }
  return toolRows(json);
}

// Project the verbose pm-backend rows down to the fields the Workbench surface renders.
function slimCommitment(row) {
  return {
    id: String(row.id || ''),
    shortId: String(row.shortId || ''),
    title: String(row.title || ''),
    state: String(row.state || ''),
    dueDate: row.dueDate || null,
    priority: Number(row.priority || 0),
    projectId: String(row.projectId || ''),
    needsApproval: Boolean(row.needsApproval)
  };
}
function slimProject(row) {
  return {
    id: String(row.id || ''),
    slug: String(row.slug || ''),
    name: String(row.name || ''),
    state: String(row.state || ''),
    lead: row.lead && row.lead.name ? String(row.lead.name) : '',
    openIssueCount: Number(row.openIssueCount || 0)
  };
}

export async function fetchJarvisSummary({ key, base = DEFAULT_BASE, fetchImpl = fetch } = {}) {
  const empty = { configured: Boolean(key), projects: [], outstanding: [], commitments: [] };
  if (!key) return { ...empty, configured: false };
  try {
    const init = await mcpPost(
      base,
      key,
      '',
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'ironclaw-workbench', version: '1' }
        }
      },
      fetchImpl
    );
    const sid = init.sessionId;
    if (!sid) return { ...empty, error: 'jarvis session not established' };
    await mcpPost(
      base,
      key,
      sid,
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      fetchImpl
    );
    const call = (id, name, args = {}) =>
      mcpPost(
        base,
        key,
        sid,
        { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } },
        fetchImpl
      );
    // allSettled so one transient tool failure doesn't discard the others; each tool's
    // rows or error is captured independently and surfaced (honest partial degrade).
    const settled = await Promise.allSettled([
      call(2, 'list_projects_tool', {}),
      call(3, 'get_my_outstanding_tool', {}),
      call(4, 'list_commitments_tool', { limit: 25, sort_by: '-updated_at' })
    ]);
    const errors = [];
    const extract = (index, label, slim) => {
      try {
        return rowsOrThrow(label, settled[index]).map(slim);
      } catch (err) {
        errors.push(String((err && err.message) || err));
        return [];
      }
    };
    const projects = extract(0, 'projects', slimProject);
    const outstanding = extract(1, 'outstanding', slimCommitment);
    const commitments = extract(2, 'commitments', slimCommitment);
    return {
      configured: true,
      projects,
      outstanding,
      commitments,
      error: errors.length ? errors.join('; ') : ''
    };
  } catch (err) {
    return { ...empty, error: String((err && err.message) || err) };
  }
}
