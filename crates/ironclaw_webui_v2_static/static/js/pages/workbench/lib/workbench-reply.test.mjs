import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSuggestedReplyPrompt,
  cleanReplyText,
  extractReplyText,
  generateSuggestedReply
} from './workbench-reply.js';

test('buildSuggestedReplyPrompt includes the context + the output-only instruction', () => {
  const p = buildSuggestedReplyPrompt({
    sender: 'David Mirzadeh',
    channel: '#x-intents',
    subject: 'NFC deck',
    body: 'can you get me the final compliance section by EOD?'
  });
  assert.match(p, /From: David Mirzadeh/);
  assert.match(p, /Channel: #x-intents/);
  assert.match(p, /Subject: NFC deck/);
  assert.match(p, /compliance section by EOD/);
  assert.match(p, /Output ONLY the reply text/i);
});

test('buildSuggestedReplyPrompt caps the quoted body', () => {
  const p = buildSuggestedReplyPrompt({ body: 'x'.repeat(5000) });
  const msgLine = p.split('\n').find((l) => l.startsWith('Message: '));
  assert.ok(msgLine.length <= 'Message: '.length + 1200, 'body capped to 1200 chars');
});

test('cleanReplyText strips fences, preamble labels, and surrounding quotes', () => {
  assert.equal(cleanReplyText('"sounds good, will do."'), 'sounds good, will do.');
  assert.equal(cleanReplyText("Here's a reply: on it, sending by EOD."), 'on it, sending by EOD.');
  assert.equal(cleanReplyText('```\nyep, on it.\n```'), 'yep, on it.');
  assert.equal(cleanReplyText('Reply: approved.'), 'approved.');
  assert.equal(cleanReplyText('  plain text  '), 'plain text');
});

test('extractReplyText pulls the latest assistant text, skipping the user prompt', () => {
  assert.equal(
    extractReplyText({
      messages: [
        { kind: 'user', content: 'draft a reply…' },
        { kind: 'assistant', content: 'on it — sending by EOD.' }
      ]
    }),
    'on it — sending by EOD.'
  );
  assert.equal(
    extractReplyText({ timeline: [{ kind: 'final_reply', text: 'approved.' }] }),
    'approved.'
  );
  assert.equal(extractReplyText({ messages: [{ kind: 'user', content: 'hi' }] }), '');
  assert.equal(extractReplyText(null), '');
});

test('generateSuggestedReply orchestrates create→send→poll and returns the reply', async () => {
  const sent = [];
  const deps = {
    createThread: async () => ({ thread: { thread_id: 'T1' } }),
    sendMessage: async (args) => {
      sent.push(args);
      return { status: 'Queued' };
    },
    fetchTimeline: async () => ({
      messages: [
        { kind: 'user', content: 'prompt' },
        { kind: 'assistant', content: '"sounds good, will do."' }
      ]
    }),
    sleep: async () => {},
    maxTries: 3
  };
  const reply = await generateSuggestedReply({
    message: { sender: 'X', subject: 'Re: deck', preview: 'can you send the deck?' },
    deps
  });
  assert.equal(reply, 'sounds good, will do.', 'returns the cleaned assistant reply');
  assert.match(sent[0].content, /can you send the deck/, 'sent the message context in the prompt');
  assert.equal(sent[0].threadId, 'T1', 'sent against the created thread');
});

test('generateSuggestedReply returns "" on timeout or missing deps (never fabricates)', async () => {
  const deps = {
    createThread: async () => ({ thread_id: 'T2' }),
    sendMessage: async () => ({ status: 'Queued' }),
    fetchTimeline: async () => ({ messages: [{ kind: 'user', content: 'still working' }] }),
    sleep: async () => {},
    maxTries: 2
  };
  assert.equal(await generateSuggestedReply({ message: { subject: 'x' }, deps }), '');
  assert.equal(await generateSuggestedReply({ message: { subject: 'x' }, deps: {} }), '');
});
