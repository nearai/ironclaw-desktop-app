import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  normalizeNotionPages,
  normalizeNotionPageContent,
  notionTitle,
  NOTION_PAGE_LIMIT
} from './workbench-notion.js';

test('normalizeNotionPageContent flattens NOTION_FETCH_BLOCK_CONTENTS into render blocks', () => {
  const result = {
    successful: true,
    data: {
      // Real Composio envelope: Notion action payloads are wrapped under response_data.
      response_data: {
        results: [
          {
            type: 'heading_2',
            heading_2: { rich_text: [{ plain_text: '🔹 Updates from the Teams' }] }
          },
          {
            type: 'paragraph',
            paragraph: {
              rich_text: [{ plain_text: 'Each team has ' }, { plain_text: '3 minutes' }]
            }
          },
          {
            type: 'bulleted_list_item',
            bulleted_list_item: { rich_text: [{ plain_text: 'First point' }] }
          },
          { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Ship it' }], checked: true } },
          { type: 'divider', divider: {} },
          { type: 'paragraph', paragraph: { rich_text: [] } } // empty -> dropped
        ]
      }
    }
  };
  const out = normalizeNotionPageContent(result);
  assert.equal(out.ok, true);
  assert.deepEqual(
    out.blocks.map((b) => [b.kind, b.text || b.kind]),
    [
      ['heading', '🔹 Updates from the Teams'],
      ['para', 'Each team has 3 minutes'],
      ['bullet', 'First point'],
      ['todo', 'Ship it'],
      ['divider', 'divider']
    ],
    'block types mapped + empty paragraph dropped + rich-text runs joined'
  );
  assert.equal(out.blocks[0].level, 2, 'heading level preserved');
  assert.equal(out.blocks[3].checked, true, 'to_do checked flag preserved');
});

test('normalizeNotionPageContent accepts the response_data.children key and legacy fallbacks', () => {
  const block = (text) => ({ type: 'paragraph', paragraph: { rich_text: [{ plain_text: text }] } });
  // Notion's native children key under response_data
  const childrenShape = normalizeNotionPageContent({
    successful: true,
    data: { response_data: { children: [block('from children')] } }
  });
  assert.deepEqual(
    childrenShape.blocks.map((b) => b.text),
    ['from children']
  );
  // Legacy block_child_data shape still parses (defensive fallback)
  const legacyShape = normalizeNotionPageContent({
    successful: true,
    data: { block_child_data: { results: [block('from legacy')] } }
  });
  assert.deepEqual(
    legacyShape.blocks.map((b) => b.text),
    ['from legacy']
  );
});

test('normalizeNotionPageContent is honest on failed/empty reads', () => {
  assert.equal(normalizeNotionPageContent({ successful: false, error: 'no access' }).ok, false);
  assert.deepEqual(normalizeNotionPageContent({ successful: true, data: {} }).blocks, []);
  assert.deepEqual(normalizeNotionPageContent(null).blocks, []);
});

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
  assert.deepEqual(
    rows,
    [],
    'archived, trashed, non-page, and title-less+url-less rows are all dropped'
  );
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
