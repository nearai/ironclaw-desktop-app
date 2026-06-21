import assert from 'node:assert/strict';
import test from 'node:test';

import {
  currentThreadId,
  dossierFromMessages,
  fetchSavedWorkSnapshot,
  mergeSavedWorkSnapshots,
  normalizeSavedWorkSnapshotResponse,
  openSavedWorkProduct,
  readSavedWorkSnapshot,
  savedWorkServerReadSupported,
  saveAssistantResponseToWork,
  saveGeneratedFileArtifactToWork,
  workArtifactHref
} from './work-product-save.js';

test('dossierFromMessages extracts the ask (first user turn) and tool-activity receipts', () => {
  const messages = [
    { role: 'user', content: 'Draft the Q3 board memo.' },
    {
      role: 'tool_activity',
      toolName: 'read_file',
      toolStatus: 'done',
      toolResultPreview: 'Read board-notes.md (4 KB)'
    },
    { role: 'assistant', content: 'Here is the memo...' },
    { role: 'user', content: 'tighten it' }
  ];
  const { ask, receipts } = dossierFromMessages(messages);
  assert.equal(ask, 'Draft the Q3 board memo.');
  assert.deepEqual(receipts, [
    { label: 'read_file', status: 'done', detail: 'Read board-notes.md (4 KB)' }
  ]);
});

test('dossierFromMessages is empty when there is no user turn or no tools', () => {
  assert.deepEqual(dossierFromMessages([{ role: 'assistant', content: 'hi' }]), {
    ask: '',
    receipts: []
  });
  assert.deepEqual(dossierFromMessages([]), { ask: '', receipts: [] });
  assert.deepEqual(dossierFromMessages(null), { ask: '', receipts: [] });
});

test('saveAssistantResponseToWork populates the dossier ask + receipts from messages', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value))
  };
  const saved = saveAssistantResponseToWork({
    title: 'Summary',
    content: 'The contract says...',
    messages: [
      { role: 'user', content: 'Summarize the contract.' },
      { role: 'tool_activity', toolName: 'extract', toolStatus: 'done' }
    ],
    threadId: 't1',
    storage,
    now: '2026-06-15T00:00:00.000Z',
    idFactory: (prefix) => `${prefix}-x`
  });
  assert.equal(saved.item.dossier[0].kind, 'ask');
  assert.equal(saved.item.dossier[0].text, 'Summarize the contract.');
  assert.equal(saved.item.receipts[0].label, 'extract');
});

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

test('readSavedWorkSnapshot returns local source metadata with filtered saved items', () => {
  const storage = memoryStorage({
    'ironclaw-work-items': JSON.stringify([{ id: 'work-1' }, null, 'bad', { id: 'work-2' }])
  });

  const snapshot = readSavedWorkSnapshot(storage);

  assert.equal(snapshot.source, 'local-browser');
  assert.equal(snapshot.status, 'local-only');
  assert.equal(snapshot.statusLabel, 'Local profile');
  assert.deepEqual(
    snapshot.items.map((item) => item.id),
    ['work-1', 'work-2']
  );
});

test('readSavedWorkSnapshot distinguishes unavailable and corrupt local storage', () => {
  assert.deepEqual(readSavedWorkSnapshot(null).items, []);
  assert.equal(readSavedWorkSnapshot(null).status, 'unavailable');

  const corrupt = readSavedWorkSnapshot(memoryStorage({ 'ironclaw-work-items': '{not json' }));
  assert.equal(corrupt.status, 'corrupt');
  assert.equal(corrupt.items.length, 0);
});

test('normalizeSavedWorkSnapshotResponse maps future backend work payloads', () => {
  const snapshot = normalizeSavedWorkSnapshotResponse({
    work_items: [
      {
        work_id: 'server-work-1',
        name: 'Server renewal package',
        artifacts: [
          {
            artifact_id: 'server-artifact-1',
            name: 'Renewal memo',
            content: '# Renewal memo',
            content_format: 'markdown'
          }
        ],
        open_approvals: [{ title: 'Approve send' }],
        follow_ups: [{ title: 'Check Friday' }]
      },
      { work_id: '', title: 'bad' },
      null
    ]
  });

  assert.equal(snapshot.source, 'server');
  assert.equal(snapshot.statusLabel, 'Server-backed');
  assert.equal(snapshot.items.length, 1);
  assert.equal(snapshot.items[0].id, 'server-work-1');
  assert.equal(snapshot.items[0].title, 'Server renewal package');
  assert.equal(snapshot.items[0].artifacts[0].id, 'server-artifact-1');
  assert.equal(snapshot.items[0].openApprovals[0].title, 'Approve send');
  assert.equal(snapshot.items[0].followUps[0].title, 'Check Friday');
});

