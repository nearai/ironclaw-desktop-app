// Type definitions for the IronClaw HTTP API.
//
// These shapes are aligned to the IronClaw gateway responses documented in
// `/tmp/ironclaw-api.md`. Where the wire format differs from the prompt's
// initial sketch, we follow the wire — the client maps wire fields onto
// these convenience shapes for the UI.

/**
 * Normalized chat event union consumed by the UI.
 *
 * Two producers feed this union:
 *
 *  - Legacy `/api/chat/events` SSE channel (default `message`, named
 *    `response`/`tool_start`/`tool_result`/`error`). Wire shapes per
 *    `/tmp/ironclaw-api.md`:
 *      event: response       → {type:"text_response", thread_id, message_id, content}
 *      event: tool_start     → {type:"tool_start", tool, args}
 *      event: tool_result    → {type:"tool_result", tool, result}
 *      event: error          → {type:"error", message}
 *    The legacy stream sends the FULL assistant content per `text_response`
 *    so each event clobbers the buffer — the messages-store heuristic
 *    handles both wire shapes (see `appendStreamingChunk`).
 *
 *  - Responses-API `/api/v1/responses` SSE (verified 2026-05-27 against the
 *    live gateway). Event taxonomy:
 *      event: response.created          → message_start
 *      event: response.output_item.added (item.type='message')   → message_start (assistant)
 *      event: response.output_item.added (item.type='function_call') → tool_call
 *      event: response.output_text.delta (delta: "...")          → content_delta (true delta)
 *      event: response.output_item.done (item.type='function_call') → tool_result (best-effort)
 *      event: response.completed        → message_end
 *      event: response.failed / error   → error
 *    These deltas are real incremental chunks, NOT cumulative — concat them.
 *
 * `tool_call_delta` is a placeholder for future streaming of function-call
 * arguments. The current gateway emits arguments only in the final
 * `output_item.done` envelope; the streaming-arguments shape (`function_call.delta`
 * with a `arguments_delta` chunk) is reserved here for forward compat without
 * forcing a union-shape refactor when it lands.
 */
export type ChatEvent =
  | { type: 'message_start'; thread_id: string; message_id: string }
  | { type: 'content_delta'; thread_id?: string; message_id?: string; delta: string }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_call_delta'; name?: string; arguments_delta: string }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'message_end'; thread_id?: string; message_id?: string; finish_reason: string }
  | { type: 'error'; message: string };

export interface Thread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  /**
   * Number of "messages" in the thread for UI display purposes. The gateway's
   * canonical wire field is `turn_count` (one turn = one user message + one
   * assistant response rolled into a single row); we surface it as
   * `message_count` because that's what the UI reads, and conceptually each
   * turn maps onto one "message" the user sent. If a future server flips the
   * field name to `message_count` directly, the client picks up either.
   */
  message_count: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  created_at: string;
}

export interface MemoryHit {
  path: string;
  snippet: string;
  score: number;
}

