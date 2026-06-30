import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  selectNewNotionPages,
  notionSeenAfterViewing,
  notionGist,
  notionDismissKey,
  filterDismissedNotionPages
} from './workbench-notion-new.js';

const now = Date.parse('2026-06-28T20:00:00Z');
const isoAgoMin = (min) => new Date(now - min * 60000).toISOString();
const page = (id, editedAgoMin, createdSameAsEdited = true) => {
  const edited = isoAgoMin(editedAgoMin);
  return {
    id,
    title: `Page ${id}`,
    url: `https://notion.so/${id}`,
    when: 'recently',
    lastEditedTime: edited,
    createdTime: createdSameAsEdited ? edited : isoAgoMin(60 * 24 * 90) // created 90d ago
  };
};

test('selectNewNotionPages: surfaces recent unseen pages, newest first, capped', () => {
  const out = selectNewNotionPages(
    [page('a', 10), page('b', 60), page('c', 5)],
    {},
    {
      nowMs: now,
      windowDays: 7,
      limit: 2
    }
  );
  assert.deepEqual(
    out.map((p) => p.id),
    ['c', 'a']
  );
});

test('selectNewNotionPages: filters pages already reviewed at this revision', () => {
  const pages = [page('a', 10)];
  const seen = notionSeenAfterViewing(pages, {});
  assert.deepEqual(selectNewNotionPages(pages, seen, { nowMs: now }), []);
});

test('selectNewNotionPages: re-surfaces a page edited after it was reviewed', () => {
  const seen = notionSeenAfterViewing([page('a', 120)], {});
  const out = selectNewNotionPages([page('a', 5)], seen, { nowMs: now });
  assert.deepEqual(
    out.map((p) => p.id),
    ['a']
  );
});

test('selectNewNotionPages: excludes pages outside the recency window', () => {
  assert.deepEqual(
    selectNewNotionPages([page('a', 30 * 24 * 60)], {}, { nowMs: now, windowDays: 7 }),
    []
  );
});

test('selectNewNotionPages: tags created vs updated', () => {
  const out = selectNewNotionPages([page('a', 5, true), page('b', 5, false)], {}, { nowMs: now });
  const byId = Object.fromEntries(out.map((p) => [p.id, p.isNew]));
  assert.equal(byId.a, true, 'created≈edited -> isNew');
  assert.equal(byId.b, false, 'edited an old page -> updated');
});

test('selectNewNotionPages: honest-empty on no pages / missing timestamps', () => {
  assert.deepEqual(selectNewNotionPages([], {}, { nowMs: now }), []);
  assert.deepEqual(selectNewNotionPages([{ id: 'x', title: 'x' }], {}, { nowMs: now }), []);
});

test('notionGist: joins the first non-empty blocks, skips dividers + blanks', () => {
  const g = notionGist([
    { kind: 'divider', text: '' },
    { kind: 'para', text: '   ' },
    { kind: 'heading', text: 'Project Passport: IronClaw Desktop' },
    { kind: 'para', text: 'A Tauri desktop client for the IronClaw agent.' },
    { kind: 'para', text: 'Third block is ignored.' }
  ]);
  assert.ok(g.startsWith('Project Passport: IronClaw Desktop — A Tauri desktop client'));
  assert.ok(!g.includes('Third block'));
});

test('notionGist: honest-empty when there is no readable body', () => {
  assert.equal(notionGist([]), '');
  assert.equal(
    notionGist([
      { kind: 'divider', text: '' },
      { kind: 'para', text: '  ' }
    ]),
    ''
  );
  assert.equal(notionGist(null), '');
});

test('notionGist: truncates to maxChars with an ellipsis', () => {
  const g = notionGist([{ kind: 'para', text: 'x'.repeat(300) }], { maxChars: 40 });
  assert.ok(g.length <= 40);
  assert.ok(g.endsWith('…'));
});

test('notionDismissKey: namespaces under notion: and coerces to string', () => {
  assert.equal(notionDismissKey('abc-123'), 'notion:abc-123');
  assert.equal(notionDismissKey(''), 'notion:');
  assert.equal(notionDismissKey(undefined), 'notion:');
});

test('filterDismissedNotionPages: drops dismissed pages, keeps the rest', () => {
  const pages = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const dismissals = { [notionDismissKey('b')]: { reason: 'dismissed-notion', sender: '', ts: 1 } };
  const out = filterDismissedNotionPages(pages, dismissals);
  assert.deepEqual(
    out.map((p) => p.id),
    ['a', 'c']
  );
});

test('filterDismissedNotionPages: a non-notion dismissal key never suppresses a page', () => {
  // A dismissed EMAIL row that happens to share the bare id must NOT hide the Notion page —
  // the notion: namespace fences them apart.
  const pages = [{ id: 'shared-id' }];
  const dismissals = { 'shared-id': { reason: 'Not relevant', sender: 'x@y.com', ts: 1 } };
  assert.deepEqual(
    filterDismissedNotionPages(pages, dismissals).map((p) => p.id),
    ['shared-id']
  );
});

test('filterDismissedNotionPages: tolerates non-array input + empty dismissals', () => {
  assert.deepEqual(filterDismissedNotionPages(null, {}), []);
  assert.deepEqual(
    filterDismissedNotionPages([{ id: 'a' }], undefined).map((p) => p.id),
    ['a']
  );
});
