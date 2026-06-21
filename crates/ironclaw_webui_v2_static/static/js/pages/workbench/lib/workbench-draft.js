// Pure helpers for the gated-write "Draft reply" flow. They turn a reading-panel
// message into an editable reply-draft package and then into the connector write
// arguments for GMAIL_CREATE_EMAIL_DRAFT. Nothing here sends — drafts are created
// for the user to review and send themselves from Gmail.

// Prefix "Re: " unless the subject already has one (case-insensitive).
export function replySubject(subject) {
  const value = String(subject || '').trim();
  if (!value) return 'Re:';
  return /^re:\s*/i.test(value) ? value : `Re: ${value}`;
}

// Build the editable reply-draft package from the normalized full message
// (`message`, may be null while loading) and the row context (`selected`). The
// recipient is the original sender's address when known, else '' (editable).
export function buildReplyDraft({ message, selected } = {}) {
  const full = message || {};
  const row = selected || {};
  return {
    toolkit: 'gmail',
    tool: 'GMAIL_CREATE_EMAIL_DRAFT',
    recipient: String(full.fromEmail || '').trim(),
    subject: replySubject(full.subject || row.subject || ''),
    threadId: String(full.threadId || row.threadId || '').trim(),
    body: ''
  };
}

// Turn the (possibly edited) draft fields into the connector write `arguments`.
// `thread_id` is included only when present so a draft can thread into the
// original conversation; omitted for a standalone draft.
export function draftWriteArguments({ recipient, subject, body, threadId } = {}) {
  const args = {
    recipient_email: String(recipient || '').trim(),
    subject: String(subject || '').trim(),
    body: String(body || '')
  };
  const tid = String(threadId || '').trim();
  if (tid) args.thread_id = tid;
  return args;
}

// Validate a draft before submit. Returns '' when valid, else a human reason.
export function draftValidationError({ recipient, subject, body } = {}) {
  const email = String(recipient || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return 'Add a valid recipient email address.';
  }
  if (!String(subject || '').trim()) return 'Add a subject.';
  if (!String(body || '').trim()) return 'Write the message before creating a draft.';
  return '';
}

// Pull a created-draft id out of the connector write response, if present, for an
// honest "draft created" confirmation. Returns '' when the shape has none.
export function createdDraftId(result) {
  if (!result || result.successful === false) return '';
  const data = result.data || result;
  const inner = (data && (data.response_data || data)) || {};
  return String(inner.id || inner.draft_id || data.id || '').trim();
}