export interface MemoryNode {
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

export type SkillTrust = 'Bundled' | 'Verified' | 'Unverified' | string;

export interface Skill {
  name: string;
  description: string;
  version: string;
  installed: boolean;
  /** Provenance/trust level from the server. Server may emit any string; UI
   *  styles only the three documented cases and falls through for others. */
  trust?: SkillTrust;
  /** Raw debug-formatted source descriptor, e.g. `Bundled("code-review")` or
   *  `Git(url)`. Preserved verbatim from the gateway — do not parse. */
  source?: string;
  /** Absolute filesystem path of the skill bundle on the server. */
  bundle_path?: string;
  /** True if the skill declares external dependencies (e.g. requirements.txt). */
  has_requirements?: boolean;
  /** True if the skill ships executable scripts/. */
  has_scripts?: boolean;
  /** Human-friendly invocation hint (e.g. `/code-review`). Prefer over the
   *  client-derived `/${name}` heuristic. */
  usage_hint?: string;
}

export interface Routine {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
}

/**
 * Request body for creating a routine via `POST /api/routines`.
 *
 * NOTE (2026-05-27): The gateway does not yet expose this endpoint —
 * `POST /api/routines` returns 405 Method Not Allowed against IronClaw
 * v0.29.x (verified by direct probe of the live server). The type and
 * the matching client method `IronClawClient.createRoutine` are
 * pre-wired so the UI surface can be added in a follow-up PR once the
 * server lands the handler. Until then, the client throws synchronously
 * and no UI exposes this call.
 */
export interface CreateRoutineRequest {
  /** Human-readable name; 1-128 chars after trim. */
  name: string;
  /** Cron string (e.g. `0 9 * * *`) or human form (e.g. `every 5m`,
   *  `daily 09:00`). The gateway is the source of truth for which
   *  forms it parses. */
  schedule: string;
  /** Agent instruction to execute on schedule. */
  prompt: string;
  /** Default true on the server side; clients can omit. */
  enabled?: boolean;
}

export interface RoutineSummary {
  total: number;
  enabled: number;
  running: number;
  failed_last_24h: number;
}

export interface RoutineRun {
  id: string;
  routine_id: string;
  started_at: string;
  finished_at?: string;
  status: 'running' | 'success' | 'failed';
  output?: string;
}

/**
 * Log level emitted by the gateway's `tracing` filter. Matches the values
 * accepted by GET/POST /api/logs/level on IronClaw v0.29.0+.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * A single log entry yielded by GET /api/logs/events (SSE).
 *
 * The gateway buffers a recent window of entries and replays them on
 * connect, then streams live. `timestamp` is RFC3339 / ISO8601 from the
 * server clock.
 */
export interface LogEntry {
  level: LogLevel;
  /** Module / crate path, e.g. "ironclaw_gateway::chat". */
  target: string;
  message: string;
  /** RFC3339 / ISO8601 timestamp from the server. */
  timestamp: string;
}

/** Convenience response shape returned by IronClawClient.health(). */
export interface HealthStatus {
  ok: boolean;
  status?: string;
  channel?: string;
}

/** Convenience response shape returned by IronClawClient.gatewayStatus().
 *
 * Wire fields (verified against IronClaw 0.28.2 on baremetal3, 2026-05-27):
 *   `{version, sse_connections, ws_connections, total_connections,
 *     uptime_secs, restart_enabled, daily_cost, actions_this_hour,
 *     model_usage, llm_backend, llm_model, enabled_channels, engine_v2_enabled}`
 *
 * Note the wire uses `uptime_secs`, not `uptime_seconds`. The client maps
 * either onto `uptime_seconds` so callers see a stable name.
 */
export interface GatewayStatus {
  version?: string;
  engine_v2_enabled?: boolean;
  llm_model?: string;
  /** LLM backend identifier (e.g. "nearai", "openrouter"). Wire: `llm_backend`. */
  llm_backend?: string;
  enabled_channels: string[];
  sse_connections: number;
  ws_connections: number;
  total_connections: number;
  /** Server uptime in seconds. Wire emits `uptime_secs`; client maps either. */
  uptime_seconds?: number;
  multi_tenant_mode?: boolean;
  /** Daily LLM spend in USD, as a string (server formats e.g. "0.0000"). */
  daily_cost?: string;
  /** Count of agent actions in the trailing hour. */
  actions_this_hour?: number;
  /** Whether the gateway can self-restart (true on supervisord-style installs). */
  restart_enabled?: boolean;
  /** Per-model usage breakdown; shape is opaque (server is the source of truth). */
  model_usage?: unknown[];
}

/**
 * Normalized extension descriptor. The wire shape varies between
 * `/api/extensions` (installed list) and `/api/extensions/registry`
 * (catalog) — both are merged into this single struct, with `installed`
 * indicating which side an entry came from.
 *
 * Wire fields the gateway emits today and the mapping we apply:
 *   - name, display_name, description, version — passed through
 *   - kind ("wasm_tool" | "wasm_channel" | "mcp_server" | …) → `category`
 *   - active, authenticated, needs_setup → `ready` (derived from
 *     `/api/extensions/readiness`'s `phase` when available)
 *   - source (registry vs local vs git) — not currently surfaced by the
 *     gateway; we preserve any string the server gives us
 *   - tool_count is joined in from `/api/extensions/tools`
 *
 * Anything the wire omits is filled with a safe default so the UI never
 * crashes on a missing field.
 */
export interface Extension {
  name: string;
  display_name?: string;
  description?: string;
  version?: string;
  installed: boolean;
  active?: boolean;
  /** True when the extension is ready (auth completed, deps installed). */
  ready?: boolean;
  /** Normalized category — UI uses this for the badge tint. */
  category?: 'mcp' | 'oauth' | 'channel' | string;
  /** Origin descriptor (registry, local, git, …). Wire may omit. */
  source?: string;
  requires_setup?: boolean;
  /** Number of tools this extension contributes (from /tools). */
  tool_count?: number;
  /** Human-readable readiness reason ("needs_auth", "needs_setup", …). */
  readiness_message?: string;
  /** Search keywords from the registry, used for client-side filtering. */
  keywords?: string[];
}

export interface ExtensionTool {
  /**
   * Owning extension name. The current gateway's `/api/extensions/tools`
   * endpoint emits `{name, description}` with NO `extension` field on each
   * tool — builtins and aggregated tools have no parent. The client
   * normalizes missing values to empty-string (`''`) so the field is
   * always typed as `string` and consumers can rely on it being a
   * groupable key. Empty-string means "builtin / no provider".
   */
  extension: string;
  name: string;
  description?: string;
}

/**
 * Admin tool-policy action.
 *
 * The UI surfaces a 3-way radio (allow / prompt / deny) per tool. Note that
 * the IronClaw gateway today only stores a binary policy (`disabled_tools`
 * is an allow-list-of-things-to-deny); `prompt` is the natural default for
 * any tool that isn't on the disabled list, and is treated as equivalent to
 * `allow` on serialization. If the gateway ever grows a per-tool
 * "ask-on-use" mode, this union is the place to thread it through.
 */
export type ToolPolicyAction = 'allow' | 'deny' | 'prompt';

/** Map of `<tool_name>` → action. UI-facing shape. */
export type ToolPolicy = Record<string, ToolPolicyAction>;

/** Field descriptor rendered in the setup drawer's form. */
export interface ExtensionSetupField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'oauth' | 'select' | 'boolean' | string;
  required?: boolean;
  placeholder?: string;
  default?: string;
  options?: Array<{ value: string; label: string }>;
  description?: string;
}

