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
      when: formatInboxWhen(page.last_edited_time)
    });
    if (rows.length >= limit) break;
  }
  return rows;
}
