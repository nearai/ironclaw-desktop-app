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

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Is this a syntactically valid single email address?
export function isValidEmail(value) {
  return EMAIL_RE.test(String(value || '').trim());
}

// Split a recipient field into individual addresses. Accepts a comma / semicolon /
// whitespace separated string (so the user can add more than one person) OR an
// array. Trims and drops blanks. This is what lets you add invoices@near.foundation
// alongside the original sender.
export function parseEmails(input) {
  if (Array.isArray(input)) return input.map((s) => String(s || '').trim()).filter(Boolean);
  return String(input || '')
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Build the editable reply-draft package from the normalized full message
// (`message`, may be null while loading) and the row context (`selected`). `recipient`
// is the To field (the original sender when known, else '' — editable, and accepts
// more than one comma-separated address); `cc` starts empty.
export function buildReplyDraft({ message, selected } = {}) {
  const full = message || {};
  const row = selected || {};
  return {
    toolkit: 'gmail',
    tool: 'GMAIL_CREATE_EMAIL_DRAFT',
    recipient: String(full.fromEmail || '').trim(),
    cc: '',
    subject: replySubject(full.subject || row.subject || ''),
    threadId: String(full.threadId || row.threadId || '').trim(),
    body: ''
  };
}

// Case-insensitively de-duplicate a list of addresses, preserving first-seen order.
export function dedupEmails(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : []).filter((email) => {
    const key = String(email || '')
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Resolve the raw To/Cc strings into the final, de-duplicated recipient lists that
// will actually be written: To is de-duped; Cc is de-duped AND has any address
// already in To removed (so nobody is named twice across the draft). This is the
// single source of truth for both the write arguments and the chip preview.
export function resolveRecipients({ recipient, cc } = {}) {
  const to = dedupEmails(parseEmails(recipient));
  const inTo = new Set(to.map((e) => e.toLowerCase()));
  const ccList = dedupEmails(parseEmails(cc)).filter((e) => !inTo.has(e.toLowerCase()));
  return { to, cc: ccList };
}

// Turn the (possibly edited) draft fields into the connector write `arguments` for
// GMAIL_CREATE_EMAIL_DRAFT. The first To address is `recipient_email`; any further
// To addresses go to `extra_recipients`, and Cc addresses to `cc` (both arrays, the
// Composio shape). Recipients are de-duplicated so nobody is named twice. `thread_id`
// is included only when present so a draft can thread into the original conversation.
export function draftWriteArguments({ recipient, cc, subject, body, threadId } = {}) {
  const { to: toList, cc: ccList } = resolveRecipients({ recipient, cc });
  const args = {
    recipient_email: toList[0] || '',
    subject: String(subject || '').trim(),
    body: String(body || '')
  };
  if (toList.length > 1) args.extra_recipients = toList.slice(1);
  if (ccList.length) args.cc = ccList;
  const tid = String(threadId || '').trim();
  if (tid) args.thread_id = tid;
  return args;
}

// Validate a draft before submit. Returns '' when valid, else a human reason. Every
// To and Cc address must be a valid email, and there must be at least one recipient.
export function draftValidationError({ recipient, cc, subject, body } = {}) {
  const toList = parseEmails(recipient);
  if (!toList.length) return 'Add a valid recipient email address.';
  const invalid = [...toList, ...parseEmails(cc)].find((email) => !isValidEmail(email));
  if (invalid) return `"${invalid}" is not a valid recipient email address.`;
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