test('fetchSavedWorkSnapshot targets the future v2 Work endpoint', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const snapshot = await fetchSavedWorkSnapshot({
    signal,
    fetcher: async (path, options) => {
      calls.push({ path, options });
      return { items: [{ id: 'server-work', artifacts: [] }] };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/webchat/v2/work');
  assert.equal(calls[0].options.signal, signal);
  assert.equal(snapshot.items[0].id, 'server-work');
});

test('mergeSavedWorkSnapshots keeps local-only artifacts without duplicating server rows', () => {
  const server = normalizeSavedWorkSnapshotResponse({
    items: [
      { id: 'server-work', artifacts: [] },
      { id: 'shared-work', artifacts: [] }
    ]
  });
  const local = {
    source: 'local-browser',
    items: [
      { id: 'shared-work', title: 'Duplicate local row' },
      { id: 'local-work', title: 'Local only' }
    ]
  };

  const merged = mergeSavedWorkSnapshots(server, local);

  assert.equal(merged.source, 'server-plus-local');
  assert.equal(merged.statusLabel, 'Server + this desktop');
  assert.deepEqual(
    merged.items.map((item) => item.id),
    ['server-work', 'shared-work', 'local-work']
  );
});

test('savedWorkServerReadSupported is explicit and quiet by default', () => {
  assert.equal(savedWorkServerReadSupported(null), false);
  assert.equal(savedWorkServerReadSupported({ capabilities: { saved_work_read: true } }), true);
  assert.equal(savedWorkServerReadSupported({ capabilities: { work_read: 'enabled' } }), true);
  assert.equal(savedWorkServerReadSupported({ features: { saved_work_read: 'available' } }), true);
  assert.equal(savedWorkServerReadSupported({ work: { read: true } }), true);
  assert.equal(savedWorkServerReadSupported({ capabilities: { saved_work_read: false } }), false);
});

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

test('saveGeneratedFileArtifactToWork persists generated file bytes as a reloadable Work item', () => {
  const storage = memoryStorage();
  const saved = saveGeneratedFileArtifactToWork({
    artifact: {
      title: 'Services agreement',
      filename: 'services-agreement.docx',
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      data_base64: Buffer.from('PK docx payload', 'utf8').toString('base64'),
      size: 15
    },
    threadId: 'thread-docx',
    threadLabel: 'Services draft',
    storage,
    now: '2026-06-13T16:00:00.000Z',
    idFactory: sequenceIds()
  });

  assert.equal(saved.href, '/work?item=work-1&artifact=artifact-2');
  assert.equal(saved.artifact.type, 'file');
  assert.equal(saved.artifact.filename, 'services-agreement.docx');
  assert.equal(saved.artifact.content_format, 'base64');
  assert.equal(
    saved.artifact.data_base64,
    Buffer.from('PK docx payload', 'utf8').toString('base64')
  );

  const workItems = JSON.parse(storage.getItem('ironclaw-work-items'));
  assert.equal(workItems[0].objective, 'DOCX generated in chat.');
  assert.deepEqual(workItems[0].links, [
    { kind: 'thread', ref: 'thread-docx', label: 'Services draft' }
  ]);
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
    openSavedWorkProduct(
      { href: workArtifactHref('work/with spaces', 'artifact#1') },
      {
        assign: (href) => calls.push(href)
      }
    ),
    true
  );
  assert.deepEqual(calls, ['/work?item=work%2Fwith+spaces&artifact=artifact%231']);
});

test('workArtifactHref preserves the hosted /v2 static app prefix', () => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { pathname: '/v2/chat/thread-1' } };
  try {
    assert.equal(
      workArtifactHref('work-1', 'artifact-2'),
      '/v2/work?item=work-1&artifact=artifact-2'
    );
  } finally {
    globalThis.window = previousWindow;
  }
});
