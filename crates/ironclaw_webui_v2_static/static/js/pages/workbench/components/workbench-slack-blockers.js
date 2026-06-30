import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';

// One blocker-shaped Slack message. The whole row deep-links to the real Slack
// thread (permalink) in a new tab; rows without a permalink render as static.
function BlockerRow({ row }) {
  const meta = [row.who && `@${row.who}`, row.channel && `#${row.channel}`, row.when]
    .filter(Boolean)
    .join(' · ');
  const inner = html`
    <span className="wb13-brief-rowtitle wb13-blocker-text">${row.text}</span>
    ${meta ? html`<span className="wb13-brief-rowmeta">${meta}</span>` : null}
  `;
  if (row.permalink) {
    return html`
      <a
        className="wb13-brief-row wb13-brief-row-static"
        data-testid="workbench-blocker-row"
        href=${row.permalink}
        target="_blank"
        rel="noopener noreferrer"
        title="Open this message in Slack"
      >
        ${inner}
        <span className="wb13-brief-rowlink"><${Icon} name="external" /></span>
      </a>
    `;
  }
  return html`<div
    className="wb13-brief-row wb13-brief-row-static"
    data-testid="workbench-blocker-row"
  >
    ${inner}
  </div>`;
}

// The on-demand "Find Slack blockers" result. Shows real Slack messages matching
// blocker language, sorted by recency, each linking to its thread. Honest: it is
// a keyword search the user judges — not an LLM verdict — and nothing is posted.
// States: loading / results / honest empty / honest error. Dismiss clears it.
export function WorkbenchSlackBlockers({ active, rows, isLoading, isError, onDismiss }) {
  if (!active) return null;

  let body;
  if (isLoading) {
    body = html`<p className="wb13-brief-empty">Searching Slack for blockers…</p>`;
  } else if (isError) {
    body = html`<p className="wb13-brief-empty">
      Could not search Slack right now. Your other connected sources are unaffected.
    </p>`;
  } else if (!rows.length) {
    body = html`<p className="wb13-brief-empty">
      No recent Slack messages match blocker language. Nothing looks stuck right now.
    </p>`;
  } else {
    body = html`<div className="wb13-blocker-list">
      ${rows.map((row) => html`<${BlockerRow} key=${row.id} row=${row} />`)}
    </div>`;
  }

  return html`
    <section
      className="wb13-brief"
      data-testid="workbench-slack-blockers"
      aria-label="Slack blockers"
    >
      <div className="wb13-brief-head">
        <div className="wb13-brief-icon"><${Icon} name="chat" /></div>
        <div className="wb13-brief-headline">
          <div className="wb13-brief-eyebrow">Slack · blocker search</div>
          <h2>
            ${isLoading
              ? 'Checking Slack for blockers'
              : rows.length
                ? `${rows.length} possible blocker${rows.length === 1 ? '' : 's'} in Slack`
                : 'Slack blockers'}
          </h2>
        </div>
        <button
          type="button"
          className="wb13-brief-dismiss"
          aria-label="Dismiss Slack blockers"
          onClick=${onDismiss}
        >
          <${Icon} name="close" />
        </button>
      </div>
      <div className="wb13-brief-sources">
        <span className="wb13-brief-source"><${Icon} name="chat" />Slack</span>
        <span className="wb13-brief-source is-quiet">Read-only · nothing posted</span>
      </div>
      ${body}
      <div className="wb13-brief-foot">
        <${Icon} name="shield" />
        <span
          >Keyword search across your Slack — you decide what's a real blocker. Nothing was
          posted.</span
        >
      </div>
    </section>
  `;
}