/** Schema returned by GET /api/extensions/{name}/setup. */
export interface ExtensionSetupSchema {
  fields: ExtensionSetupField[];
  /** If oauth-based, the URL to redirect the user to in the system browser. */
  oauth_url?: string;
  notes?: string;
}

/**
 * Active user identity, returned by GET /api/profile.
 *
 * Wire shape today (verified against IronClaw 0.28.2 on baremetal3):
 *   `{avatar_url, created_at, display_name, email, id, last_login_at, role, status}`
 *
 * Not every install carries the same fields — older builds or a single-tenant
 * gateway may omit several. The properties are defensive and tolerant of
 * absence; the consumer derives "is signed in" from whether `/api/profile`
 * returns 200 + a non-empty payload (the gateway answers 401 when no auth
 * cookie/bearer is in flight).
 *
 * `near_account` is forward-looking: today the gateway populates a generic
 * `id` like `"default"` for the local owner, but NEAR-cloud builds may grow
 * a dedicated `near_account` field. The client maps either path onto
 * `near_account` so the UI never has to know about the wire fork.
 */
export interface UserProfile {
  /** Stable user id. `"default"` is the single-tenant local owner marker. */
  user_id?: string;
  /** NEAR account name when signed in via NEAR sign-in, e.g. "dangwalvaidy.near". */
  near_account?: string;
  /** Human-friendly display name. */
  display_name?: string;
  /** Last login timestamp (RFC3339). Null/undefined when never logged in. */
  signed_in_at?: string;
  /** Permission role on the gateway. */
  role?: 'admin' | 'user' | string;
  /** Optional email if the provider supplies one (Google, Apple sign-in). */
  email?: string;
  /** Optional avatar URL. */
  avatar_url?: string;
}
