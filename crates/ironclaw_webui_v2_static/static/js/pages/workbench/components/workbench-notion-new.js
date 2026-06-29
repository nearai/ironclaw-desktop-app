import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';

// Proactive "New in Notion" home band: surfaces pages created/edited recently that the
// user has not yet reviewed (e.g. a new Project Passport), so the home flags new things
// instead of the user digging. Quiet + curated (capped), honest-empty (renders nothing
// when there is nothing new). Opening a row routes to the in-app Notion reader; "Mark
// reviewed" clears the band until something genuinely changes again.
export function WorkbenchNotionNew({ pages = [], onOpen, onReviewed }) {
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
          html`<button
            key=${page.id}
            type="button"
            className="wb13-notionnew-card"
            data-testid="workbench-notion-new-card"
            onClick=${() =>
              typeof onOpen === 'function' &&
              onOpen({
                kind: 'notion',
                pageId: String(page.id || ''),
                pageUrl: page.url || '',
                title: page.title
              })}
          >
            <span className=${cn('wb13-status-pill', page.isNew ? 'is-decision' : 'is-reply')}>
              ${page.isNew ? 'Created' : 'Updated'}
            </span>
            <span className="wb13-notionnew-name">${page.title}</span>
            ${page.when ? html`<span className="wb13-notionnew-when">${page.when}</span>` : null}
          </button>`
      )}
    </section>
  `;
}
