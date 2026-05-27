// Typed HTTP client for the IronClaw gateway.
//
// Endpoints are documented in /tmp/ironclaw-api.md. Where the wire format
// differs from the TS types we expose, this client maps fields explicitly
// in the consumer-facing methods so callers see a stable interface.

import type {
  ChatEvent,
  Extension,
  ExtensionSetupSchema,
  ExtensionTool,
  GatewayStatus,
  HealthStatus,
  LogEntry,
  LogLevel,
  MemoryHit,
  MemoryNode,
  Message,
  Routine,
  RoutineRun,
  RoutineSummary,
  Skill,
  Thread
} from './types';

export interface IronClawClientOptions {
  baseUrl: string;
  token: string;
}

class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class IronClawClient {
  readonly baseUrl: string;
  readonly token: string;

  constructor(opts: IronClawClientOptions) {
    // Strip trailing slash so we never produce // in paths.
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.token = opts.token;
  }

  // ---- Internal HTTP plumbing ------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    init?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...((init?.headers as Record<string, string>) ?? {})
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init
    });

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const text = await res.text();
        if (text) detail = text.slice(0, 500);
      } catch {
        // ignore body-read failures; fall back to status text
      }
      throw new HttpError(res.status, url, `${res.status} ${detail}`);
    }

    // Some endpoints (DELETE, 204) may have empty bodies; guard parse.
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  // ---- Health & connection ---------------------------------------------------

  async health(): Promise<HealthStatus> {
    const res = await this.request<{ status?: string; channel?: string }>(
      'GET',
      '/api/health'
    );
    const status = res?.status;
    return {
      ok: status === 'ok' || status === 'healthy',
      status,
      channel: res?.channel
    };
  }

  async gatewayStatus(): Promise<GatewayStatus> {
    const res = await this.request<{
      version?: string;
      engine_v2_enabled?: boolean;
      llm_model?: string;
      enabled_channels?: string[];
      ws_connections?: number;
      sse_connections?: number;
      total_connections?: number;
      uptime_seconds?: number;
      multi_tenant_mode?: boolean;
    }>('GET', '/api/gateway/status');
    const ws = res?.ws_connections ?? 0;
    const sse = res?.sse_connections ?? 0;
    return {
      version: res?.version,
      engine_v2_enabled: res?.engine_v2_enabled,
      llm_model: res?.llm_model,
      enabled_channels: res?.enabled_channels ?? [],
      sse_connections: sse,
      ws_connections: ws,
      total_connections: res?.total_connections ?? ws + sse,
      uptime_seconds: res?.uptime_seconds,
      multi_tenant_mode: res?.multi_tenant_mode
    };
  }

  // ---- Logs ------------------------------------------------------------------

  /** GET /api/logs/level → current effective tracing level. */
  async getLogLevel(): Promise<{ level: LogLevel }> {
    const res = await this.request<{ level?: string }>('GET', '/api/logs/level');
    const level = normalizeLogLevel(res?.level);
    return { level };
  }

  /** POST /api/logs/level → set the gateway's effective tracing level. */
  async setLogLevel(level: LogLevel): Promise<{ ok: boolean }> {
    const res = await this.request<{ ok?: boolean; status?: string }>(
      'POST',
      '/api/logs/level',
      { level }
    );
    return { ok: res?.ok === true || res?.status === 'ok' };
  }

  /**
   * Stream log entries from the gateway via Server-Sent Events.
   *
   * Mirrors `streamEvents`: EventSource is used so the browser handles
   * reconnect-on-disconnect for free; auth is supplied via query token
   * because EventSource cannot attach custom headers.
   *
   * Gateway emits a named event `log` whose payload is a JSON object
   * `{level, target, message, timestamp}`. On connect the server replays
   * its buffered window of recent entries, then streams live.
   */
  async *streamLogs(signal: AbortSignal): AsyncIterable<LogEntry> {
    const url = new URL(`${this.baseUrl}/api/logs/events`);
    if (this.token) url.searchParams.set('token', this.token);

    const es = new EventSource(url.toString());
    const queue: LogEntry[] = [];
    let resolveNext: ((value: IteratorResult<LogEntry>) => void) | null = null;
    let done = false;
    let error: Error | null = null;

    const push = (entry: LogEntry) => {
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r({ value: entry, done: false });
      } else {
        queue.push(entry);
      }
    };

    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      if (err) error = err;
      es.close();
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        if (err) r(Promise.reject(err) as unknown as IteratorResult<LogEntry>);
        else r({ value: undefined, done: true });
      }
    };

    const handler = (msg: MessageEvent) => {
      try {
        const parsed = JSON.parse(msg.data) as Record<string, unknown>;
        push({
          level: normalizeLogLevel(parsed.level),
          target: String(parsed.target ?? ''),
          message: String(parsed.message ?? ''),
          timestamp: String(parsed.timestamp ?? '')
        });
      } catch {
        // Best-effort: drop malformed payloads rather than poison the stream.
      }
    };

    // Bind both the named `log` event and the default `message` channel —
    // the default catches payloads sent without an explicit event name and
    // shields us from gateway version drift.
    es.addEventListener('log', handler);
    es.addEventListener('message', handler);
    es.addEventListener('error', () => {
      // EventSource auto-reconnects; surface nothing here. The connection
      // guard on the route reflects overall status separately.
    });

    if (signal.aborted) {
      finish();
    } else {
      signal.addEventListener('abort', () => finish(), { once: true });
    }

    try {
      while (!done) {
        if (queue.length > 0) {
          yield queue.shift()!;
          continue;
        }
        const next = await new Promise<IteratorResult<LogEntry>>((resolve) => {
          resolveNext = resolve;
        });
        if (next.done) break;
        yield next.value;
      }
      if (error) throw error;
    } finally {
      es.close();
    }
  }

  // ---- Chat ------------------------------------------------------------------

  async sendMessage(
    threadId: string | null,
    content: string
  ): Promise<{ thread_id: string; message_id: string }> {
    // POST /api/chat/send accepts {content, thread_id?} and returns
    // {message_id, status}. Thread ID may be created server-side; if the
    // caller didn't pass one, we surface the originally-provided value
    // (often null) — phase 3 will reconcile this against the SSE stream.
    const res = await this.request<{ message_id: string; thread_id?: string }>(
      'POST',
      '/api/chat/send',
      {
        content,
        ...(threadId ? { thread_id: threadId } : {})
      }
    );
    return {
      thread_id: res.thread_id ?? threadId ?? '',
      message_id: res.message_id
    };
  }

  /**
   * Stream chat events for a thread via Server-Sent Events.
   *
   * EventSource is used because the browser handles reconnect-on-disconnect
   * for free. Auth is supplied via query token (browsers cannot attach
   * custom headers to EventSource), per /api/chat/events doc.
   */
  async *streamEvents(threadId: string, signal: AbortSignal): AsyncIterable<ChatEvent> {
    const url = new URL(`${this.baseUrl}/api/chat/events`);
    if (threadId) url.searchParams.set('thread_id', threadId);
    if (this.token) url.searchParams.set('token', this.token);

    const es = new EventSource(url.toString());
    const queue: ChatEvent[] = [];
    let resolveNext: ((value: IteratorResult<ChatEvent>) => void) | null = null;
    let done = false;
    let error: Error | null = null;

    const push = (ev: ChatEvent) => {
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r({ value: ev, done: false });
      } else {
        queue.push(ev);
      }
    };

    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      if (err) error = err;
      es.close();
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        if (err) r(Promise.reject(err) as unknown as IteratorResult<ChatEvent>);
        else r({ value: undefined, done: true });
      }
    };

    const handler = (msg: MessageEvent) => {
      try {
        const parsed = JSON.parse(msg.data) as Record<string, unknown>;
        push(normalizeEvent(parsed));
      } catch (e) {
        push({ type: 'error', message: `parse error: ${(e as Error).message}` });
      }
    };

    // Default `message` event covers payloads sent without an explicit
    // event name; named events ('response', 'tool_start', etc.) are bound
    // individually so we don't lose them.
    es.addEventListener('message', handler);
    es.addEventListener('response', handler);
    es.addEventListener('tool_start', handler);
    es.addEventListener('tool_result', handler);
    es.addEventListener('error', (ev) => {
      if (ev instanceof MessageEvent && typeof ev.data === 'string') {
        handler(ev);
      } else {
        // Browser EventSource emits a generic Event on connection failure;
        // surface it but keep the stream open — EventSource auto-reconnects.
        push({ type: 'error', message: 'SSE connection error' });
      }
    });

    if (signal.aborted) {
      finish();
    } else {
      signal.addEventListener('abort', () => finish(), { once: true });
    }

    try {
      while (!done) {
        if (queue.length > 0) {
          yield queue.shift()!;
          continue;
        }
        const next = await new Promise<IteratorResult<ChatEvent>>((resolve) => {
          resolveNext = resolve;
        });
        if (next.done) break;
        yield next.value;
      }
      if (error) throw error;
    } finally {
      es.close();
    }
  }

  async listThreads(): Promise<Thread[]> {
    const res = await this.request<{
      threads: Array<{
        id: string;
        title: string;
        created_at: string;
        last_message_at?: string;
        updated_at?: string;
        message_count: number;
      }>;
    }>('GET', '/api/chat/threads');
    return (res?.threads ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      created_at: t.created_at,
      updated_at: t.last_message_at ?? t.updated_at ?? t.created_at,
      message_count: t.message_count
    }));
  }

  /**
   * Fetch a slice of a thread's history. The optional `offset` is forwarded
   * verbatim to the gateway's `offset` query parameter for paginated loads;
   * the gateway returns the *most recent* `limit` messages starting that many
   * rows back from the head (offset 0 = newest page, offset 30 = the page
   * before that, etc.). Default offset of 0 preserves the original behaviour
   * for callers that just want the latest slice.
   *
   * The gateway is documented to support `?thread_id=...&limit=...&offset=...`
   * (see /tmp/ironclaw-api.md §GET /api/chat/history). If a future revision
   * starts returning a `next_cursor`-style token, swap this for cursor-based
   * paging without changing callers — `loadMoreHistory` in the store layer
   * abstracts over the wire shape.
   */
  async getHistory(threadId: string, limit = 50, offset = 0): Promise<Message[]> {
    const qs = new URLSearchParams({ thread_id: threadId, limit: String(limit) });
    if (offset > 0) qs.set('offset', String(offset));
    const res = await this.request<{
      messages: Array<{
        id: string;
        role: 'user' | 'assistant' | 'tool';
        content: string;
        timestamp?: string;
        created_at?: string;
      }>;
    }>('GET', `/api/chat/history?${qs.toString()}`);
    return (res?.messages ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      created_at: m.created_at ?? m.timestamp ?? ''
    }));
  }

  async newThread(title?: string): Promise<{ id: string }> {
    const res = await this.request<{ thread_id: string; id?: string }>(
      'POST',
      '/api/chat/thread/new',
      title ? { title } : {}
    );
    return { id: res.thread_id ?? res.id ?? '' };
  }

  // ---- Memory / knowledge ----------------------------------------------------

  async searchMemory(query: string, limit = 10): Promise<MemoryHit[]> {
    const res = await this.request<{
      results: Array<{ path: string; content?: string; snippet?: string; score: number }>;
    }>('POST', '/api/memory/search', { query, limit });
    return (res?.results ?? []).map((r) => ({
      path: r.path,
      snippet: r.snippet ?? r.content ?? '',
      score: r.score
    }));
  }

  async listMemory(prefix?: string): Promise<MemoryNode[]> {
    const qs = prefix ? `?path=${encodeURIComponent(prefix)}` : '';
    const res = await this.request<{
      entries: Array<{ path: string; is_dir: boolean; size?: number }>;
    }>('GET', `/api/memory/list${qs}`);
    return (res?.entries ?? []).map((e) => ({
      path: e.path,
      type: e.is_dir ? 'dir' : 'file',
      size: e.size
    }));
  }

  async readMemory(path: string): Promise<{ content: string; metadata?: unknown }> {
    const qs = new URLSearchParams({ path });
    const res = await this.request<{ path: string; content: string; updated_at?: string }>(
      'GET',
      `/api/memory/read?${qs.toString()}`
    );
    return {
      content: res.content ?? '',
      metadata: res.updated_at ? { updated_at: res.updated_at } : undefined
    };
  }

  /**
   * Write or replace a memory document at `path` with `content`.
   *
   * Wire shape: gateway returns `{path, status: "written", redirected?, actual_layer?}`.
   * We normalize to `{ok, path}` so callers don't have to know the server's
   * status vocabulary; `ok` is true whenever the server reported a write.
   *
   * Path validation lives on the caller side (the route enforces "no leading
   * slash / no `..` / no empty segments") so the gateway only sees clean paths,
   * but the gateway itself also rejects traversal — this is defense in depth,
   * not a substitute.
   */
  async writeMemory(
    path: string,
    content: string
  ): Promise<{ ok: boolean; path?: string }> {
    const res = await this.request<{
      path?: string;
      status?: string;
    }>('POST', '/api/memory/write', { path, content });
    return {
      ok: res?.status === 'written' || res?.status === 'ok',
      path: res?.path ?? path
    };
  }

  // Note: the gateway does not currently expose DELETE /api/memory/{path} or
  // an equivalent endpoint (verified against /tmp/ironclaw-api.md), so there
  // is no client method for deletion. Add one here when the server lands it.

  // ---- Skills ----------------------------------------------------------------

  async listSkills(): Promise<Skill[]> {
    // The gateway returns the rich shape documented in /tmp/ironclaw-api.md:
    // { name, description, version, trust, source, bundle_path,
    //   has_requirements, has_scripts, usage_hint, keywords, setup_hint,
    //   install_source_url }. We pass the enrichment fields through verbatim;
    // `source` is the Rust Debug-formatted SkillSource string and must NOT be
    // parsed client-side.
    const res = await this.request<{
      skills: Array<{
        name: string;
        description: string;
        version: string;
        trust?: string;
        source?: string;
        bundle_path?: string | null;
        has_requirements?: boolean;
        has_scripts?: boolean;
        usage_hint?: string | null;
      }>;
    }>('GET', '/api/skills');
    return (res?.skills ?? []).map((s) => ({
      name: s.name,
      description: s.description,
      version: s.version,
      // Anything returned by /api/skills is by definition installed locally.
      installed: true,
      trust: s.trust,
      source: s.source,
      bundle_path: s.bundle_path ?? undefined,
      has_requirements: s.has_requirements,
      has_scripts: s.has_scripts,
      usage_hint: s.usage_hint ?? undefined
    }));
  }

  async searchSkills(query: string): Promise<Skill[]> {
    const res = await this.request<{
      catalog?: Array<{
        slug: string;
        name?: string;
        description: string;
        version: string;
        installed?: boolean;
        trust?: string;
        source?: string;
        bundle_path?: string | null;
        has_requirements?: boolean;
        has_scripts?: boolean;
        usage_hint?: string | null;
      }>;
      installed?: Array<{
        name: string;
        description: string;
        version: string;
        trust?: string;
        source?: string;
        bundle_path?: string | null;
        has_requirements?: boolean;
        has_scripts?: boolean;
        usage_hint?: string | null;
      }>;
    }>('POST', '/api/skills/search', { query });

    // Prefer catalog entries (richer metadata), fall back to installed list.
    // Both shapes carry the same enrichment fields where the server populates them.
    const catalog = (res?.catalog ?? []).map((c) => ({
      name: c.name ?? c.slug,
      description: c.description,
      version: c.version,
      installed: c.installed ?? false,
      trust: c.trust,
      source: c.source,
      bundle_path: c.bundle_path ?? undefined,
      has_requirements: c.has_requirements,
      has_scripts: c.has_scripts,
      usage_hint: c.usage_hint ?? undefined
    }));
    if (catalog.length > 0) return catalog;
    return (res?.installed ?? []).map((s) => ({
      name: s.name,
      description: s.description,
      version: s.version,
      installed: true,
      trust: s.trust,
      source: s.source,
      bundle_path: s.bundle_path ?? undefined,
      has_requirements: s.has_requirements,
      has_scripts: s.has_scripts,
      usage_hint: s.usage_hint ?? undefined
    }));
  }

  async installSkill(source: string): Promise<{ ok: boolean }> {
    // The gateway accepts `slug` or `download_key`. We treat the caller's
    // single argument as a slug, since that's the catalog-driven flow.
    const res = await this.request<{ status: string }>('POST', '/api/skills/install', {
      slug: source
    });
    return { ok: res?.status === 'queued' || res?.status === 'installed' };
  }

  // ---- Routines --------------------------------------------------------------

  async listRoutines(): Promise<Routine[]> {
    const res = await this.request<{
      routines: Array<{
        id: string;
        name: string;
        enabled: boolean;
        trigger_summary?: string;
        trigger_raw?: string;
        last_run_at?: string;
        next_fire_at?: string;
      }>;
    }>('GET', '/api/routines');
    return (res?.routines ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      schedule: r.trigger_summary ?? r.trigger_raw ?? '',
      enabled: r.enabled,
      last_run: r.last_run_at,
      next_run: r.next_fire_at
    }));
  }

  async routinesSummary(): Promise<RoutineSummary> {
    const res = await this.request<{
      total?: number;
      enabled?: number;
      failing?: number;
      runs_today?: number;
    }>('GET', '/api/routines/summary');
    return {
      total: res?.total ?? 0,
      enabled: res?.enabled ?? 0,
      // Gateway doesn't currently expose a 'running' count; approximate as 0.
      running: 0,
      failed_last_24h: res?.failing ?? 0
    };
  }

  async getRoutine(id: string): Promise<Routine> {
    const res = await this.request<{
      id: string;
      name: string;
      enabled: boolean;
      trigger_summary?: string;
      trigger_raw?: string;
      last_run_at?: string;
      next_fire_at?: string;
    }>('GET', `/api/routines/${encodeURIComponent(id)}`);
    return {
      id: res.id,
      name: res.name,
      schedule: res.trigger_summary ?? res.trigger_raw ?? '',
      enabled: res.enabled,
      last_run: res.last_run_at,
      next_run: res.next_fire_at
    };
  }

  async triggerRoutine(id: string): Promise<{ run_id: string }> {
    const res = await this.request<{ run_id: string }>(
      'POST',
      `/api/routines/${encodeURIComponent(id)}/trigger`
    );
    return { run_id: res.run_id };
  }

  async toggleRoutine(id: string, enabled: boolean): Promise<{ ok: boolean }> {
    const res = await this.request<{ status: string; enabled?: boolean }>(
      'POST',
      `/api/routines/${encodeURIComponent(id)}/toggle`,
      { enabled }
    );
    return { ok: res?.status === 'toggled' };
  }

  async getRoutineRuns(id: string, limit = 20): Promise<RoutineRun[]> {
    const qs = new URLSearchParams({ limit: String(limit) });
    const res = await this.request<{
      runs: Array<{
        id: string;
        started_at: string;
        completed_at?: string;
        status: 'completed' | 'failed' | 'timeout' | 'running';
        result_summary?: string;
      }>;
    }>('GET', `/api/routines/${encodeURIComponent(id)}/runs?${qs.toString()}`);
    return (res?.runs ?? []).map((r) => ({
      id: r.id,
      routine_id: id,
      started_at: r.started_at,
      finished_at: r.completed_at,
      status: mapRunStatus(r.status),
      output: r.result_summary
    }));
  }

  // ---- Settings (server-side) ------------------------------------------------

  async getSettings(): Promise<Record<string, unknown>> {
    const res = await this.request<{ settings: Record<string, unknown> }>(
      'GET',
      '/api/settings'
    );
    return res?.settings ?? {};
  }

  async getSetting(key: string): Promise<unknown> {
    const res = await this.request<{ key: string; value: unknown }>(
      'GET',
      `/api/settings/${encodeURIComponent(key)}`
    );
    return res?.value;
  }

  async putSetting(key: string, value: unknown): Promise<{ ok: boolean }> {
    const res = await this.request<{ key: string; value: unknown }>(
      'PUT',
      `/api/settings/${encodeURIComponent(key)}`,
      { value }
    );
    return { ok: res?.key === key };
  }

  // ---- Extensions ------------------------------------------------------------

  /**
   * List installed extensions. Joins three endpoints into a single normalized
   * list:
   *   - /api/extensions          — base list (name, kind, active, …)
   *   - /api/extensions/readiness — per-extension `phase` ("ready", "needs_auth",
   *                                 "needs_setup", "error")
   *   - /api/extensions/tools     — list of tools; counted per extension
   *
   * The latter two are fetched in parallel and joined opportunistically — if
   * either side errors the base list still renders, just without enrichment.
   */
  async listExtensions(): Promise<Extension[]> {
    type ExtensionWire = {
      name: string;
      display_name?: string;
      kind?: string;
      description?: string | null;
      version?: string;
      active?: boolean;
      authenticated?: boolean;
      needs_setup?: boolean;
      has_auth?: boolean;
      activation_status?: string;
      tools?: unknown[];
      keywords?: string[];
      source?: string;
    };
    const base = await this.request<{ extensions?: ExtensionWire[] }>(
      'GET',
      '/api/extensions'
    );

    // Best-effort enrichment — neither failure should block the list.
    type ReadinessWire = {
      extensions?: Array<{
        name: string;
        phase?: string;
        authenticated?: boolean;
        active?: boolean;
      }>;
      // legacy shape per /tmp/ironclaw-api.md
      ready?: string[];
      not_ready?: string[];
      errors?: Record<string, string>;
    };
    const [readiness, tools] = await Promise.all([
      this.request<ReadinessWire>('GET', '/api/extensions/readiness').catch(
        () => ({} as ReadinessWire)
      ),
      this.extensionTools().catch(() => [] as ExtensionTool[])
    ]);

    const readinessByName = new Map<
      string,
      { ready: boolean; message?: string }
    >();
    if (Array.isArray(readiness?.extensions)) {
      for (const r of readiness.extensions ?? []) {
        const phase = String(r.phase ?? '');
        readinessByName.set(r.name, {
          ready: phase === 'ready',
          message: phase || undefined
        });
      }
    } else {
      // Legacy fallback (ready/not_ready/errors triples).
      for (const n of readiness?.ready ?? []) {
        readinessByName.set(n, { ready: true, message: 'ready' });
      }
      for (const n of readiness?.not_ready ?? []) {
        const err = readiness?.errors?.[n];
        readinessByName.set(n, {
          ready: false,
          message: err ? `error: ${err}` : 'not_ready'
        });
      }
    }

    const toolCounts = new Map<string, number>();
    for (const t of tools) {
      toolCounts.set(t.extension, (toolCounts.get(t.extension) ?? 0) + 1);
    }

    return (base?.extensions ?? []).map((e) => {
      const rd = readinessByName.get(e.name);
      return {
        name: e.name,
        display_name: e.display_name,
        description: e.description ?? '',
        version: e.version,
        installed: true,
        active: e.active ?? false,
        ready: rd?.ready,
        category: mapExtensionKind(e.kind),
        source: e.source,
        requires_setup: e.needs_setup ?? false,
        tool_count: toolCounts.get(e.name) ?? (Array.isArray(e.tools) ? e.tools.length : 0),
        readiness_message: rd?.message,
        keywords: e.keywords
      } satisfies Extension;
    });
  }

  /** List installable extensions from the catalog. */
  async listRegistry(): Promise<Extension[]> {
    type RegistryWire = {
      name: string;
      slug?: string;
      display_name?: string;
      kind?: string;
      description?: string | null;
      version?: string;
      installed?: boolean;
      keywords?: string[];
      source?: string;
      requires_setup?: boolean;
    };
    // Registry returns {entries:[…]} on the wire today, but older versions
    // expose {available:[…]}. Accept both.
    const res = await this.request<{
      entries?: RegistryWire[];
      available?: RegistryWire[];
    }>('GET', '/api/extensions/registry');
    const list = res?.entries ?? res?.available ?? [];
    return list.map((e) => ({
      name: e.name ?? e.slug ?? '',
      display_name: e.display_name,
      description: e.description ?? '',
      version: e.version,
      installed: e.installed ?? false,
      category: mapExtensionKind(e.kind),
      source: e.source,
      requires_setup: e.requires_setup ?? false,
      keywords: e.keywords
    } satisfies Extension));
  }

  /** Flat list of tools provided by installed extensions. */
  async extensionTools(): Promise<ExtensionTool[]> {
    const res = await this.request<{
      tools?: Array<{
        name: string;
        extension?: string;
        description?: string;
      }>;
    }>('GET', '/api/extensions/tools');
    return (res?.tools ?? [])
      .filter((t) => !!t.extension)
      .map((t) => ({
        extension: String(t.extension),
        name: t.name,
        description: t.description
      }));
  }

  /**
   * Install an extension from the registry. The gateway accepts either
   * `{name}` or `{slug}` depending on version — we send both for safety.
   */
  async installExtension(name: string): Promise<{ ok: boolean }> {
    const res = await this.request<{ status?: string }>(
      'POST',
      '/api/extensions/install',
      { name, slug: name }
    );
    const status = res?.status;
    return { ok: status === 'queued' || status === 'installed' || status === 'ok' || !status };
  }

  async activateExtension(name: string): Promise<{ ok: boolean }> {
    const res = await this.request<{ status?: string }>(
      'POST',
      `/api/extensions/${encodeURIComponent(name)}/activate`
    );
    const status = res?.status;
    return { ok: status === 'activated' || status === 'ok' || !status };
  }

  async removeExtension(name: string): Promise<{ ok: boolean }> {
    const res = await this.request<{ status?: string }>(
      'POST',
      `/api/extensions/${encodeURIComponent(name)}/remove`
    );
    const status = res?.status;
    return { ok: status === 'removed' || status === 'ok' || !status };
  }

  /**
   * Fetch the setup-form schema for an extension. The gateway's wire shape
   * combines two field families:
   *   - `secrets`: named credentials (mapped to password fields)
   *   - `fields`: structured form fields (already in our target shape)
   * Both are merged into a single field list keyed by `key`.
   */
  async getExtensionSetup(name: string): Promise<ExtensionSetupSchema> {
    type SetupWire = {
      // current gateway shape
      secrets?: Array<{
        name: string;
        prompt?: string;
        optional?: boolean;
        provided?: boolean;
      }>;
      fields?: Array<{
        name?: string;
        key?: string;
        label?: string;
        type?: string;
        required?: boolean;
        placeholder?: string;
        default?: string;
        options?: Array<{ value: string; label: string }>;
        description?: string;
      }>;
      onboarding_state?: unknown;
      oauth_url?: string;
      notes?: string;
      // legacy shape per /tmp/ironclaw-api.md
      form?: {
        fields?: Array<{
          name?: string;
          key?: string;
          label?: string;
          type?: string;
          required?: boolean;
          placeholder?: string;
        }>;
        oauth_url?: string;
      };
    };
    const res = await this.request<SetupWire>(
      'GET',
      `/api/extensions/${encodeURIComponent(name)}/setup`
    );

    const fields: ExtensionSetupSchema['fields'] = [];

    // Map secrets → password fields. Skip already-provided optional ones to
    // avoid asking the user to re-enter a stored key.
    for (const s of res?.secrets ?? []) {
      if (s.provided && s.optional) continue;
      fields.push({
        key: s.name,
        label: s.prompt ?? s.name,
        type: 'password',
        required: s.optional === false,
        placeholder: s.provided ? '••••••••  (re-enter to replace)' : ''
      });
    }

    // Structured fields (current + legacy nested under `form`). The legacy
    // shape doesn't carry placeholder/default/options/description but TS
    // would still let us read those props as `undefined` from a union, so
    // we collapse to a single union and just `?? undefined` everywhere.
    type FieldWire = NonNullable<SetupWire['fields']>[number] & {
      default?: string;
      options?: Array<{ value: string; label: string }>;
      description?: string;
      placeholder?: string;
    };
    const rawFields: FieldWire[] = [
      ...(res?.fields ?? []),
      ...((res?.form?.fields ?? []) as FieldWire[])
    ];
    for (const f of rawFields) {
      const key = f.key ?? f.name ?? '';
      if (!key) continue;
      fields.push({
        key,
        label: f.label ?? key,
        type: (f.type as ExtensionSetupSchema['fields'][number]['type']) ?? 'text',
        required: f.required ?? false,
        placeholder: f.placeholder,
        default: f.default,
        options: f.options,
        description: f.description
      });
    }

    return {
      fields,
      oauth_url: res?.oauth_url ?? res?.form?.oauth_url,
      notes: res?.notes
    };
  }

  async submitExtensionSetup(
    name: string,
    fields: Record<string, unknown>
  ): Promise<{ ok: boolean }> {
    const res = await this.request<{ status?: string }>(
      'POST',
      `/api/extensions/${encodeURIComponent(name)}/setup`,
      fields
    );
    const status = res?.status;
    return { ok: status === 'configured' || status === 'ok' || !status };
  }
}

