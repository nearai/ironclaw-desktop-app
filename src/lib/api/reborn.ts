// IronClaw Reborn — WebChat v2 client contract (pure core).
//
// The desktop client originally targeted the v1 gateway (`/api/chat/*`,
// `/api/engine/*`, …). IronClaw Reborn replaces that with a narrower,
// projection-driven WebChat v2 surface under `/api/webchat/v2/*`. This module
// is the *pure* core of the migration: DTO types, the idempotency-key helper,
// and the timeline/event → UI-message mappers. It performs no I/O, so it is
// fully unit-testable; the transport (fetch/SSE over the Tauri http plugin)
// lives on the client class and calls into these helpers.
//
// Shapes are reverse-engineered from the reborn-integration WebChat v2 SPA
// (`crates/ironclaw_webui_v2_static/static/js`), which is the authoritative
// consumer of the Rust DTOs in `ironclaw_product_workflow::webui_inbound` /
// `::reborn_services::types`.

export const V2_BASE = '/api/webchat/v2';

// ---- Idempotency key ------------------------------------------------------

/**
 * Client action id (idempotency key) required on every mutating v2 request.
 * Must be a non-empty token with no control characters; `crypto.randomUUID`
 * satisfies the server-side validator (`webui_inbound::parse_client_action_id`).
 */
