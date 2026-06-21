import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildReplyDraft,
  createdDraftId,
  draftValidationError,
  draftWriteArguments,
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
  assert.match(
    draftValidationError({ recipient: 'a@b.com', subject: '', body: 'b' }),
    /subject/i
  );
  assert.match(
    draftValidationError({ recipient: 'a@b.com', subject: 's', body: '   ' }),
    /message/i
  );
  assert.equal(draftValidationError({ recipient: 'a@b.com', subject: 's', body: 'b' }), '');
});

test('createdDraftId extracts an id across shapes; empty on failure', () => {
  assert.equal(createdDraftId({ successful: true, data: { response_data: { id: 'r-1' } } }), 'r-1');
  assert.equal(createdDraftId({ successful: true, data: { id: 'd-2' } }), 'd-2');
  assert.equal(createdDraftId({ successful: false }), '');
  assert.equal(createdDraftId(null), '');
});
