// Dev-harness proxy for the jarvis (pm-backend) MCP. The packaged desktop gateway will
// serve /api/jarvis/* natively; until then the standalone webui server uses this so the
// Workbench has a LIVE project-management surface (commitments / projects / decisions).
//
// The credential lives ONLY in JARVIS_API_KEY (env) — never the browser, never committed.
// Read-only: only list/get tools are called here; no create/update/archive ever runs.
// Honest degrade: { configured:false } with no key; { error } on any failure — never
// fabricates rows.

const DEFAULT_BASE = 'https://api.staging.jarvis.near.org/mcp/mcp';

// The MCP streamable-HTTP transport replies with Server-Sent Events — one `data:` line
// carrying the JSON-RPC envelope. Return the first parseable data payload.
export function parseSseJson(text) {
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      return JSON.parse(payload);
    } catch (_) {
      /* keep scanning */
    }
  }
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
  return { ok: res.ok, status: res.status, sessionId: sid, json: parseSseJson(text) };
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
    const [projects, outstanding, commitments] = await Promise.all([
      call(2, 'list_projects_tool', {}),
      call(3, 'get_my_outstanding_tool', {}),
      call(4, 'list_commitments_tool', { limit: 25, sort_by: '-updated_at' })
    ]);
    return {
      configured: true,
      projects: toolRows(projects.json).map(slimProject),
      outstanding: toolRows(outstanding.json).map(slimCommitment),
      commitments: toolRows(commitments.json).map(slimCommitment)
    };
  } catch (err) {
    return { ...empty, error: String((err && err.message) || err) };
  }
}