// ---- Helpers ----------------------------------------------------------------

function normalizeLogLevel(raw: unknown): LogLevel {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'trace' || s === 'debug' || s === 'info' || s === 'warn' || s === 'error') {
    return s;
  }
  // Tracing sometimes emits "warning" or numeric levels; treat the
  // unknown case as `info` so we don't lose entries on the floor.
  if (s === 'warning') return 'warn';
  return 'info';
}

function mapRunStatus(s: string): 'running' | 'success' | 'failed' {
  if (s === 'completed') return 'success';
  if (s === 'running') return 'running';
  // 'failed', 'timeout', and any unknown values surface as failed so UI flags them.
  return 'failed';
}

/**
 * Map the gateway's `kind` field onto the UI's normalized category tag.
 * The current gateway emits values like `wasm_tool`, `wasm_channel`, and
 * `mcp_server`. We collapse anything channel-like to "channel" and
 * MCP-like to "mcp"; everything else passes through verbatim so future
 * categories show up rather than getting silently dropped.
 */
function mapExtensionKind(kind: unknown): string | undefined {
  const k = String(kind ?? '').toLowerCase();
  if (!k) return undefined;
  if (k.includes('channel')) return 'channel';
  if (k.includes('mcp')) return 'mcp';
  if (k.includes('oauth')) return 'oauth';
  // wasm_tool, builtin, etc. — keep the raw value so the badge can still
  // render something sensible.
  return k;
}

