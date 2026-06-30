import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';
import { useConnectorNotionPage } from '../hooks/useWorkbenchConnectors.js';
import { notionGist } from '../lib/workbench-notion-new.js';

// One card in the "New in Notion" band. Fetches the page's content (read-only) and shows a
// 1-line gist of what the new page IS — so the band says what the new Project Passport is
// about, not just that it exists. Honest: a quiet "Reading…" while in flight, no gist line
// when the page has no readable body.
function NotionNewCard({ page, onOpen, onDismiss }) {
  const { page: content, isLoading } = useConnectorNotionPage(String(page.id || ''));
  const gist = content && content.ok ? notionGist(content.blocks) : '';
  const pageId = String(page.id || '');
  return html`<div className="wb13-notionnew-card" data-testid="workbench-notion-new-card">
    <button
      type="button"
      className="wb13-card-open"
      onClick=${() =>
        typeof onOpen === 'function' &&
        onOpen({ kind: 'notion', pageId, pageUrl: page.url || '', title: page.title })}
    >
      <div className="wb13-notionnew-main">
        <div className="wb13-notionnew-row">
          <span className=${cn('wb13-status-pill', page.isNew ? 'is-decision' : 'is-reply')}>
            ${page.isNew ? 'Created' : 'Updated'}
          </span>
          <span className="wb13-notionnew-name">${page.title}</span>
          ${page.when ? html`<span className="wb13-notionnew-when">${page.when}</span>` : null}
        </div>
        ${gist
          ? html`<div className="wb13-notionnew-gist">${gist}</div>`
          : isLoading
            ? html`<div className="wb13-notionnew-gist is-loading">Reading…</div>`
            : null}
      </div>
    </button>
    ${typeof onDismiss === 'function'
      ? html`<button
          type="button"
          className="wb13-notionnew-dismiss"
          data-testid="workbench-notion-new-dismiss"
          aria-label=${`Dismiss ${page.title || 'page'}`}
          onClick=${() => onDismiss(pageId)}
        >
          ×
        </button>`
      : null}
  </div>`;
}

// Proactive "New in Notion" home band: surfaces pages created/edited recently that the
// user has not yet reviewed (e.g. a new Project Passport), so the home flags new things
// instead of the user digging. Quiet + curated (capped), honest-empty (renders nothing
// when there is nothing new). Each card shows a 1-line gist of the page content; opening a
// row routes to the in-app Notion reader; "Mark reviewed" clears the band until something
// genuinely changes again.
export function WorkbenchNotionNew({ pages = [], onOpen, onReviewed, onDismiss }) {
  const rows = Array.isArray(pages) ? pages : [];
  if (!rows.length) return null;
  return html`
    <section className="wb13-section wb13-notionnew" data-testid="workbench-notion-new">
      <div className="wb13-notionnew-head">
        <span className="wb13-notionnew-title">
          <${Icon} name="file" /> New in Notion
          <span className="wb13-notionnew-count">${rows.length}</span>
        </span>
        ${typeof onReviewed === 'function'
          ? html`<button
              type="button"
              className="wb13-notionnew-clear"
              data-testid="workbench-notion-new-reviewed"
              onClick=${() => onReviewed()}
            >
              Mark reviewed
            </button>`
          : null}
      </div>
      ${rows.map(
        (page) =>
          html`<${NotionNewCard}
            key=${page.id}
            page=${page}
            onOpen=${onOpen}
            onDismiss=${onDismiss}
          />`
      )}
    </section>
  `;
}
