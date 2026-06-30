// Deterministic "Recent Notion pages".
//
// Like the Slack blocker read, this is an on-demand, read-only surface: clicking
// the chip runs a single Notion page search (NOTION_SEARCH_NOTION_PAGE — the
// SEARCH segment passes the read-only route guard) and renders the real pages it
// returns with a deep link to each. No agent, no model round-trip. Honest
// framing: these are pages Notion's own search returned — surfaced for the user
// to open — not an LLM's guess at what is "relevant".

import { formatInboxWhen } from './workbench-connectors.js';

// How many pages the surface shows.
export const NOTION_PAGE_LIMIT = 6;

// Extract a page's human title from its `properties` map. Notion stores the
// title under whichever property has `type === 'title'` (the name varies per
// database: "Name", "Meeting Title", …), as an array of rich-text runs. Join the
// runs' `plain_text`, collapse whitespace, and fall back to '(untitled)'. Never
// returns raw markup.
export function notionTitle(page) {
  const properties = page && typeof page.properties === 'object' ? page.properties : null;
  if (!properties) return '(untitled)';
  for (const key of Object.keys(properties)) {
    const property = properties[key];
    if (!property || property.type !== 'title') continue;
    const runs = Array.isArray(property.title) ? property.title : [];
    const text = runs
      .map((run) => (run && typeof run.plain_text === 'string' ? run.plain_text : ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) return text;
  }
  return '(untitled)';
}

// Normalize a NOTION_SEARCH_NOTION_PAGE read into page rows:
// `{ id, title, url, when }`. Honest contract: [] on any unsuccessful/empty/
// malformed payload; never fabricates a page; includes only `object: 'page'`
// entries that are not archived and not in the trash; drops a row whose title
// resolves empty AND has no url.
export function normalizeNotionPages(result, { limit = 6 } = {}) {
  if (!result || result.successful === false) return [];
  const data = result.data || result;
  const results = data?.response_data?.results;
  if (!Array.isArray(results)) return [];
  const rows = [];
  for (const page of results) {
    if (!page || typeof page !== 'object') continue;
    if (page.object !== 'page') continue;
    if (page.archived === true || page.in_trash === true) continue;
    const url = typeof page.url === 'string' && /^https?:\/\//i.test(page.url) ? page.url : '';
    const rawTitle = notionTitle(page);
    const hasTitle = rawTitle && rawTitle !== '(untitled)';
    if (!hasTitle && !url) continue;
    rows.push({
      id: String(page.id || url || rawTitle),
      title: rawTitle,
      url,
      when: formatInboxWhen(page.last_edited_time),
      // Raw ISO timestamps power the "new since last seen" diff (createdTime lets us
      // distinguish a freshly-created page from an edit of an old one).
      createdTime: typeof page.created_time === 'string' ? page.created_time : '',
      lastEditedTime: typeof page.last_edited_time === 'string' ? page.last_edited_time : ''
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

const s = (v) => (v == null ? '' : String(v));

// Normalize a NOTION_FETCH_BLOCK_CONTENTS read of a page into renderable blocks
// for the in-app viewer. The gateway returns the page's child blocks under
// `data.block_child_data.results[]`; each block carries a `type` and the content
// under a field of that same name (e.g. a "heading_2" block has its rich text at
// `block.heading_2.rich_text[]`). We flatten each block's rich-text runs to plain
// text and map the Notion block type to a small render vocabulary. Honest
// contract: `{ ok:false, error }` on a failed/empty read; never fabricates text.
export function normalizeNotionPageContent(result) {
  if (!result || result.successful === false) {
    return {
      ok: false,
      error: s(result && result.error) || 'Could not load this page.',
      blocks: []
    };
  }
  const data = result.data || result;
  // Composio wraps Notion action payloads under `data.response_data` (the working
  // recents/search path reads response_data.results). The read path previously looked
  // for `block_child_data.results` / `data.results`, which the real
  // NOTION_FETCH_BLOCK_CONTENTS payload never has — so every opened page flattened to
  // zero blocks and rendered the honest "no readable content" empty state. Prefer
  // response_data, accept Notion's native `children` key, keep the legacy keys as
  // defensive fallbacks.
  const inner = (data && data.response_data) || data || {};
  const results =
    (Array.isArray(inner.results) && inner.results) ||
    (Array.isArray(inner.children) && inner.children) ||
    (Array.isArray(data && data.results) && data.results) ||
    (data && data.block_child_data && data.block_child_data.results) ||
    [];
  if (!Array.isArray(results)) return { ok: true, error: '', blocks: [] };
  const blocks = [];
  for (const block of results) {
    if (!block || typeof block !== 'object') continue;
    const type = s(block.type);
    if (type === 'divider') {
      blocks.push({ kind: 'divider', text: '' });
      continue;
    }
    const content = block[type] || {};
    const text = Array.isArray(content.rich_text)
      ? content.rich_text
          .map((run) => s(run && run.plain_text))
          .join('')
          .trim()
      : '';
    if (!text) continue;
    const headingMatch = /^heading_([123])$/.exec(type);
    if (headingMatch) blocks.push({ kind: 'heading', level: Number(headingMatch[1]), text });
    else if (type === 'bulleted_list_item') blocks.push({ kind: 'bullet', text });
    else if (type === 'numbered_list_item') blocks.push({ kind: 'number', text });
    else if (type === 'to_do')
      blocks.push({ kind: 'todo', text, checked: Boolean(content.checked) });
    else if (type === 'quote') blocks.push({ kind: 'quote', text });
    else if (type === 'code') blocks.push({ kind: 'code', text });
    else if (type === 'callout') blocks.push({ kind: 'callout', text });
    else blocks.push({ kind: 'para', text });
  }
  return { ok: true, error: '', blocks };
}
