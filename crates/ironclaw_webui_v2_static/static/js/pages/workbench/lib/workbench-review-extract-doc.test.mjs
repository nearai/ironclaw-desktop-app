import assert from 'node:assert/strict';
import test from 'node:test';

import {
  runReviewChatTurn,
  makeReviewExtractor,
  googleDocText
} from './workbench-review-extract-doc.js';

const noSleep = () => Promise.resolve();
const gdoc = (paragraphs) => ({
  data: {
    body: {
      content: paragraphs.map((text) => ({
        paragraph: { elements: [{ textRun: { content: text } }] }
      }))
    }
  }
});

test('googleDocText joins block text and is empty for an unreadable doc', () => {
  const norm = { ok: true, blocks: [{ text: 'Section 1' }, { text: 'Section 2' }] };
  assert.equal(googleDocText(norm), 'Section 1\nSection 2');
  assert.equal(googleDocText({ ok: false, blocks: [] }), '');
  assert.equal(googleDocText(null), '');
});

test('runReviewChatTurn opens a thread, sends the prompt, polls, and returns assistant text with a trailing newline', async () => {
  let sent = null;
  let polls = 0;
  const deps = {
    createThread: async () => ({ thread_id: 't1' }),
    sendMessage: async (m) => {
      sent = m;
    },
    fetchTimeline: async () => {
      polls += 1;
      // empty on the first poll, then the assistant reply
      return polls < 2
        ? { messages: [] }
        : { messages: [{ kind: 'assistant', content: '{"column_index":0,"summary":"x"}' }] };
    },
    sleep: noSleep,
    timezone: 'UTC'
  };
  const out = await runReviewChatTurn('PROMPT-TEXT', deps);
  assert.equal(sent.threadId, 't1');
  assert.equal(sent.content, 'PROMPT-TEXT');
  assert.ok(out.endsWith('\n'), 'trailing newline appended for the truncation guard');
  assert.match(out, /column_index/);
});

test('runReviewChatTurn throws on no thread and on timeout', async () => {
  await assert.rejects(
    runReviewChatTurn('p', {
      createThread: async () => ({}),
      sendMessage: async () => {},
      fetchTimeline: async () => ({ messages: [] }),
      sleep: noSleep
    }),
    /thread/
  );
  await assert.rejects(
    runReviewChatTurn('p', {
      createThread: async () => ({ thread_id: 't' }),
      sendMessage: async () => {},
      fetchTimeline: async () => ({ messages: [] }),
      sleep: noSleep,
      maxTries: 3
    }),
    /timed out/
  );
});

test('makeReviewExtractor reads the doc body, builds the prompt, and returns the turn output', async () => {
  let promptSeen = '';
  const connectorRead = async (req) => {
    assert.equal(req.tool, 'GOOGLEDOCS_GET_DOCUMENT_BY_ID');
    assert.equal(req.arguments.id, 'doc-1');
    return gdoc(['This NDA is governed by Delaware law.', 'Term: 2 years.']);
  };
  const runTurn = async (prompt) => {
    promptSeen = prompt;
    return '{"column_index":1,"summary":"Delaware","flag":"green","k":"tk"}\n';
  };
  const extractDoc = makeReviewExtractor({ connectorRead, runTurn });
  const raw = await extractDoc({ id: 'doc-1', name: 'Acme NDA' }, 'tk');
  assert.match(promptSeen, /Delaware law/, 'doc text is embedded in the prompt');
  assert.match(promptSeen, /Governing Law/, 'columns are in the prompt');
  assert.match(raw, /column_index/);
});

test('makeReviewExtractor throws "couldn\'t read" when the document has no extractable text', async () => {
  const connectorRead = async () => ({ successful: false, error: 'not a doc' });
  const runTurn = async () => 'should not be called';
  const extractDoc = makeReviewExtractor({ connectorRead, runTurn });
  await assert.rejects(extractDoc({ id: 'x' }, 'tk'), /couldn't read/);
});
