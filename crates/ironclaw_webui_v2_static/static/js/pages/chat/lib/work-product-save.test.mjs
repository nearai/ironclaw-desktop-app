import assert from 'node:assert/strict';
import test from 'node:test';

import {
  currentThreadId,
  openSavedWorkProduct,
  saveAssistantResponseToWork,
  workArtifactHref
} from './work-product-save.js';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    dump: () => Object.fromEntries(values)
  };
}

function sequenceIds() {
  let index = 0;
  return (prefix) => `${prefix}-${(index += 1)}`;
}

test('saveAssistantResponseToWork persists a reloadable Work item with a ready artifact', () => {
  const storage = memoryStorage();
  const saved = saveAssistantResponseToWork({
    title: 'Pilot term sheet',
    content: '# Pilot term sheet\n\n- 90-day paid pilot',
    threadId: 'thread-abc',
    threadLabel: 'Northwind pilot',
    storage,
    now: '2026-06-11T12:00:00.000Z',
    idFactory: sequenceIds()
  });

  assert.equal(saved.href, '/work?item=work-1&artifact=artifact-2');
  assert.equal(saved.item.title, 'Pilot term sheet');
  assert.equal(saved.artifact.content, '# Pilot term sheet\n\n- 90-day paid pilot');

  const workItems = JSON.parse(storage.getItem('ironclaw-work-items'));
  assert.deepEqual(workItems, [
    {
      id: 'work-1',
      title: 'Pilot term sheet',
      objective: 'Saved work product from chat.',
      domain: 'general',
      runbookIds: ['general'],
      status: 'active',
      created_at: '2026-06-11T12:00:00.000Z',
      updated_at: '2026-06-11T12:00:00.000Z',
      links: [{ kind: 'thread', ref: 'thread-abc', label: 'Northwind pilot' }],
      dossier: [],
      approvalBoundaries: [],
      artifacts: [
        {
          id: 'artifact-2',
          type: 'document',
          title: 'Pilot term sheet',
          status: 'ready',
          provenance: ['thread:thread-abc'],
          content: '# Pilot term sheet\n\n- 90-day paid pilot',
          content_format: 'markdown'
        }
      ],
      watches: [],
      receipts: [],
      openApprovals: [],
      followUps: [],
      nextAction: 'Review saved work product.'
    }
  ]);
});

test('saveAssistantResponseToWork prepends to the shared Work store and survives corrupt data', () => {
  const storage = memoryStorage({
    'ironclaw-work-items': '{not json'
  });
  saveAssistantResponseToWork({
    title: 'Board brief',
    content: 'Approve workspace connector pilot.',
    storage,
    now: '2026-06-11T12:00:00.000Z',
    idFactory: sequenceIds()
  });

  assert.equal(JSON.parse(storage.getItem('ironclaw-work-items')).length, 1);

  saveAssistantResponseToWork({
    title: 'Follow-up note',
    content: 'Send the client follow-up.',
    storage,
    now: '2026-06-11T12:01:00.000Z',
    idFactory: sequenceIds()
  });

  const items = JSON.parse(storage.getItem('ironclaw-work-items'));
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Follow-up note');
  assert.equal(items[1].title, 'Board brief');
});

test('saveAssistantResponseToWork does not create empty artifacts', () => {
  const storage = memoryStorage();
  const saved = saveAssistantResponseToWork({
    title: 'Empty',
    content: '   \n',
    storage,
    idFactory: sequenceIds()
  });

  assert.equal(saved, null);
  assert.equal(storage.getItem('ironclaw-work-items'), null);
});

test('currentThreadId reads static chat paths and query links', () => {
  assert.equal(currentThreadId({ href: 'http://app.local/chat/thread-123' }), 'thread-123');
  assert.equal(currentThreadId({ href: 'http://app.local/v2/chat/thread-456' }), 'thread-456');
  assert.equal(
    currentThreadId({ href: 'http://app.local/chat?thread=legacy-thread-789' }),
    'legacy-thread-789'
  );
});

test('openSavedWorkProduct navigates to the saved artifact URL', () => {
  const calls = [];
  assert.equal(
    openSavedWorkProduct({ href: workArtifactHref('work/with spaces', 'artifact#1') }, {
      assign: (href) => calls.push(href)
    }),
    true
  );
  assert.deepEqual(calls, ['/work?item=work%2Fwith+spaces&artifact=artifact%231']);
});
