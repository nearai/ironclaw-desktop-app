/**
 * @typedef {{
 *   message_id?: string | number;
 *   kind?: string;
 *   content?: string | null;
 *   sequence?: number;
 *   status?: string | null;
 *   turn_run_id?: string | null;
 *   actor_id?: string | null;
 *   received_at?: string | null;
 *   created_at?: string | null;
 * }} TimelineRecord
 *
 * @typedef {{
 *   id?: string;
 *   role?: string;
 *   content?: string | null;
 *   timestamp?: string | null;
 *   isOptimistic?: boolean;
 *   timelineMessageId?: string | number | null;
 *   attachments?: AttachmentChip[];
 *   [key: string]: unknown;
 * }} PendingMessage
 *
 * @typedef {{
 *   filename?: string;
 *   mime_type?: string;
 *   data_base64?: string;
 *   size_label?: string;
 * }} AttachmentChip
 *
 * @typedef {{
 *   content: string;
 *   attachments: AttachmentChip[];
 * }} ParsedContent
 *
 * @typedef {{
 *   invocation_id?: string;
 *   status?: string;
 *   title?: string;
 *   capability_id?: string;
 *   subtitle?: string | null;
 *   input_summary?: string | null;
 *   output_preview?: string | null;
 *   output_summary?: string | null;
 *   result_ref?: string | null;
 *   updated_at?: string | null;
 *   truncated?: boolean;
 *   output_bytes?: number | null;
 *   output_kind?: string | null;
 *   turn_run_id?: string | null;
 * }} CapabilityPreview
 *
 * @typedef {{
 *   invocationId: string;
 *   callId: string;
 *   toolName: string;
 *   toolStatus: string;
 *   toolDetail: string | null;
 *   toolParameters: string | null;
 *   toolResultPreview: string | null;
 *   toolError: string | null;
 *   toolDurationMs: number | null;
 *   updatedAt: string | null;
 *   resultRef: string | null;
 *   truncated: boolean;
 *   outputBytes: number | null;
 *   outputKind: string | null;
 *   turnRunId: string | null;
 * }} ToolCard
 *
 * @typedef {{
 *   invocation_id?: string;
 *   status?: string;
 *   capability_id?: string;
 *   error_kind?: string | null;
 *   updated_at?: string | null;
 *   output_bytes?: number | null;
 *   turn_run_id?: string | null;
 * }} CapabilityActivity
 */

// Map v2 `ThreadMessageRecord[]` from RebornTimelineResponse into
// the message shape the UI components render. Kept narrow: the v2
// timeline contract stores browser attachments as a durable transcript block
// in `content` until the native v2 request grows a first-class attachment
// field. Parse that block back into chips while preserving turn grouping.

/**
 * @param {TimelineRecord[]} records
 * @param {PendingMessage[]} pendingMessages
 */
export function messagesFromTimeline(records, pendingMessages = []) {
  const seen = new Set();
  const messages = [];
  const timelineUserContents = timelineUserContentSet(records);

  for (const record of records || []) {
    if (record.kind === 'tool_result_reference') {
      // LLM-visible transcript artifact (result_ref + safe_summary).
      // Not a UI message — the matching `capability_display_preview`
      // record renders the tool card.
      continue;
    }

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
    const role = roleForRecord(record);
    const rendered = parseDurableAttachmentBlock(record.content || '');
    messages.push({
      id,
      role,
      content: rendered.content,
      attachments: rendered.attachments,
      timestamp: timestampForRecord(record),
      kind: record.kind,
      status: record.status,
      isFinalReply: isFinalAssistantRecord(record),
      sequence: record.sequence,
      turnRunId: record.turn_run_id || null
    });
  }

  // Pending rows are dropped from the ref by the caller as soon as
  // `sendMessage` returns (server has accepted the message and the
  // confirmed row will arrive via timeline). The id-based guard
  // remains as defense-in-depth. Content-based user dedupe covers the
  // short handoff gap where Reborn has accepted the turn but the caller
  // has not yet attached the server timeline id to the optimistic bubble.
  for (const pending of pendingMessages) {
    if (seen.has(pending.id)) continue;
    const message = pendingMessageForRender(pending);
    if (message.timelineMessageId && seen.has(`msg-${message.timelineMessageId}`)) {
      continue;
    }
    if (
      !message.timelineMessageId &&
      message.role === 'user' &&
      timelineUserContents.has(normalizeComparableContent(message.content))
    ) {
      continue;
    }
    messages.push(message);
  }

  return messages;
}

/**
 * Return pending messages that have not been confirmed by the timeline yet.
 * The hook uses this after a timeline refresh so stale optimistic user bubbles
 * do not duplicate the server-confirmed turn.
 *
 * @param {TimelineRecord[]} records
 * @param {PendingMessage[]} pendingMessages
 */
export function pendingMessagesAfterTimeline(records, pendingMessages = []) {
  const timelineUserContents = timelineUserContentSet(records);
  const timelineIds = new Set(
    (records || [])
      .filter((record) => record && record.message_id != null)
      .map((record) => `msg-${record.message_id}`)
  );

  return (pendingMessages || []).filter((pending) => {
    const message = pendingMessageForRender(pending);
    if (message.timelineMessageId && timelineIds.has(`msg-${message.timelineMessageId}`)) {
      return false;
    }
    if (
      !message.timelineMessageId &&
      message.role === 'user' &&
      timelineUserContents.has(normalizeComparableContent(message.content))
    ) {
      return false;
    }
    return true;
  });
}

/**
 * @param {TimelineRecord[]} records
 */
