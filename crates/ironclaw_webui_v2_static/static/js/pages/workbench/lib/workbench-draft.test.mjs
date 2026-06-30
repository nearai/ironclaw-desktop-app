import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildReplyDraft,
  createdDraftId,
  dedupEmails,
  draftValidationError,
  draftWriteArguments,
  isValidEmail,
  parseEmails,
  resolveRecipients,
  replySubject
} from './workbench-draft.js';

test('replySubject prefixes Re: once', () => {
  assert.equal(replySubject('Term sheet'), 'Re: Term sheet');
  assert.equal(replySubject('Re: Term sheet'), 'Re: Term sheet');
  assert.equal(replySubject('RE: already'), 'RE: already');
  assert.equal(replySubject(''), 'Re:');
});

test('buildReplyDraft uses the full message sender email + threaded subject', () => {
  const draft = buildReplyDraft({
    message: { fromEmail: 'counsel@firm.com', subject: 'Term sheet', threadId: 't1' },
    selected: { subject: 'ignored', threadId: 'ignored' }
  });
  assert.equal(draft.tool, 'GMAIL_CREATE_EMAIL_DRAFT');
  assert.equal(draft.recipient, 'counsel@firm.com');
  assert.equal(draft.subject, 'Re: Term sheet');
  assert.equal(draft.threadId, 't1');
  assert.equal(draft.body, '');
});

test('buildReplyDraft falls back to row context and leaves recipient editable', () => {
  const draft = buildReplyDraft({ message: null, selected: { subject: 'Hi', threadId: 't9' } });
  assert.equal(draft.recipient, '', 'no email known -> empty, editable');
  assert.equal(draft.subject, 'Re: Hi');
  assert.equal(draft.threadId, 't9');
});

test('draftWriteArguments maps fields and omits empty thread_id', () => {
  assert.deepEqual(
    draftWriteArguments({ recipient: 'a@b.com', subject: 'Re: x', body: 'hi', threadId: 't1' }),
    { recipient_email: 'a@b.com', subject: 'Re: x', body: 'hi', thread_id: 't1' }
  );
  const noThread = draftWriteArguments({ recipient: 'a@b.com', subject: 'x', body: 'y' });
  assert.equal('thread_id' in noThread, false);
});

test('draftValidationError catches bad recipient, empty subject, empty body', () => {
  assert.match(draftValidationError({ recipient: 'nope', subject: 's', body: 'b' }), /recipient/i);
  assert.match(draftValidationError({ recipient: 'a@b.com', subject: '', body: 'b' }), /subject/i);
  assert.match(
    draftValidationError({ recipient: 'a@b.com', subject: 's', body: '   ' }),
    /message/i
  );
  assert.equal(draftValidationError({ recipient: 'a@b.com', subject: 's', body: 'b' }), '');
});

test('parseEmails splits comma/semicolon/space, trims, drops blanks, accepts arrays', () => {
  assert.deepEqual(parseEmails('a@b.com, c@d.com'), ['a@b.com', 'c@d.com']);
  assert.deepEqual(parseEmails('a@b.com; c@d.com  e@f.com'), ['a@b.com', 'c@d.com', 'e@f.com']);
  assert.deepEqual(parseEmails('  '), []);
  assert.deepEqual(parseEmails(['a@b.com', ' c@d.com ', '']), ['a@b.com', 'c@d.com']);
  assert.deepEqual(parseEmails(null), []);
});

test('isValidEmail accepts plausible addresses, rejects junk', () => {
  assert.equal(isValidEmail('invoices@near.foundation'), true);
  assert.equal(isValidEmail('a@b.com'), true);
  assert.equal(isValidEmail('nope'), false);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail(''), false);
});

test('buildReplyDraft seeds an empty Cc field', () => {
  const draft = buildReplyDraft({ message: { fromEmail: 'a@b.com', subject: 'x', threadId: 't' } });
  assert.equal(draft.cc, '');
  assert.equal(draft.recipient, 'a@b.com');
});

test('draftWriteArguments adds extra To recipients + Cc (Composio shape)', () => {
  const args = draftWriteArguments({
    recipient: 'lead@firm.com, second@firm.com',
    cc: 'invoices@near.foundation',
    subject: 'Re: invoice',
    body: 'see attached',
    threadId: 't1'
  });
  assert.equal(args.recipient_email, 'lead@firm.com');
  assert.deepEqual(args.extra_recipients, ['second@firm.com']);
  assert.deepEqual(args.cc, ['invoices@near.foundation']);
  assert.equal(args.thread_id, 't1');
  // single recipient, no Cc → no extra_recipients / cc keys (back-compat shape)
  const lean = draftWriteArguments({ recipient: 'a@b.com', subject: 's', body: 'b' });
  assert.equal('extra_recipients' in lean, false);
  assert.equal('cc' in lean, false);
});

test('draftValidationError flags a missing recipient and an invalid Cc', () => {
  assert.match(draftValidationError({ recipient: '', subject: 's', body: 'b' }), /recipient/i);
  assert.match(
    draftValidationError({ recipient: 'a@b.com', cc: 'broken', subject: 's', body: 'b' }),
    /broken/
  );
  assert.equal(
    draftValidationError({
      recipient: 'a@b.com, c@d.com',
      cc: 'invoices@near.foundation',
      subject: 's',
      body: 'b'
    }),
    ''
  );
});

test('dedupEmails removes case-insensitive duplicates, preserving order', () => {
  assert.deepEqual(dedupEmails(['a@b.com', 'A@B.com', 'c@d.com']), ['a@b.com', 'c@d.com']);
  assert.deepEqual(dedupEmails(['x@y.com', '', 'x@y.com']), ['x@y.com']);
  assert.deepEqual(dedupEmails(null), []);
});

test('resolveRecipients de-dupes To and drops To/Cc overlap from Cc', () => {
  const r = resolveRecipients({
    recipient: 'lead@firm.com, Lead@firm.com, second@firm.com',
    cc: 'lead@firm.com, billing@firm.com'
  });
  assert.deepEqual(r.to, ['lead@firm.com', 'second@firm.com'], 'To de-duped (case-insensitive)');
  assert.deepEqual(r.cc, ['billing@firm.com'], 'Cc drops the address already in To');
});

test('draftWriteArguments de-duplicates across To and Cc (no one named twice)', () => {
  const args = draftWriteArguments({
    recipient: 'lead@firm.com, lead@firm.com, second@firm.com',
    cc: 'Lead@firm.com, billing@firm.com',
    subject: 's',
    body: 'b'
  });
  assert.equal(args.recipient_email, 'lead@firm.com');
  assert.deepEqual(args.extra_recipients, ['second@firm.com'], 'within-To dupe dropped');
  assert.deepEqual(args.cc, ['billing@firm.com'], 'To/Cc overlap dropped from Cc');
});

test('createdDraftId extracts an id across shapes; empty on failure', () => {
  assert.equal(createdDraftId({ successful: true, data: { response_data: { id: 'r-1' } } }), 'r-1');
  assert.equal(createdDraftId({ successful: true, data: { id: 'd-2' } }), 'd-2');
  assert.equal(createdDraftId({ successful: false }), '');
  assert.equal(createdDraftId(null), '');
});
