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

// ---- Jobs ------------------------------------------------------------------
//
// Job APIs are documented in `src/channels/web/features/jobs/mod.rs` on the
// IronClaw gateway. The wire types come from `JobListResponse`,
// `JobSummaryResponse`, `JobDetailResponse`, and the project file helpers.
//
// The gateway tracks TWO classes of jobs in one table:
//   - "sandbox" jobs: per-task containerized workers (Claude Code / ACP / worker
//     modes). These carry a `project_dir` and produce files.
//   - "agent" jobs: long-running agent contexts driven by the scheduler. No
//     project dir; transitions are recorded explicitly.
// Both kinds round-trip through the same /api/jobs endpoints and surface here
// as `Job` with `job_kind` identifying which side.
//
// State strings (wire): `pending` | `in_progress` | `completed` | `failed` |
//   `cancelled` | `stuck`. The summary endpoint also reports `stuck`.

/** Lifecycle state used by the UI. Server emits these verbatim from the
 *  `JobInfo.state` and `JobDetailResponse.state` fields; we keep them as
 *  literals on the union but tolerate unknown strings via the trailing
 *  `string` so a future server-side state doesn't blow up rendering. */
export type JobState =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'stuck'
  | string;

/** Row shape returned by GET /api/jobs (one entry per job). The gateway emits
 *  a thin list: id, title, state, user_id, created_at, started_at. The detail
 *  endpoint enriches with completed_at, transitions, etc — see `JobDetail`. */
export interface Job {
  /** UUID v4. Mono-truncated in lists. */
  id: string;
  /** Free-text title; for sandbox jobs this is the `task` field, for agent
   *  jobs it's the user-supplied `title`. Used as the row label since the
   *  server does not emit a separate `kind` field. */
  title: string;
  state: JobState;
  /** Owner id. `"default"` for the single-tenant local owner. */
  user_id: string;
  /** RFC3339 / ISO8601 from server. */
  created_at: string;
  started_at?: string;
}

/** Summary tile counts. Wire: `{total, pending, in_progress, completed, failed, stuck}`.
 *  Note the wire field is `in_progress` (not `running`); we keep both names
 *  available so callers can read whichever fits their UI vocabulary. */
export interface JobSummary {
  total: number;
  /** Server's `pending` bucket. */
  pending: number;
  /** Server's `in_progress` bucket. Surfaced verbatim. */
  in_progress: number;
  /** Alias for `in_progress` — the UI's tile is labeled "Running" so we
   *  expose this convenience field too. Mirrors `in_progress` 1:1. */
  running: number;
  completed: number;
  failed: number;
  /** Agent jobs whose worker has stopped without a terminal transition.
   *  May stay zero on sandbox-only builds. */
  stuck: number;
}

/** Enriched per-job payload returned by GET /api/jobs/{id}. Adds completion,
 *  transitions, and capability flags (`can_restart`, `can_prompt`). */
export interface JobDetail extends Job {
  description: string;
  completed_at?: string;
  elapsed_secs?: number;
  /** Filesystem path for sandbox jobs (server-side). Undefined for agent jobs. */
  project_dir?: string;
  browse_url?: string;
  /** Job mode descriptor: `claude_code`, `acp:<agent>`, `worker`, or omitted
   *  for agent jobs. Verbatim from server. */
  job_mode?: string;
  transitions: JobTransition[];
  /** Server indicates whether the UI may offer a Restart button. */
  can_restart: boolean;
  /** Server indicates whether the UI may offer follow-up prompts (not used in
   *  v1 of the desktop client, but surfaced so the panel can stay current). */
  can_prompt: boolean;
  /** `"sandbox"` or `"agent"`. Undefined on very old gateways. */
  job_kind?: 'sandbox' | 'agent' | string;
}

/** Single state transition row inside the detail panel timeline. */
export interface JobTransition {
  from: string;
  to: string;
  /** RFC3339 timestamp. */
  timestamp: string;
  /** Failure / cancellation reason; absent on healthy transitions. */
  reason?: string;
}

/** Single event row returned by GET /api/jobs/{id}/events.
 *  Wire shape: `{id, event_type, data, created_at}`. The `data` payload is
 *  opaque JSON — different `event_type` values carry different shapes
 *  (e.g. `tool_call`, `output_text`, `status_change`). The UI renders
 *  `event_type` + a JSON-stringified `data` preview; consumers that want
 *  rich rendering should pattern-match on `event_type` themselves.
 *
 *  Note: the brief described this endpoint as an SSE stream but the live
 *  gateway exposes it as a plain JSON `GET` returning the historical event
 *  list. `streamJobEvents` polls this endpoint at a fixed cadence to give
 *  callers an `AsyncIterable` interface for live updates without forcing a
 *  refactor when the server eventually adds a real SSE channel. */
export interface JobEvent {
  /** Server-assigned event id (UUID). */
  id?: string;
  /** Coarse classifier (e.g. `tool_call`, `output_text`, `status_change`). */
  event_type: string;
  /** Opaque JSON payload. Render as a code snippet. */
  data?: unknown;
  /** RFC3339 timestamp. */
  created_at: string;
}

/** File entry inside a sandbox job's project directory.
 *  Wire shape: `ProjectFileEntry { name, path, is_dir }`.
 *  Size is NOT reported by the current gateway — we keep the field optional
 *  so the UI can surface it once the server starts emitting it. */
export interface JobFile {
  /** Last path segment (filename or directory name). */
  name: string;
  /** Path relative to the job's project root. */
  path: string;
  is_dir: boolean;
  /** Optional metadata — server doesn't emit these today but we keep the
   *  fields available so a richer files endpoint can land without a type
   *  break. */
  size?: number;
  created_at?: string;
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
