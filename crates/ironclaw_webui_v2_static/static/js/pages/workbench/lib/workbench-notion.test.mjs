import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeNotionPages, notionTitle, NOTION_PAGE_LIMIT } from './workbench-notion.js';

test('NOTION_PAGE_LIMIT is the documented default', () => {
  assert.equal(NOTION_PAGE_LIMIT, 6);
});

test('notionTitle reads the title-typed property and falls back to (untitled)', () => {
  assert.equal(
    notionTitle({
      properties: {
        Status: { type: 'status' },
        'Meeting Title': { type: 'title', title: [{ plain_text: 'Q2 2026 Management Meeting' }] }
      }
    }),
    'Q2 2026 Management Meeting'
  );
  assert.equal(notionTitle({ properties: { Status: { type: 'status' } } }), '(untitled)');
  assert.equal(notionTitle(null), '(untitled)');
});

test('normalizeNotionPages maps real NOTION_SEARCH_NOTION_PAGE results', () => {
  const rows = normalizeNotionPages({
    successful: true,
    data: {
      response_data: {
        results: [
          {
            object: 'page',
            id: 'page-1',
            url: 'https://notion.so/abc',
            last_edited_time: '2026-06-20T11:41:00.000Z',
            archived: false,
            in_trash: false,
            properties: {
              'Meeting Title': {
                type: 'title',
                title: [{ plain_text: 'Q2 2026 Management Meeting' }]
              },
              Status: { type: 'status' }
            }
          }
        ]
      }
    }
  });
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.title, 'Q2 2026 Management Meeting');
  assert.equal(row.url, 'https://notion.so/abc');
  assert.ok(row.when, 'a human time is derived from last_edited_time');
});

test('normalizeNotionPages drops archived/trashed pages and non-page objects', () => {
  const rows = normalizeNotionPages({
    successful: true,
    data: {
      response_data: {
        results: [
          {
            object: 'page',
            id: 'archived',
            url: 'https://notion.so/archived',
            archived: true,
            properties: { Name: { type: 'title', title: [{ plain_text: 'Old page' }] } }
          },
          {
            object: 'page',
            id: 'trashed',
            url: 'https://notion.so/trashed',
            in_trash: true,
            properties: { Name: { type: 'title', title: [{ plain_text: 'Deleted page' }] } }
          },
          {
            object: 'database',
            id: 'db-1',
            url: 'https://notion.so/db',
            properties: { Name: { type: 'title', title: [{ plain_text: 'A database' }] } }
          },
          {
            object: 'page',
            id: 'empty',
            url: '',
            properties: { Status: { type: 'status' } }
          }
        ]
      }
    }
  });
  assert.deepEqual(rows, [], 'archived, trashed, non-page, and title-less+url-less rows are all dropped');
});

test('normalizeNotionPages keeps a url-only page even when the title is empty', () => {
  const rows = normalizeNotionPages({
    successful: true,
    data: {
      response_data: {
        results: [
          {
            object: 'page',
            id: 'url-only',
            url: 'https://notion.so/xyz',
            properties: { Status: { type: 'status' } }
          }
        ]
      }
    }
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, '(untitled)');
  assert.equal(rows[0].url, 'https://notion.so/xyz');
});

test('normalizeNotionPages returns [] for unsuccessful or malformed payloads', () => {
  assert.deepEqual(normalizeNotionPages(null), []);
  assert.deepEqual(normalizeNotionPages({ successful: false }), []);
  assert.deepEqual(normalizeNotionPages({ data: {} }), []);
  assert.deepEqual(normalizeNotionPages({ data: { response_data: { results: 'nope' } } }), []);
});