/**
 * Normalize a raw SSE payload from the gateway into our tagged ChatEvent.
 * The gateway emits `text_response`, `tool_start`, `tool_result`, `error`
 * today; we map them onto the prompt's intended union as best we can.
 */
function normalizeEvent(raw: Record<string, unknown>): ChatEvent {
  const type = String(raw.type ?? '');
  switch (type) {
    case 'text_response':
      // Treat each text_response as a content_delta — phase 3 may split this
      // into message_start/end once the gateway exposes deltas natively.
      return {
        type: 'content_delta',
        thread_id: raw.thread_id as string | undefined,
        message_id: raw.message_id as string | undefined,
        delta: String(raw.content ?? '')
      };
    case 'tool_start':
      return {
        type: 'tool_call',
        name: String(raw.tool ?? raw.name ?? ''),
        args: raw.args
      };
    case 'tool_result':
      return {
        type: 'tool_result',
        name: String(raw.tool ?? raw.name ?? ''),
        result: raw.result
      };
    case 'message_start':
      return {
        type: 'message_start',
        thread_id: String(raw.thread_id ?? ''),
        message_id: String(raw.message_id ?? '')
      };
    case 'message_end':
      return {
        type: 'message_end',
        thread_id: raw.thread_id as string | undefined,
        message_id: raw.message_id as string | undefined,
        finish_reason: String(raw.finish_reason ?? 'stop')
      };
    case 'error':
      return { type: 'error', message: String(raw.message ?? 'Unknown error') };
    default:
      return { type: 'error', message: `Unknown event type: ${type}` };
  }
}