export function clientActionId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  c?.getRandomValues?.(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---- Request / response DTOs ---------------------------------------------

export interface CreateThreadRequest {
  client_action_id: string;
  requested_thread_id?: string;
}

/** `createThread` → `{ thread: { thread_id } }`. */
export interface CreateThreadResponse {
  thread?: { thread_id?: string };
}

export interface ThreadSummary {
  thread_id: string;
  title?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

/** `listThreads` → `{ threads, next_cursor }` (field names tolerated loosely). */
export interface ListThreadsResponse {
  threads?: ThreadSummary[];
  items?: ThreadSummary[];
  next_cursor?: string | null;
  cursor?: string | null;
}

export interface SendMessageRequest {
  client_action_id: string;
  content: string;
}

/** `sendMessage` → `{ run_id, thread_id?, status? }`. */
export interface SendMessageResponse {
  run_id?: string;
  thread_id?: string;
  status?: string | null;
}

/** One row of a `RebornTimelineResponse`. */
export interface ThreadMessageRecord {
  kind: string;
  message_id?: string;
  content?: string;
  status?: string;
  sequence?: number;
  turn_run_id?: string | null;
  actor_id?: string | null;
  received_at?: string | null;
  created_at?: string | null;
}

export interface RebornTimelineResponse {
  records?: ThreadMessageRecord[];
  messages?: ThreadMessageRecord[];
  next_cursor?: string | null;
  cursor?: string | null;
  has_more?: boolean;
}

export interface CancelRunRequest {
  client_action_id: string;
  reason?: string;
}

export type GateResolution = 'approved' | 'denied' | 'credential_provided' | 'cancelled';

export interface ResolveGateRequest {
  client_action_id: string;
  resolution: GateResolution;
  always?: boolean;
  credential_ref?: string;
}

// ---- UI message + tool-card shapes ---------------------------------------

export type RebornRole = 'user' | 'assistant' | 'system' | 'tool_activity' | 'error';

export interface RebornToolCard {
  invocationId: string;
  callId: string;
  toolName: string;
  toolStatus: 'running' | 'success' | 'error';
  toolDetail: string | null;
  toolParameters: string | null;
  toolResultPreview: string | null;
  toolError: string | null;
  toolDurationMs: number | null;
  updatedAt: string | null;
  resultRef: string | null;
  truncated: boolean;
  outputBytes: number | null;
  outputKind: string | null;
}

export interface RebornMessage extends Partial<RebornToolCard> {
  id: string;
  role: RebornRole;
  content?: string;
  timestamp?: string | null;
  kind?: string;
  status?: string;
  sequence?: number;
  turnRunId?: string | null;
  isOptimistic?: boolean;
  error?: string;
}

export interface RebornGate {
  kind: 'gate' | 'auth_required';
  runId: string;
  gateRef: string;
  headline?: string;
  body?: string;
}

export interface RebornActiveRun {
  runId: string | null;
  threadId: string | null;
  status: string | null;
}

// ---- Tool-card mappers (ported from history-messages.js) ------------------

interface CapabilityPreview {
  invocation_id: string;
  capability_id?: string;
  title?: string;
  subtitle?: string;
  status?: string;
  input_summary?: string;
  output_preview?: string;
  output_summary?: string;
  result_ref?: string;
  updated_at?: string;
  truncated?: boolean;
  output_bytes?: number;
  output_kind?: string;
}

interface CapabilityActivity {
  invocation_id: string;
  capability_id?: string;
  status?: string;
  error_kind?: string;
  updated_at?: string;
  output_bytes?: number;
}

export function toolStatusFromActivityStatus(
  status: string | undefined
): RebornToolCard['toolStatus'] {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
    case 'killed':
      return 'error';
    case 'started':
    case 'running':
    default:
      return 'running';
  }
}

export function isTerminalToolStatus(status: string | undefined): boolean {
  return status === 'success' || status === 'error';
}

/** Map a `CapabilityDisplayPreview{Envelope,View}` into a tool card. */
export function toolCardFromPreview(preview: CapabilityPreview): RebornToolCard {
  const failed = preview.status === 'failed' || preview.status === 'killed';
  return {
    invocationId: preview.invocation_id,
    callId: preview.invocation_id,
    toolName: preview.title || preview.capability_id || 'tool',
    toolStatus: toolStatusFromActivityStatus(preview.status),
    toolDetail: preview.subtitle || null,
    toolParameters: preview.input_summary || null,
    // On failure the output fields carry the error text — surface it only via
    // toolError so the card renders it once (red), not twice.
    toolResultPreview: failed ? null : preview.output_preview || preview.output_summary || null,
    toolError: failed
      ? preview.output_summary || preview.output_preview || preview.result_ref || null
      : null,
    toolDurationMs: null,
    updatedAt: preview.updated_at || null,
    resultRef: preview.result_ref || null,
    truncated: Boolean(preview.truncated),
    outputBytes: preview.output_bytes ?? null,
    outputKind: preview.output_kind || null
  };
}

/** Map a `CapabilityActivityView` (sparse SSE lifecycle frame) into a card. */
export function toolCardFromActivity(activity: CapabilityActivity): RebornToolCard {
  return {
    invocationId: activity.invocation_id,
    callId: activity.invocation_id,
    toolName: activity.capability_id || 'tool',
    toolStatus: toolStatusFromActivityStatus(activity.status),
    toolDetail: null,
    toolParameters: null,
    toolResultPreview: null,
    toolError: activity.error_kind || null,
    toolDurationMs: null,
    updatedAt: activity.updated_at || null,
    resultRef: null,
    truncated: false,
    outputBytes: activity.output_bytes ?? null,
    outputKind: null
  };
}

// ---- Timeline → messages (ported from history-messages.js) ----------------

function roleForRecord(record: ThreadMessageRecord): RebornRole {
  switch (record.kind) {
    case 'user':
    case 'user_message':
      return 'user';
    case 'assistant':
    case 'assistant_message':
    case 'tool_result':
      return 'assistant';
    case 'system':
      return 'system';
    default:
      return record.actor_id ? 'user' : 'assistant';
  }
}

function timestampForRecord(record: ThreadMessageRecord): string | null {
  return record.received_at || record.created_at || null;
}

/**
 * Map v2 `ThreadMessageRecord[]` into render-ready messages. `tool_result_reference`
 * rows are LLM-only transcript artifacts (skipped); `capability_display_preview`
 * rows render a tool card; everything else becomes a chat bubble. De-duplicates
 * by id and appends any still-pending optimistic messages.
 */
export function messagesFromTimeline(
  records: ThreadMessageRecord[] | null | undefined,
  pendingMessages: RebornMessage[] = []
): RebornMessage[] {
  const seen = new Set<string>();
  const messages: RebornMessage[] = [];

  for (const record of records || []) {
    if (record.kind === 'tool_result_reference') continue;

    if (record.kind === 'capability_display_preview') {
      const card = toolCardFromPreviewRecord(record);
      if (!card) continue;
      const id = `tool-${card.invocationId}`;
      if (seen.has(id)) continue;
      seen.add(id);
      messages.push({
        id,
        role: 'tool_activity',
        ...card,
        timestamp: timestampForRecord(record) || card.updatedAt || null,
        sequence: record.sequence,
        turnRunId: record.turn_run_id || null
      });
      continue;
    }

    const id = `msg-${record.message_id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    messages.push({
      id,
      role: roleForRecord(record),
      content: record.content || '',
      timestamp: timestampForRecord(record),
      kind: record.kind,
      status: record.status,
      sequence: record.sequence,
      turnRunId: record.turn_run_id || null
    });
  }

  for (const pending of pendingMessages) {
    if (seen.has(pending.id)) continue;
    messages.push(pending);
  }

  return messages;
}

function toolCardFromPreviewRecord(record: ThreadMessageRecord): RebornToolCard | null {
  if (!record.content) return null;
  let envelope: CapabilityPreview;
  try {
    envelope = JSON.parse(record.content) as CapabilityPreview;
  } catch {
    return null;
  }
  if (!envelope || !envelope.invocation_id) return null;
  return toolCardFromPreview(envelope);
}

// ---- Live event reducer (ported from useChatEvents.js) --------------------

export interface ProjectionItem {
  run_status?: { run_id?: string; status: string };
  text?: { id: string; body?: string };
  gate?: { gate_ref: string; headline?: string };
  skill_activation?: { id?: string; skill_names?: string[]; feedback?: string[] };
}

export interface WebChatV2EventFrame {
  type?: string;
  frame?: {
    ack?: { run_id?: string; thread_id?: string; status?: string };
    progress?: { turn_run_id?: string };
    activity?: CapabilityActivity;
    preview?: CapabilityPreview;
    prompt?: unknown;
    reply?: { turn_run_id?: string; text?: string; generated_at?: string };
    state?: { items?: ProjectionItem[] };
  };
}

/** Reducer state for the live chat event stream. Plain data, no framework deps. */
export interface RebornChatState {
  messages: RebornMessage[];
  isProcessing: boolean;
  activeRun: RebornActiveRun | null;
  pendingGate: RebornGate | null;
  latestRunId: string | null;
  completedRuns: string[];
  /** Set true when a run terminally succeeds — the caller must refetch the
   *  timeline (assistant replies are not streamed; they land in the timeline). */
  refetchTimeline: boolean;
}

export function initialChatState(messages: RebornMessage[] = []): RebornChatState {
  return {
    messages,
    isProcessing: false,
    activeRun: null,
    pendingGate: null,
    latestRunId: null,
    completedRuns: [],
    refetchTimeline: false
  };
}

const TERMINAL_RUN_STATUSES = new Set([
  'completed',
  'succeeded',
  'failed',
  'cancelled',
  'recovery_required'
]);
const SUCCESS_RUN_STATUSES = new Set(['completed', 'succeeded']);

function upsertById(messages: RebornMessage[], next: RebornMessage): RebornMessage[] {
  const idx = messages.findIndex((m) => m.id === next.id);
  if (idx >= 0) {
    const copy = messages.slice();
    copy[idx] = next;
    return copy;
  }
  return [...messages, next];
}

/**
 * Fold a batch of projection items into chat state (immutably). Mirrors the
 * SPA's `applyProjectionItems`: tracks the active run, raises `refetchTimeline`
 * on first terminal success of a run, renders error bubbles on failure,
 * upserts `text`/`skill_activation` bubbles, and correlates a `gate` (which
 * carries no run_id) to the active run.
 */
export function applyProjectionItems(
  prev: RebornChatState,
  items: ProjectionItem[],
  threadId: string
): RebornChatState {
  let state: RebornChatState = { ...prev, refetchTimeline: false };
  let activeRunId = state.latestRunId;

  for (const item of items) {
    if (item.run_status) {
      const runId = item.run_status.run_id;
      const status = item.run_status.status;
      if (runId) {
        activeRunId = runId;
        state.activeRun =
          state.activeRun && state.activeRun.runId === runId
            ? { ...state.activeRun, status }
            : { runId, threadId, status };
      }
      if (TERMINAL_RUN_STATUSES.has(status)) {
        state.isProcessing = false;
        if (SUCCESS_RUN_STATUSES.has(status) && runId && !state.completedRuns.includes(runId)) {
          state.completedRuns = [...state.completedRuns, runId];
          state.refetchTimeline = true;
        }
        if (status === 'failed' || status === 'recovery_required') {
          const id = `err-${runId || 'unknown'}`;
          if (!state.messages.some((m) => m.id === id)) {
            state.messages = [
              ...state.messages,
              {
                id,
                role: 'error',
                content:
                  status === 'recovery_required'
                    ? 'The run is awaiting recovery — backend reported `recovery_required`.'
                    : 'The run failed before producing a reply.',
                timestamp: new Date().toISOString()
              }
            ];
          }
        }
      } else {
        state.isProcessing = true;
      }
    }

    if (item.text) {
      const id = `text-${item.text.id}`;
      state.messages = upsertById(state.messages, {
        id,
        role: 'assistant',
        content: item.text.body || '',
        timestamp: new Date().toISOString()
      });
      state.isProcessing = false;
      state.pendingGate = null;
    }

    if (item.gate) {
      // Gate items carry gate_ref but not run_id; correlate to the active run.
      // Without a run_id the gate is unusable (resolve needs both), so skip
      // until a run_status arrives.
      if (activeRunId && !state.pendingGate) {
        state.pendingGate = {
          kind: 'gate',
          runId: activeRunId,
          gateRef: item.gate.gate_ref,
          headline: item.gate.headline,
          body: ''
        };
        state.isProcessing = false;
      }
    }

    if (item.skill_activation) {
      const sa = item.skill_activation;
      const skillNames = sa.skill_names || [];
      const feedback = sa.feedback || [];
      if (skillNames.length || feedback.length) {
        const id = `skill-${sa.id || skillNames.join('-') || 'activation'}`;
        if (!state.messages.some((m) => m.id === id)) {
          const content = [
            skillNames.length ? `Skill activated: ${skillNames.join(', ')}` : '',
            ...feedback
          ]
            .filter(Boolean)
            .join('\n');
          state.messages = [
            ...state.messages,
            { id, role: 'system', content, timestamp: new Date().toISOString() }
          ];
        }
      }
    }
  }

  if (activeRunId) state.latestRunId = activeRunId;
  return state;
}

/**
 * Fold one `WebChatV2EventFrame` envelope into chat state. Local-dev only emits
 * `projection_snapshot`/`projection_update`; the typed variants are handled too
 * for forward-compat with runtimes that publish them.
 */
export function reduceEvent(
  prev: RebornChatState,
  envelope: WebChatV2EventFrame,
  threadId: string
): RebornChatState {
  const { type, frame } = envelope || {};
  if (!type || !frame) return { ...prev, refetchTimeline: false };
  const base: RebornChatState = { ...prev, refetchTimeline: false };

  switch (type) {
    case 'accepted': {
      const ack = frame.ack || {};
      return {
        ...base,
        latestRunId: ack.run_id || base.latestRunId,
        activeRun: {
          runId: ack.run_id || null,
          threadId: ack.thread_id || threadId,
          status: ack.status || null
        },
        isProcessing: true
      };
    }
    case 'running':
    case 'capability_progress': {
      const progress = frame.progress || {};
      const runId = progress.turn_run_id;
      return {
        ...base,
        latestRunId: runId || base.latestRunId,
        activeRun:
          runId && (!base.activeRun || base.activeRun.runId !== runId)
            ? { runId, threadId, status: 'running' }
            : base.activeRun,
        isProcessing: true
      };
    }
    case 'capability_activity': {
      const activity = frame.activity;
      if (!activity || !activity.invocation_id) return base;
      const card = toolCardFromActivity(activity);
      const id = `tool-${activity.invocation_id}`;
      const idx = base.messages.findIndex((m) => m.id === id);
      if (idx >= 0) {
        const current = base.messages[idx];
        const nextStatus =
          isTerminalToolStatus(current.toolStatus) && card.toolStatus === 'running'
            ? current.toolStatus
            : card.toolStatus;
        const copy = base.messages.slice();
        copy[idx] = {
          ...current,
          toolStatus: nextStatus,
          toolError: card.toolError || current.toolError,
          updatedAt: card.updatedAt || current.updatedAt
        };
        return { ...base, messages: copy };
      }
      return { ...base, messages: [...base.messages, { id, role: 'tool_activity', ...card }] };
    }
    case 'capability_display_preview': {
      const preview = frame.preview;
      if (!preview || !preview.invocation_id) return base;
      const card = toolCardFromPreview(preview);
      return {
        ...base,
        messages: upsertById(base.messages, {
          id: `tool-${preview.invocation_id}`,
          role: 'tool_activity',
          ...card
        })
      };
    }
    case 'final_reply': {
      const reply = frame.reply || {};
      return {
        ...base,
        messages: [
          ...base.messages,
          {
            id: `reply-${reply.turn_run_id || Date.now()}`,
            role: 'assistant',
            content: reply.text || '',
            timestamp: reply.generated_at || new Date().toISOString(),
            turnRunId: reply.turn_run_id
          }
        ],
        pendingGate: null,
        isProcessing: false
      };
    }
    case 'cancelled':
    case 'failed': {
      return { ...base, pendingGate: null, isProcessing: false, activeRun: null };
    }
    case 'projection_snapshot':
    case 'projection_update': {
      return applyProjectionItems(base, frame.state?.items || [], threadId);
    }
    case 'keep_alive':
    default:
      return base;
  }
}

// ---- Misc response helpers ------------------------------------------------

/** Normalize the loosely-shaped list-threads response into an array. */
export function threadsFromListResponse(
  resp: ListThreadsResponse | null | undefined
): ThreadSummary[] {
  if (!resp) return [];
  if (Array.isArray(resp.threads)) return resp.threads;
  if (Array.isArray(resp.items)) return resp.items;
  return [];
}

/** Pull the timeline records array regardless of wrapper field name. */
export function recordsFromTimeline(
  resp: RebornTimelineResponse | null | undefined
): ThreadMessageRecord[] {
  if (!resp) return [];
  if (Array.isArray(resp.records)) return resp.records;
  if (Array.isArray(resp.messages)) return resp.messages;
  return [];
}
