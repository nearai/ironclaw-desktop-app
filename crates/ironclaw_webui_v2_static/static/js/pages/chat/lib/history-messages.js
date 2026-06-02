// Map v2 `ThreadMessageRecord[]` from RebornTimelineResponse into
// the message shape the UI components render. Kept narrow: the v2
// timeline contract stores browser attachments in a durable transcript
// block. Parse that block back into the message shape the UI already renders
// so users see a normal attachment chip rather than raw base64 prose.

/**
 * @param {Array<Record<string, any>>} records
 * @param {Array<Record<string, any>>} pendingMessages
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
    const rendered = parseDurableAttachmentBlock(record.content || '');
    messages.push({
      id,
      role: roleForRecord(record),
      content: rendered.content,
      attachments: rendered.attachments,
      timestamp: timestampForRecord(record),
      kind: record.kind,
      status: record.status,
      sequence: record.sequence,
      turnRunId: record.turn_run_id || null
    });
  }

  for (const pending of pendingMessages) {
    if (seen.has(pending.id)) continue;
    if (
      pending.role === 'user' &&
      timelineUserContents.has(normalizeComparableContent(pending.content))
    ) {
      continue;
    }
    messages.push(pending);
  }

  return messages;
}

/**
 * Keep optimistic user bubbles until the real timeline contains the same
 * user text. Reborn can surface the assistant row before the user row during
 * projection/timeline catch-up, and clearing all pending rows there makes the
 * sent prompt visually disappear.
 *
 * @param {Array<Record<string, any>>} records
 * @param {Array<Record<string, any>>} pendingMessages
 */
export function pendingMessagesAfterTimeline(records, pendingMessages = []) {
  const timelineUserContents = timelineUserContentSet(records);
  return (pendingMessages || []).filter((pending) => {
    if (pending.role !== 'user' || !pending.content) return true;
    return !timelineUserContents.has(normalizeComparableContent(pending.content));
  });
}

/** @param {Array<Record<string, any>>} records */
function timelineUserContentSet(records) {
  const contents = new Set();
  for (const record of records || []) {
    if (roleForRecord(record) === 'user' && record.content) {
      contents.add(normalizeComparableContent(record.content));
    }
  }
  return contents;
}

/** @param {string | null | undefined} content */
function normalizeComparableContent(content) {
  return parseDurableAttachmentBlock(content || '').content.trim();
}

/**
 * @param {string | null | undefined} rawContent
 * @returns {{ content: string, attachments: Array<{ filename?: string, mime_type?: string, data_base64?: string, size_label?: string }> }}
 */
function parseDurableAttachmentBlock(rawContent) {
  const raw = String(rawContent || '');
  const blockMatch = raw.match(/\n{0,2}<attachments>\n([\s\S]*?)\n<\/attachments>\s*$/);
  if (!blockMatch) {
    return { content: raw, attachments: [] };
  }

  const content = raw.slice(0, blockMatch.index).trimEnd();
  const attachments = [];
  const chunks = blockMatch[1]
    .split(/\nAttachment\s+\d+:\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    /** @type {{ filename?: string, mime_type?: string, data_base64?: string, size_label?: string }} */
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
    }
    if (attachment.filename || attachment.mime_type || attachment.data_base64) {
      attachments.push(attachment);
    }
  }

  return { content, attachments };
}

/** @param {string | null | undefined} value */
function sizeLabelForBase64(value) {
  const clean = String(value || '').replace(/\s+/g, '');
  if (!clean) return '';
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const bytes = Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** @param {Record<string, any>} record */
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

/** @param {Record<string, any>} record */
function timestampForRecord(record) {
  // ThreadMessageRecord has no top-level timestamp; surfaces use
  // the sequence ordering for now. Browsers render the wall-clock
  // when an event arrives (FinalReplyView.generated_at).
  return record.received_at || record.created_at || null;
}

/** @param {Record<string, any>} record */
function toolCardFromPreviewRecord(record) {
  if (!record.content) return null;
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
/** @param {Record<string, any>} preview */
export function toolCardFromPreview(preview) {
  const failed = preview.status === 'failed' || preview.status === 'killed';
  return {
    invocationId: preview.invocation_id,
    callId: preview.invocation_id,
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
    outputKind: preview.output_kind || null
  };
}

// Map a `CapabilityActivityView` (SSE lifecycle frame) into the same
// card shape. Activity frames carry only metadata — no title, no
// parameters, no output — so the resulting card is intentionally
// sparse and is meant to be enriched by the next preview frame.
/** @param {Record<string, any>} activity */
export function toolCardFromActivity(activity) {
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

/** @param {string} status */
export function isTerminalToolStatus(status) {
  return status === 'success' || status === 'error';
}

/** @param {string} status */
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
