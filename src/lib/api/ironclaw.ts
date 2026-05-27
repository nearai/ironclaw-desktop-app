// Typed HTTP client for the IronClaw gateway.
//
// Endpoints are documented in /tmp/ironclaw-api.md. Where the wire format
// differs from the TS types we expose, this client maps fields explicitly
// in the consumer-facing methods so callers see a stable interface.

import type {
  ChatEvent,
  CreateRoutineRequest,
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
  Thread,
  ToolPolicy,
  ToolPolicyAction,
  UserProfile
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
    // Wire (verified 2026-05-27 against IronClaw 0.28.2):
    //   {version, sse_connections, ws_connections, total_connections,
    //    uptime_secs, restart_enabled, daily_cost, actions_this_hour,
    //    model_usage, llm_backend, llm_model, enabled_channels, engine_v2_enabled}
    // Note `uptime_secs` (not `uptime_seconds`). We accept either for
    // forward/backward compat and map onto `uptime_seconds` so callers
    // see a stable field name.
    const res = await this.request<{
      version?: string;
      engine_v2_enabled?: boolean;
      llm_model?: string;
      llm_backend?: string;
      enabled_channels?: string[];
      ws_connections?: number;
      sse_connections?: number;
      total_connections?: number;
      uptime_secs?: number;
      uptime_seconds?: number;
      multi_tenant_mode?: boolean;
      daily_cost?: string;
      actions_this_hour?: number;
      restart_enabled?: boolean;
      model_usage?: unknown[];
    }>('GET', '/api/gateway/status');
    const ws = res?.ws_connections ?? 0;
    const sse = res?.sse_connections ?? 0;
    return {
      version: res?.version,
      engine_v2_enabled: res?.engine_v2_enabled,
      llm_model: res?.llm_model,
      llm_backend: res?.llm_backend,
      enabled_channels: res?.enabled_channels ?? [],
      sse_connections: sse,
      ws_connections: ws,
      total_connections: res?.total_connections ?? ws + sse,
      uptime_seconds: res?.uptime_secs ?? res?.uptime_seconds,
      multi_tenant_mode: res?.multi_tenant_mode,
      daily_cost: res?.daily_cost,
      actions_this_hour: res?.actions_this_hour,
      restart_enabled: res?.restart_enabled,
      model_usage: res?.model_usage
    };
  }

  // ---- Profile / sign-in -----------------------------------------------------

  /**
   * Fetch the currently-signed-in user via GET /api/profile.
   *
   * Wire shape verified against IronClaw 0.28.2:
   *   `{avatar_url, created_at, display_name, email, id, last_login_at, role, status}`
   *
   * Returns `null` on 401/403 — "not signed in" is a valid app state, not an
   * error worth throwing. Network/5xx failures still throw HttpError so the
   * sign-in store can surface them as `status: 'error'`.
   *
   * Map fields defensively: the gateway may emit `near_account`, `account_id`,
   * or `user_id` in different builds; we land all of them on the same struct
   * and let the consumer pick the most-specific value via UI logic.
   */
  async getProfile(): Promise<UserProfile | null> {
    try {
      const raw = await this.request<{
        // current gateway shape
        id?: string;
        display_name?: string;
        email?: string | null;
        avatar_url?: string | null;
        role?: string;
        last_login_at?: string | null;
        status?: string;
        // forward-compat fields (NEAR-cloud builds)
        near_account?: string;
        account_id?: string;
        user_id?: string;
        signed_in_at?: string;
      }>('GET', '/api/profile');

      if (!raw) return null;

      // The local single-tenant gateway uses `id: "default"` for the owner —
      // pass it through verbatim. A NEAR-cloud sign-in surfaces either as a
      // dedicated `near_account` field or as an `id` that ends in `.near` /
      // `.testnet`; treat any of those as the NEAR-account answer.
      const near = (() => {
        if (typeof raw.near_account === 'string' && raw.near_account.length > 0) {
          return raw.near_account;
        }
        if (typeof raw.account_id === 'string' && raw.account_id.length > 0) {
          return raw.account_id;
        }
        const id = raw.id ?? raw.user_id;
        if (
          typeof id === 'string' &&
          (id.endsWith('.near') || id.endsWith('.testnet'))
        ) {
          return id;
        }
        return undefined;
      })();

      return {
        user_id: raw.user_id ?? raw.id,
        near_account: near,
        display_name: raw.display_name ?? undefined,
        signed_in_at: raw.signed_in_at ?? raw.last_login_at ?? undefined,
        role: raw.role as UserProfile['role'],
        email: raw.email ?? undefined,
        avatar_url: raw.avatar_url ?? undefined
      };
    } catch (err) {
      if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
        return null;
      }
      throw err;
    }
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
        const ev = normalizeEvent(parsed);
        if (ev !== null) push(ev);
      } catch (e) {
        push({ type: 'error', message: `parse error: ${(e as Error).message}` });
      }
    };

    // Default `message` event covers payloads sent without an explicit
    // event name; named events are bound individually so we don't lose
    // them. Wire (verified 2026-05-27): the gateway emits
    // `event: thinking`, `event: status`, `event: response`,
    // `event: tool_start`, `event: tool_result`. `thinking` and `status`
    // are progress chatter that `normalizeEvent` returns `null` for;
    // the handler drops nulls before pushing onto the queue.
    es.addEventListener('message', handler);
    es.addEventListener('response', handler);
    es.addEventListener('thinking', handler);
    es.addEventListener('status', handler);
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

  /**
   * Stream a single user turn through the OpenAI-compatible Responses API
   * (`POST /api/v1/responses` with `stream: true`).
   *
   * Unlike the legacy `/api/chat/send` + `/api/chat/events` pair which delivers
   * the full assistant content per event (and so feels jumpy as each new
   * "delta" clobbers the buffer), the Responses-API emits real incremental
   * `response.output_text.delta` chunks. The messages-store heuristic
   * concatenates these correctly because each chunk is small and does not
   * start with the current buffer.
   *
   * Probe (2026-05-27) of the live gateway confirmed the event taxonomy and
   * shape — see `ChatEvent` in `types.ts` for the full mapping. Tool/function
   * calls come back as `response.output_item.{added,done}` envelopes with
   * `item.type === "function_call"`; we synthesize a `tool_call` on `added`
   * and a `tool_result` on `done` so the existing right-rail tool inspector
   * continues to render.
   *
   * The gateway today does NOT accept a `model` parameter (a 400 "Model
   * selection is not yet supported" comes back if one is sent); we omit it.
   * Thread membership is carried via `metadata.thread_id` — the wire schema
   * accepts arbitrary metadata so this is forward-compatible with whatever
   * thread-resolution logic the gateway grows.
   *
   * Uses `fetch` + a manual SSE parser rather than `EventSource` because:
   *   1. `EventSource` cannot attach `Authorization` headers (we'd have to
   *      smuggle the token through a query string and the gateway only
   *      honours headers for `/api/v1/responses` today), and
   *   2. The Responses-API endpoint is POST + body, which `EventSource`
   *      cannot do at all.
   */
  async *streamResponse(
    input: string,
    threadId: string | null,
    signal: AbortSignal
  ): AsyncIterable<ChatEvent> {
    const url = `${this.baseUrl}/api/v1/responses`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
    };
    const body: Record<string, unknown> = {
      input,
      stream: true,
      // Gateway rejects an explicit `model` field today (400 invalid_request).
      // Omit and let the server pick. If a future build accepts `"default"`,
      // we can pass it through.
      ...(threadId ? { metadata: { thread_id: threadId } } : {})
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    });

    if (!res.ok) {
      // Pull the body once for the error message; the stream is dead either
      // way after a non-2xx so reading it is safe.
      let detail = res.statusText;
      try {
        const text = await res.text();
        if (text) detail = text.slice(0, 500);
      } catch {
        // ignore
      }
      throw new HttpError(res.status, url, `${res.status} ${detail}`);
    }
    if (!res.body) {
      throw new Error('Responses API: empty body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      while (true) {
        if (signal.aborted) {
          // Cancel the underlying stream so the gateway can stop generating.
          try { await reader.cancel(); } catch { /* ignore */ }
          break;
        }
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // SSE frames are separated by blank lines (\n\n or \r\n\r\n). Pull
        // each complete frame out of the buffer and parse it; leave any
        // partial trailing frame in `buf` for the next read.
        let frameEnd: number;
        // eslint-disable-next-line no-cond-assign
        while ((frameEnd = findFrameEnd(buf)) !== -1) {
          const rawFrame = buf.slice(0, frameEnd);
          // Advance past the delimiter (\n\n or \r\n\r\n).
          buf = buf.slice(frameEnd + (buf.startsWith('\r\n', frameEnd) ? 2 : 0) + 2);
          const ev = parseSseFrame(rawFrame);
          if (!ev) continue;
          for (const out of mapResponsesEvent(ev)) {
            yield out;
          }
        }
      }
    } catch (err) {
      if (signal.aborted) return;
      // Surface as a single error event so the caller's existing handler
      // path renders it without a try/catch around the for-await.
      yield { type: 'error', message: (err as Error).message };
    } finally {
      try { reader.releaseLock(); } catch { /* ignore */ }
    }
  }

  /**
   * Detect which streaming endpoints this gateway supports.
   *
   * The OpenAI-compatible Responses API was added to IronClaw v0.29.x.
   * Older gateways only expose `/api/chat/send` + `/api/chat/events`. We
   * probe with a cheap method-mismatch (`GET /api/v1/responses`) so we
   * never actually start a generation just to find out — the gateway
   * answers 405 Method Not Allowed (with `Allow: POST`) when the route
   * exists and 404 when it doesn't. Either of these signals what we need
   * without spending tokens.
   *
   * Result is cached on the client instance for the lifetime of the
   * connection so repeated sends don't re-probe. A fresh
   * `IronClawClient` (e.g. after a profile switch) re-probes from scratch.
   */
  async getServerCapabilities(): Promise<{ responses_api: boolean }> {
    if (this._capabilitiesCache) return this._capabilitiesCache;
    const url = `${this.baseUrl}/api/v1/responses`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : {}
      });
      // 405 = route exists but doesn't accept GET → supports POST streaming.
      // 401/403 = route exists and would have served us if we'd been authed
      //   for it — still counts as "available" (the streaming POST carries
      //   the bearer and will succeed).
      // 200 = unexpected, but treat as available.
      // 404 = no such route → fall back to legacy /api/chat path.
      // Anything else (5xx, network) → conservative: report unavailable so
      //   the caller uses the well-trodden legacy path.
      const available =
        res.status === 405 ||
        res.status === 401 ||
        res.status === 403 ||
        (res.status >= 200 && res.status < 300);
      this._capabilitiesCache = { responses_api: available };
      return this._capabilitiesCache;
    } catch {
      this._capabilitiesCache = { responses_api: false };
      return this._capabilitiesCache;
    }
  }

  private _capabilitiesCache: { responses_api: boolean } | null = null;

  async listThreads(): Promise<Thread[]> {
    // Wire (verified 2026-05-27): each thread carries `turn_count` (one turn =
    // one user msg + one assistant response rolled into one row). Older /
    // future server builds may emit `message_count`; accept either. The
    // server also returns an `assistant_thread` field at the top level (a
    // long-running assistant scratch thread, distinct from the user threads);
    // we ignore it here — callers can probe `/api/chat/threads` directly if
    // they need it.
    const res = await this.request<{
      threads?: Array<{
        id: string;
        title?: string;
        created_at: string;
        last_message_at?: string;
        updated_at?: string;
        turn_count?: number;
        message_count?: number;
      }>;
    }>('GET', '/api/chat/threads');
    return (res?.threads ?? []).map((t) => ({
      id: t.id,
      title: t.title ?? '',
      created_at: t.created_at,
      updated_at: t.last_message_at ?? t.updated_at ?? t.created_at,
      message_count: t.turn_count ?? t.message_count ?? 0
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
    // Wire (verified 2026-05-27): server returns
    //   {thread_id, turns: [{turn_number, user_message_id, user_input,
    //                        response, response_id?, state, started_at,
    //                        completed_at, tool_calls}], has_more, oldest_timestamp}
    // Each turn = ONE user message + ONE assistant response, rolled into a
    // single row. Expand into the flat [user, assistant, …] sequence the UI
    // expects, ordered by turn_number.
    //
    // Older / future server builds may emit a flat `messages: [{id, role,
    // content, …}]` directly; we accept either shape and fall through to a
    // verbatim mapping when present.
    const res = await this.request<{
      messages?: Array<{
        id: string;
        role: 'user' | 'assistant' | 'tool';
        content: string;
        timestamp?: string;
        created_at?: string;
      }>;
      turns?: Array<{
        turn_number?: number;
        user_message_id?: string;
        user_input?: string;
        response?: string;
        response_id?: string;
        started_at?: string;
        completed_at?: string;
      }>;
    }>('GET', `/api/chat/history?${qs.toString()}`);

    // Flat messages path (forward/back compat with hypothetical server build).
    if (Array.isArray(res?.messages)) {
      return res.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at ?? m.timestamp ?? ''
      }));
    }

    // Canonical wire today: turns[] expanded to messages[].
    const turns = (res?.turns ?? [])
      .slice()
      .sort((a, b) => (a.turn_number ?? 0) - (b.turn_number ?? 0));

    const messages: Message[] = [];
    for (const t of turns) {
      const userTs = t.started_at ?? '';
      const asstTs = t.completed_at ?? t.started_at ?? '';
      const turnNo = t.turn_number ?? messages.length;
      // User half. Always emit; an empty user_input is still a row so the
      // ordering stays right.
      messages.push({
        id: t.user_message_id ?? `turn-${turnNo}-user`,
        role: 'user',
        content: t.user_input ?? '',
        created_at: userTs
      });
      // Assistant half. Skip when the turn has no response yet (in-flight
      // turns can land here mid-stream).
      if (typeof t.response === 'string' && t.response.length > 0) {
        messages.push({
          id: t.response_id ?? `turn-${turnNo}-asst`,
          role: 'assistant',
          content: t.response,
          created_at: asstTs
        });
      }
    }
    return messages;
  }

  async newThread(title?: string): Promise<{ id: string }> {
    const res = await this.request<{ thread_id: string; id?: string }>(
      'POST',
      '/api/chat/thread/new',
      title ? { title } : {}
    );
    return { id: res.thread_id ?? res.id ?? '' };
  }

  /**
   * Delete a conversation thread.
   *
   * NOTE (2026-05-27): The gateway does not currently expose this endpoint.
   * Direct probe of the live server confirms `DELETE /api/chat/threads/{id}`
   * returns 404 (no matching route in
   * `src/channels/web/platform/router.rs`). The method is pre-wired so the
   * delete affordance can be added in one PR once the server lands the
   * handler; right now it falls through to the gateway and returns the
   * 404 as an HttpError so any caller fails loudly rather than silently
   * "succeeding". No UI surfaces this call yet.
   *
   * Expected wire shape once implemented (mirrors `DELETE /api/routines/{id}`):
   *   Response: 200 OK
   *   Body: {"status": "deleted", "id": "thread-uuid"}
   */
  async deleteThread(threadId: string): Promise<{ ok: boolean }> {
    const res = await this.request<{ status?: string; id?: string }>(
      'DELETE',
      `/api/chat/threads/${encodeURIComponent(threadId)}`
    );
    return { ok: res?.status === 'deleted' || res?.status === 'ok' };
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

  /**
   * Delete a memory document at `path`.
   *
   * NOTE (2026-05-27): The gateway does not currently expose this endpoint.
   * Direct probe of the live server confirms BOTH attempted shapes return
   * 404 (no matching route in `src/channels/web/platform/router.rs`):
   *   - `DELETE /api/memory?path=...`
   *   - `POST   /api/memory/delete`  (body `{path}`)
   *
   * The method is pre-wired so the delete affordance can be added in one PR
   * once the server lands the handler. It tries DELETE first and falls back
   * to POST on 404/405 (per the prompt's preferred wire shapes); the final
   * HttpError is rethrown so callers fail loudly rather than silently
   * succeeding. No UI surfaces this call yet.
   */
  async deleteMemory(path: string): Promise<{ ok: boolean }> {
    // Try DELETE /api/memory?path=... first (preferred RESTful shape).
    const qs = new URLSearchParams({ path });
    try {
      const res = await this.request<{ status?: string; path?: string }>(
        'DELETE',
        `/api/memory?${qs.toString()}`
      );
      return { ok: res?.status === 'deleted' || res?.status === 'ok' };
    } catch (err) {
      // Fall back to POST /api/memory/delete on Method Not Allowed (405) or
      // 404 — the latter covers the case where the route shape is different
      // than expected.
      if (
        err instanceof HttpError &&
        (err.status === 405 || err.status === 404)
      ) {
        const res = await this.request<{ status?: string; path?: string }>(
          'POST',
          '/api/memory/delete',
          { path }
        );
        return { ok: res?.status === 'deleted' || res?.status === 'ok' };
      }
      throw err;
    }
  }

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

  /**
   * Create a new routine via `POST /api/routines`.
   *
   * NOTE (2026-05-27): The gateway does not yet implement this endpoint.
   * Direct probe of the live server returns 405 Method Not Allowed against
   * IronClaw v0.29.x — the route exists for GET (list) but no POST handler
   * is registered. The method is pre-wired so the create-routine UI can be
   * added in one PR once the server lands the handler; until then it falls
   * through to the gateway and rethrows the 405 as an HttpError so any
   * caller fails loudly rather than silently "succeeding". No UI surfaces
   * this call yet.
   *
   * Expected wire shape once implemented (best-guess; the server-side schema
   * is the source of truth):
   *   Request:  {name, schedule, prompt, enabled?}
   *   Response: 201 CREATED
   *   Body:     {id, name, schedule, enabled, ...the same shape as GET /api/routines}
   *
   * If the server eventually accepts a richer trigger shape (e.g.
   * `{trigger: {type: "cron", cron_expr: "0 9 * * *"}, action: {prompt: "…"}}`),
   * remap inside this method — keep the client-facing `CreateRoutineRequest`
   * stable so route code doesn't need to know the wire details.
   */
  async createRoutine(req: CreateRoutineRequest): Promise<Routine> {
    const body: Record<string, unknown> = {
      name: req.name,
      schedule: req.schedule,
      prompt: req.prompt
    };
    if (req.enabled !== undefined) body.enabled = req.enabled;
    const res = await this.request<{
      id: string;
      name?: string;
      enabled?: boolean;
      trigger_summary?: string;
      trigger_raw?: string;
      last_run_at?: string;
      next_fire_at?: string;
    }>('POST', '/api/routines', body);
    return {
      id: res.id,
      name: res.name ?? req.name,
      schedule: res.trigger_summary ?? res.trigger_raw ?? req.schedule,
      enabled: res.enabled ?? req.enabled ?? true,
      last_run: res.last_run_at,
      next_run: res.next_fire_at
    };
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

  /**
   * Fetch the server's full settings document.
   *
   * Wire (verified 2026-05-27 against IronClaw 0.28.2):
   *   `{settings: [{key, value, updated_at}, …]}`  — an ARRAY of rows.
   * The earlier client typed the wire as `{settings: Record<string, unknown>}`
   * and returned it verbatim; consumers iterating keys received numeric
   * array indexes instead. We now fold the array into a `{<key>: <value>}`
   * map so callers see the object shape they expect.
   *
   * Older / hypothetical server builds may emit the map shape directly;
   * we accept both for defense-in-depth.
   *
   * TODO(security, 2026-05-27): the server's `mcp_servers` value embeds
   * raw bearer tokens (e.g. `Authorization: Bearer sk-agent-…`) in
   * single-tenant owner installs. The smoke test (Round 7e) confirmed
   * this against baremetal3. Callers displaying the returned object MUST
   * sanitize values matching `Bearer\s+\S+` and `sk-[a-zA-Z0-9_-]+`
   * patterns before rendering, or gate the surface behind an explicit
   * "show secrets" toggle. A Tauri-side warning is the right long-term
   * fix; until then this lives at the call site.
   */
  async getSettings(): Promise<Record<string, unknown>> {
    const res = await this.request<{
      settings?:
        | Array<{ key: string; value: unknown; updated_at?: string }>
        | Record<string, unknown>;
    }>('GET', '/api/settings');
    const raw = res?.settings;
    if (Array.isArray(raw)) {
      return Object.fromEntries(
        raw
          .filter(
            (row): row is { key: string; value: unknown; updated_at?: string } =>
              !!row && typeof row.key === 'string'
          )
          .map((row) => [row.key, row.value])
      );
    }
    if (raw && typeof raw === 'object') {
      return raw;
    }
    return {};
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

    // Count tools per extension. The current gateway emits a flat
    // `/api/extensions/tools` list with NO `extension` field on each tool
    // (verified 2026-05-27), so this map is empty in practice — every
    // extension falls through to the inline `e.tools` count below. Kept
    // because a future server build may surface `extension` again and the
    // join becomes meaningful at that point. We skip empty-string entries
    // ("builtin / no provider") since they're not attributable.
    const toolCounts = new Map<string, number>();
    for (const t of tools) {
      if (t.extension.length === 0) continue;
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
        // Prefer the joined count from /api/extensions/tools when present,
        // otherwise fall back to the inline `tools[]` array the base list
        // emits (currently the only path that yields a non-zero count).
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

  /** Flat list of tools provided by installed extensions.
   *
   * Wire (verified 2026-05-27): server returns `{tools: [{name, description}]}`
   * with NO `extension` field on each tool — the current gateway aggregates
   * builtins + MCP-server tools into a single flat list without provenance.
   * The earlier client filtered to `t.extension` truthy and silently dropped
   * every entry, collapsing every extension's `tool_count` display to 0. We
   * now accept the bare `{name, description}` shape and normalise the
   * missing `extension` to empty-string (`''`) so consumers always get a
   * groupable string key.
   *
   * NOTE: because the wire doesn't carry provenance today, `listExtensions`'s
   * per-extension `tool_count` join via this method will yield 0 for every
   * extension and fall through to each extension's own `tools[]` array
   * (populated by `/api/extensions`). The count is still meaningful for
   * extensions that publish their tool list inline.
   */
  async extensionTools(): Promise<ExtensionTool[]> {
    const res = await this.request<{
      tools?: Array<{
        name: string;
        extension?: string;
        description?: string;
      }>;
    }>('GET', '/api/extensions/tools');
    return (res?.tools ?? [])
      .filter((t) => typeof t?.name === 'string' && t.name.length > 0)
      .map((t) => ({
        // Empty-string `extension` ("") means "builtin / no provider" —
        // a stable key consumers can group on without nullable handling.
        extension: typeof t.extension === 'string' ? t.extension : '',
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

  // ---- Admin: tool policy + system prompt ------------------------------
  //
  // The gateway's admin surface (multi-tenant only) is intentionally narrow:
  //   - GET/PUT /api/admin/tool-policy   — global disabled-tools list
  //   - GET/PUT /api/admin/system-prompt — admin-scoped SYSTEM.md
  //
  // The wire shape DIFFERS from the prompt's initial sketch and is the
  // source of truth:
  //   - tool-policy wire is `{disabled_tools: string[], user_disabled_tools: {…}}`,
  //     not `{policy: {<tool>: 'allow'|'deny'|'prompt'}}`. The client maps
  //     between the two — the UI-facing 3-way action collapses to a flat
  //     `disabled_tools` set on save (anything not `'deny'` is omitted from
  //     the list).
  //   - system-prompt wire is `{content: string, updated_at?: string}`, not
  //     `{prompt: string}`. We expose `prompt` on the client return for the
  //     route's convenience but accept either field name defensively in
  //     case the gateway changes its mind.
  //
  // 404 from the gateway means single-tenant mode (or the route is gone);
  // 401/403 means the bearer isn't an admin. Both surface as HttpError;
  // callers map status codes to user-facing copy.

  /**
   * Fetch the admin tool policy. Returns the wire shape unchanged so callers
   * can present whatever subset they care about (the UI editor turns
   * `disabled_tools` into a per-tool 3-way action).
   */
  async getToolPolicy(): Promise<{
    policy: ToolPolicy;
    disabled_tools: string[];
    user_disabled_tools: Record<string, string[]>;
  }> {
    // Accept several shapes defensively: the documented `{disabled_tools, …}`
    // raw form, an envelope `{policy: {…}}` (in case the gateway ever wraps
    // its response), and the prompt's original `{policy: {<tool>: action}}`
    // mapping (if a future server version exposes a true 3-state model).
    const raw = await this.request<{
      disabled_tools?: string[];
      user_disabled_tools?: Record<string, string[]>;
      policy?:
        | Record<string, ToolPolicyAction>
        | {
            disabled_tools?: string[];
            user_disabled_tools?: Record<string, string[]>;
          };
    }>('GET', '/api/admin/tool-policy');

    // Unwrap `{policy: {…}}` envelope if present, otherwise treat the root
    // as the policy object directly.
    const root: {
      disabled_tools?: string[];
      user_disabled_tools?: Record<string, string[]>;
    } = (() => {
      if (raw?.policy && typeof raw.policy === 'object') {
        const p = raw.policy as Record<string, unknown>;
        if (Array.isArray(p.disabled_tools) || p.user_disabled_tools) {
          return p as {
            disabled_tools?: string[];
            user_disabled_tools?: Record<string, string[]>;
          };
        }
      }
      return raw as {
        disabled_tools?: string[];
        user_disabled_tools?: Record<string, string[]>;
      };
    })();

    const disabled = Array.isArray(root.disabled_tools)
      ? root.disabled_tools.filter((s) => typeof s === 'string')
      : [];
    const userOverrides =
      root.user_disabled_tools && typeof root.user_disabled_tools === 'object'
        ? (root.user_disabled_tools as Record<string, string[]>)
        : {};

    // Build the UI-facing policy map. Only `deny` entries are recorded;
    // unknown tools default to `'prompt'` at the editor level.
    const policy: ToolPolicy = {};
    for (const name of disabled) policy[name] = 'deny';

    // Last-chance fallback: if the server ever emits the prompt's original
    // `{policy: {<tool>: 'allow'|'deny'|'prompt'}}` shape, surface it verbatim.
    if (
      raw?.policy &&
      typeof raw.policy === 'object' &&
      !Array.isArray((raw.policy as Record<string, unknown>).disabled_tools) &&
      !(raw.policy as Record<string, unknown>).user_disabled_tools
    ) {
      for (const [k, v] of Object.entries(raw.policy)) {
        if (v === 'allow' || v === 'deny' || v === 'prompt') {
          policy[k] = v;
        }
      }
    }

    return {
      policy,
      disabled_tools: disabled,
      user_disabled_tools: userOverrides
    };
  }

  /**
   * Replace the admin tool policy. Accepts the UI's 3-way map and
   * serializes to the wire shape — `deny` becomes part of `disabled_tools`,
   * `allow`/`prompt` are omitted (the gateway treats absence as enabled).
   *
   * `userOverrides` lets the caller round-trip the (per-user) overrides
   * that the bulk editor doesn't currently expose; pass the value returned
   * by `getToolPolicy()` to preserve it.
   */
  async setToolPolicy(
    policy: ToolPolicy,
    userOverrides: Record<string, string[]> = {}
  ): Promise<{ ok: boolean }> {
    const disabled_tools = Object.entries(policy)
      .filter(([, action]) => action === 'deny')
      .map(([name]) => name)
      .sort();
    const body = {
      disabled_tools,
      user_disabled_tools: userOverrides
    };
    // The gateway echoes the saved policy on PUT, but we don't surface it —
    // the caller re-reads via getToolPolicy() if it wants the canonical
    // post-save state. Treat any 2xx as success.
    await this.request<unknown>('PUT', '/api/admin/tool-policy', body);
    return { ok: true };
  }

  /**
   * Fetch the admin system prompt (admin-scoped SYSTEM.md). Returns
   * `prompt: ''` if no prompt has been configured — the gateway maps the
   * "document missing" case to an empty string already.
   */
  async getSystemPrompt(): Promise<{ prompt: string; updated_at?: string }> {
    const res = await this.request<{
      content?: string;
      prompt?: string;
      updated_at?: string | null;
    }>('GET', '/api/admin/system-prompt');
    // Wire is `{content}`; accept the prompt's original `{prompt}` shape too.
    const prompt = res?.content ?? res?.prompt ?? '';
    return {
      prompt,
      updated_at: res?.updated_at ?? undefined
    };
  }

  /**
   * Replace the admin system prompt. Server caps the body at 64 KB and
   * returns 413 over that; callers should validate length client-side as
   * well to surface a friendlier error.
   *
   * Sends both `content` (wire shape) and `prompt` (prompt's original) so a
   * server build that flipped the field name still accepts the write.
   */
  async setSystemPrompt(prompt: string): Promise<{ ok: boolean }> {
    await this.request<unknown>('PUT', '/api/admin/system-prompt', {
      content: prompt,
      prompt
    });
    return { ok: true };
  }

  /**
   * List every tool name the agent can invoke — including builtins that
   * don't have an `extension` field on the wire (which `extensionTools()`
   * filters out). Used by the admin tool-policy editor so the table shows
   * a complete picture, not just MCP-provided tools.
   *
   * Shape: `{name, description?, extension?}`. `extension` is undefined for
   * builtins. Sorted by name for stable rendering.
   */
  async listAllTools(): Promise<ExtensionTool[]> {
    const res = await this.request<{
      tools?: Array<{
        name: string;
        extension?: string;
        description?: string;
      }>;
    }>('GET', '/api/extensions/tools');
    return (res?.tools ?? [])
      .filter((t) => typeof t?.name === 'string' && t.name.length > 0)
      .map((t) => ({
        // Empty-string `extension` ("") is preserved as "" so callers can
        // distinguish "builtin / no provider" from "unknown" via length.
        extension: typeof t.extension === 'string' ? t.extension : '',
        name: t.name,
        description: t.description
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
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
 * Find the index of the end of the first complete SSE frame in `buf`, where
 * a frame is delimited by `\n\n` or `\r\n\r\n`. Returns -1 if no complete
 * frame is buffered yet. The returned index points at the FIRST byte of the
 * delimiter — caller skips two bytes past it (and an extra two for CRLF) to
 * advance.
 */
function findFrameEnd(buf: string): number {
  const lf = buf.indexOf('\n\n');
  const crlf = buf.indexOf('\r\n\r\n');
  if (lf === -1 && crlf === -1) return -1;
  if (lf === -1) return crlf;
  if (crlf === -1) return lf;
  return Math.min(lf, crlf);
}

/**
 * Parse a single SSE frame (one or more `field: value` lines) into
 * `{event, data}`. Multi-line `data:` continuations are joined with `\n`
 * per the SSE spec; everything else is ignored — we don't need `id:` or
 * `retry:` for the chat stream.
 *
 * Returns null for empty frames (just a comment / heartbeat).
 */
function parseSseFrame(frame: string): { event: string; data: string } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const rawLine of frame.split(/\r?\n/)) {
    const line = rawLine;
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    // SSE spec: a single leading space after the colon is stripped.
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
    // id, retry, and unknown fields ignored.
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

/**
 * Map a Responses-API SSE frame onto zero, one, or more ChatEvent values.
 *
 * Emits multiple events in a few cases:
 *   - `response.completed` with a non-empty `content` already streamed via
 *     `output_text.delta` does NOT re-emit (the delta path is canonical).
 *   - `response.output_item.added` of `function_call` synthesizes a single
 *     `tool_call` (the matching `done` envelope synthesizes a `tool_result`).
 *
 * Returns [] for control events that don't carry UI-relevant state
 * (e.g. `output_item.added` for an assistant `message` shell — the
 * subsequent `output_text.delta` is what we render).
 */
function mapResponsesEvent(ev: { event: string; data: string }): ChatEvent[] {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(ev.data) as Record<string, unknown>;
  } catch (e) {
    return [{ type: 'error', message: `parse error: ${(e as Error).message}` }];
  }
  const type = String(raw.type ?? ev.event ?? '');
  switch (type) {
    case 'response.created': {
      const resp = (raw.response as Record<string, unknown> | undefined) ?? {};
      const id = String(resp.id ?? '');
      return [
        {
          type: 'message_start',
          thread_id: '',
          message_id: id
        }
      ];
    }
    case 'response.output_item.added': {
      const item = (raw.item as Record<string, unknown> | undefined) ?? {};
      const itemType = String(item.type ?? '');
      if (itemType === 'function_call') {
        // The wire packs both `name` and `arguments` in this envelope.
        // `arguments` is empty here on this gateway today; the final
        // shape lives in `output_item.done` instead. Surface whatever
        // arrived so the right-rail can render the call shell.
        const argsStr = String(item.arguments ?? '');
        let args: unknown = argsStr;
        if (argsStr.length > 0) {
          try {
            args = JSON.parse(argsStr);
          } catch {
            // Keep raw string if arguments aren't JSON (e.g. the
            // demo gateway emits `memory_search(hermes)` as the name
            // with empty args).
          }
        }
        return [
          {
            type: 'tool_call',
            name: String(item.name ?? ''),
            args
          }
        ];
      }
      // Assistant message shell — nothing to render yet; deltas follow.
      return [];
    }
    case 'response.output_text.delta': {
      // Real incremental chunk; concat path in messages store.
      const delta = String(raw.delta ?? '');
      if (delta.length === 0) return [];
      return [{ type: 'content_delta', delta }];
    }
    case 'response.function_call.arguments.delta': {
      // Forward-compat: a future gateway version may stream tool arguments
      // incrementally. The shape isn't observed in production today but is
      // documented in OpenAI's Responses API; if it shows up, surface it as
      // a `tool_call_delta` for any consumer that wants to render partial
      // arguments.
      const delta = String(raw.delta ?? raw.arguments_delta ?? '');
      if (delta.length === 0) return [];
      return [{ type: 'tool_call_delta', arguments_delta: delta }];
    }
    case 'response.output_item.done': {
      const item = (raw.item as Record<string, unknown> | undefined) ?? {};
      const itemType = String(item.type ?? '');
      if (itemType === 'function_call') {
        // The gateway doesn't emit a dedicated tool_result event today —
        // synthesize one from the completed call envelope. `result` is
        // unknown to us at this point (the model runs the tool server-side
        // and emits the next assistant message), so we record an empty
        // result; the right-rail flips the call from "Running…" to "done".
        const argsStr = String(item.arguments ?? '');
        let result: unknown = argsStr;
        if (argsStr.length > 0) {
          try {
            result = JSON.parse(argsStr);
          } catch {
            // keep raw
          }
        } else {
          result = '';
        }
        return [
          {
            type: 'tool_result',
            name: String(item.name ?? ''),
            result
          }
        ];
      }
      return [];
    }
    case 'response.completed': {
      const resp = (raw.response as Record<string, unknown> | undefined) ?? {};
      return [
        {
          type: 'message_end',
          message_id: String(resp.id ?? ''),
          finish_reason: String(resp.status ?? 'completed')
        }
      ];
    }
    case 'response.failed':
    case 'response.error':
    case 'error': {
      const err = (raw.error as Record<string, unknown> | undefined) ?? raw;
      const message = String(err.message ?? raw.message ?? 'Responses API error');
      return [{ type: 'error', message }];
    }
    default:
      // Unknown event type — drop silently. We don't want to spam the UI
      // with errors when the gateway adds a new event kind we don't
      // recognize (e.g. a future `response.reasoning.delta`).
      return [];
  }
}

/**
 * Normalize a raw SSE payload from the gateway into our tagged ChatEvent.
 *
 * Wire (verified 2026-05-27 against IronClaw 0.28.2):
 *   - `type: "response"`     — assistant content (FULL content per event,
 *                              not incremental). Mapped to `content_delta`;
 *                              the messages-store heuristic handles the
 *                              clobber-vs-append duality.
 *   - `type: "thinking"`     — progress chatter ("Calling LLM…", "Step
 *                              complete — 1234 in / 56 out tokens"). DROPPED.
 *   - `type: "status"`       — short status pings ("Done"). DROPPED.
 *   - `type: "tool_start"`   — tool invocation start.
 *   - `type: "tool_result"`  — tool invocation result.
 *   - `type: "error"`        — server-side error.
 *   - `type: "text_response"`— LEGACY (kept for older gateways).
 *   - `type: "message_start"`/`message_end` — forward-compat.
 *
 * Returns `null` for dropped event types so the SSE handler can skip
 * pushing them onto the consumer queue without producing UI noise.
 */
function normalizeEvent(raw: Record<string, unknown>): ChatEvent | null {
  const type = String(raw.type ?? '');
  switch (type) {
    case 'response':
    case 'text_response':
      // Server emits the FULL assistant content per event (not an
      // incremental delta). Surface as `content_delta` — the messages-store
      // heuristic handles full-clobber vs. true-delta. `text_response` is
      // retained for older gateways that haven't switched to the bare
      // `response` type yet.
      return {
        type: 'content_delta',
        thread_id: raw.thread_id as string | undefined,
        message_id: raw.message_id as string | undefined,
        delta: String(raw.content ?? '')
      };
    case 'thinking':
    case 'status':
      // Progress / status chatter — drop silently. The UI shows its own
      // streaming spinner; this stream isn't the place to surface
      // "Calling LLM…" or per-step token counts.
      return null;
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