function timelineUserContentSet(records) {
  const contents = new Set();
  for (const record of records || []) {
    if (roleForRecord(record) !== 'user') continue;
    contents.add(normalizeComparableContent(record.content));
  }
  return contents;
}

/**
 * @param {string | null | undefined} content
 */
function normalizeComparableContent(content) {
  return parseDurableAttachmentBlock(content || '').content.trim();
}

/**
 * @param {string | null | undefined} rawContent
 * @returns {ParsedContent}
 */
function parseDurableAttachmentBlock(rawContent) {
  const raw = String(rawContent || '');
  const blockMatch = raw.match(/\n{0,2}<attachments>\n([\s\S]*?)\n<\/attachments>\s*$/);
  if (!blockMatch) return { content: raw, attachments: [] };

  /** @type {AttachmentChip[]} */
  const attachments = [];
  const chunks = blockMatch[1]
    .split(/\nAttachment\s+\d+:\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    /** @type {AttachmentChip} */
    const attachment = {};
    for (const line of chunk.split('\n')) {
      const splitAt = line.indexOf(':');
      if (splitAt === -1) continue;
      const key = line.slice(0, splitAt).trim();
      const value = line.slice(splitAt + 1).trim();
      if (key === 'filename') attachment.filename = value;
      if (key === 'mime_type') attachment.mime_type = value;
      if (key === 'data_base64') {
        attachment.data_base64 = value;
        attachment.size_label = sizeLabelForBase64(value);
      }
      if (key === 'size' && value && !attachment.size_label) {
        attachment.size_label = sizeLabelForBytes(Number(value));
      }
    }
    if (attachment.filename || attachment.mime_type || attachment.data_base64) {
      attachments.push(attachment);
    }
  }

  return {
    content: raw.slice(0, blockMatch.index).trimEnd(),
    attachments
  };
}

/**
 * @param {string | null | undefined} value
 */
function sizeLabelForBase64(value) {
  const clean = String(value || '').replace(/\s+/g, '');
  if (!clean) return '';
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const bytes = Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
  return sizeLabelForBytes(bytes);
}

/**
 * @param {number} bytes
 */
function sizeLabelForBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {PendingMessage} pending
 */
function pendingMessageForRender(pending) {
  return {
    ...pending,
    role: pending.role || 'user',
    isOptimistic: pending.isOptimistic !== false
  };
}

/**
 * @param {TimelineRecord} record
 */
function isFinalAssistantRecord(record) {
  return (
    (record.kind === 'assistant' || record.kind === 'assistant_message') &&
    record.status === 'finalized'
  );
}

/**
 * @param {TimelineRecord} record
 */
function roleForRecord(record) {
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

/**
 * @param {TimelineRecord} record
 */
function timestampForRecord(record) {
  // ThreadMessageRecord has no top-level timestamp; surfaces use
  // the sequence ordering for now. Browsers render the wall-clock
  // when an event arrives (FinalReplyView.generated_at).
  return record.received_at || record.created_at || null;
}

/**
 * @param {TimelineRecord} record
 * @returns {ToolCard | null}
 */
function toolCardFromPreviewRecord(record) {
  if (!record.content) return null;
  /** @type {CapabilityPreview | null} */
  let envelope;
  try {
    envelope = JSON.parse(record.content);
  } catch (err) {
    console.warn('Failed to parse capability_display_preview envelope', err);
    return null;
  }
  if (!envelope || !envelope.invocation_id) return null;
  return toolCardFromPreview(envelope);
}

// Map a `CapabilityDisplayPreviewEnvelope` (timeline) or
// `CapabilityDisplayPreviewView` (SSE) into the field set
// `ToolActivityCard` destructures.
/**
 * @param {CapabilityPreview} preview
 * @returns {ToolCard}
 */
export function toolCardFromPreview(preview) {
  const failed = preview.status === 'failed' || preview.status === 'killed';
  const invocationId = preview.invocation_id || '';
  return {
    invocationId,
    callId: invocationId,
    toolName: preview.title || preview.capability_id || 'tool',
    toolStatus: toolStatusFromActivityStatus(preview.status),
    toolDetail: preview.subtitle || null,
    toolParameters: preview.input_summary || null,
    // On failure the output fields carry the error text — surface it
    // only through `toolError` so the card renders it once in red,
    // not twice (once as a teal result preview and once as the error).
    toolResultPreview: failed ? null : preview.output_preview || preview.output_summary || null,
    toolError: failed
      ? preview.output_summary || preview.output_preview || preview.result_ref || null
      : null,
    toolDurationMs: null,
    updatedAt: preview.updated_at || null,
    resultRef: preview.result_ref || null,
    truncated: Boolean(preview.truncated),
    outputBytes: preview.output_bytes ?? null,
    outputKind: preview.output_kind || null,
    turnRunId: preview.turn_run_id || null
  };
}

// Map a `CapabilityActivityView` (SSE lifecycle frame) into the same
// card shape. Activity frames carry only metadata — no title, no
// parameters, no output — so the resulting card is intentionally
// sparse and is meant to be enriched by the next preview frame.
/**
 * @param {CapabilityActivity} activity
 */
export function toolCardFromActivity(activity) {
  return {
    invocationId: activity.invocation_id || '',
    callId: activity.invocation_id || '',
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
    outputKind: null,
    turnRunId: activity.turn_run_id || null
  };
}

/**
 * @param {string | null | undefined} status
 */
export function isTerminalToolStatus(status) {
  return status === 'success' || status === 'error';
}

/**
 * @param {string | null | undefined} status
 */
function toolStatusFromActivityStatus(status) {
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
