import assert from 'node:assert/strict';
import { test } from 'node:test';

import { selectNewNotionPages, notionSeenAfterViewing } from './workbench-notion-new.js';

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
