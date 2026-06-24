import { Link } from 'react-router';

import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { saveBlob } from '../../../lib/save-file.js';
import { formatInboxWhen, gmailMessageHref } from '../lib/workbench-connectors.js';
import { buildDocxBlob, briefingToWorkProduct } from '../lib/workbench-docx.js';
import { saveLibraryItem } from '../lib/workbench-library-store.js';

// Save the current briefing as a real, editable .docx work product (Arial, bold
// headings, a Sources section), and file a record of it in the local Library so it
// shows up under saved work. Read-only: it writes a local file, sends nothing.
async function downloadBriefDocx(briefing) {
  try {
    await saveBlob(buildDocxBlob(briefingToWorkProduct(briefing)), 'ironclaw-daily-brief.docx');
    saveLibraryItem({ title: briefing?.headline || 'Daily briefing', kind: 'Briefing' });
  } catch (_) {
    // A failed save is non-fatal — the briefing stays on screen.
  }
}

// A reply waiting on the user. The body opens the in-app reading panel (full
// message via a READ tool); the external glyph opens the thread in Gmail. Mirrors
// the Arrived inbox row so the briefing feels native, not bolted on.
function BriefReplyRow({ message, onOpenMessage }) {
  const when = formatInboxWhen(message.timestamp);
  const meta = [message.sender, when].filter(Boolean).join(' · ');
  const gmailHref = gmailMessageHref(message);
  return html`
    <div className="wb13-brief-row">
      <button
        type="button"
        className="wb13-brief-rowmain"
        data-testid="workbench-briefing-reply"
        aria-label=${`Open email: ${message.subject}`}
        onClick=${() => onOpenMessage?.(message)}
      >
        <span className="wb13-brief-rowtitle">${message.subject}</span>
        ${meta ? html`<span className="wb13-brief-rowmeta">${meta}</span>` : null}
      </button>
      ${gmailHref
        ? html`<a
            className="wb13-brief-rowlink"
            href=${gmailHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label=${`Open in Gmail: ${message.subject}`}
            title="Open in Gmail"
          >
            <${Icon} name="external" />
          </a>`
        : null}
    </div>
  `;
}

function BriefEventRow({ event }) {
  const meta = [event.when, event.location].filter(Boolean).join(' · ');
  const inner = html`
    <span className="wb13-brief-rowtitle">${event.title}</span>
    ${meta ? html`<span className="wb13-brief-rowmeta">${meta}</span>` : null}
  `;
  if (event.link) {
    return html`
      <a
        className="wb13-brief-row wb13-brief-row-static"
        href=${event.link}
        target="_blank"
        rel="noopener noreferrer"
      >
        ${inner}
      </a>
    `;
  }
  return html`<div className="wb13-brief-row wb13-brief-row-static">${inner}</div>`;
}

function BriefAttentionRow({ row }) {
  const inner = html`
    <span className="wb13-brief-rowtitle">${row.title}</span>
    ${row.detail ? html`<span className="wb13-brief-rowmeta">${row.detail}</span>` : null}
  `;
  if (row.href) {
    return html`<${Link} to=${row.href} className="wb13-brief-row wb13-brief-row-static"
      >${inner}<//
    >`;
  }
  return html`<div className="wb13-brief-row wb13-brief-row-static">${inner}</div>`;
}

// External-link row used by GitHub / Drive / Notion sections: a title, a meta
// line, and (when there's a real link) an external glyph that opens the source.
function BriefLinkRow({ title, meta, link, testid }) {
  const inner = html`
    <span className="wb13-brief-rowtitle">${title}</span>
    ${meta ? html`<span className="wb13-brief-rowmeta">${meta}</span>` : null}
  `;
  if (link) {
    return html`
      <a
        className="wb13-brief-row wb13-brief-row-static"
        data-testid=${testid}
        href=${link}
        target="_blank"
        rel="noopener noreferrer"
      >
        ${inner}
        <span className="wb13-brief-rowlink"><${Icon} name="external" /></span>
      </a>
    `;
  }
  return html`<div className="wb13-brief-row wb13-brief-row-static" data-testid=${testid}>
    ${inner}
  </div>`;
}

function BriefSection({ icon, title, count, children }) {
  return html`
    <div className="wb13-brief-section">
      <div className="wb13-brief-sectiontitle">
        <${Icon} name=${icon} />
        <span>${title}</span>
        ${count ? html`<span className="wb13-brief-sectioncount">${count}</span>` : null}
      </div>
      ${children}
    </div>
  `;
}

function sourceIcon(id) {
  if (id === 'calendar') return 'calendar';
  if (id === 'drive') return 'folder';
  if (id === 'notion') return 'file';
  if (id === 'github') return 'spark';
  if (id === 'slack') return 'chat';
  return 'mail';
}

function BriefingSources({ sources = [] }) {
  if (!sources.length) return null;
  return html`<div className="wb13-brief-sources">
    ${sources.map(
      (source) => html`
        <span key=${source.id} className="wb13-brief-source">
          <${Icon} name=${sourceIcon(source.id)} />
          ${source.label}
        </span>
      `
    )}
    <span className="wb13-brief-source is-quiet">Read-only · nothing sent</span>
  </div>`;
}

// The deterministic briefing result. Rendered when the user asks a catch-up
// question the Workbench can answer from connector data already in hand — no
// agent, no model round-trip. Every row is real (Gmail/Calendar/active work);
// empty inputs degrade to an honest all-clear. Dismissing returns to the surface.
export function WorkbenchBriefing({ briefing, onOpenMessage, onDismiss }) {
  if (!briefing) return null;
  if (briefing.isLoading) {
    const loadingSources = Array.isArray(briefing.sources) ? briefing.sources : [];
    const sourceLabel = loadingSources.map((source) => source.label).join(', ');
    return html`
      <section className="wb13-brief" data-testid="workbench-briefing" aria-label="Briefing">
        <div className="wb13-brief-head">
          <div className="wb13-brief-icon"><${Icon} name="spark" /></div>
          <div className="wb13-brief-headline">
            <div className="wb13-brief-eyebrow">Briefing · checking sources</div>
            <h2>Checking your connected tools before summarizing.</h2>
          </div>
          <button
            type="button"
            className="wb13-brief-dismiss"
            aria-label="Dismiss briefing"
            onClick=${onDismiss}
          >
            <${Icon} name="close" />
          </button>
        </div>

        <${BriefingSources} sources=${loadingSources} />
        <p className="wb13-brief-empty">
          ${sourceLabel
            ? `Reading ${sourceLabel}. Nothing is being sent.`
            : 'Reading your connected tools. Nothing is being sent.'}
        </p>

        <div className="wb13-brief-foot">
          <${Icon} name="shield" />
          <span>Waiting for real connector reads so the briefing does not guess.</span>
        </div>
      </section>
    `;
  }
  const {
    headline,
    counts,
    sources,
    replies,
    events,
    attention,
    slack,
    slackAwaiting = [],
    slackWeighIn = [],
    github,
    drive,
    notion,
    sourceProblems = []
  } = briefing;
  const nothing =
    !replies.length &&
    !events.length &&
    !attention.length &&
    !(slackAwaiting && slackAwaiting.length) &&
    !(slackWeighIn && slackWeighIn.length) &&
    !(slack && slack.length) &&
    !(github && github.length) &&
    !(drive && drive.length) &&
    !(notion && notion.length) &&
    !sourceProblems.length;

  return html`
    <section className="wb13-brief" data-testid="workbench-briefing" aria-label="Briefing">
      <div className="wb13-brief-head">
        <div className="wb13-brief-icon"><${Icon} name="spark" /></div>
        <div className="wb13-brief-headline">
          <div className="wb13-brief-eyebrow">Briefing · updated just now</div>
          <h2>${headline}</h2>
        </div>
        <button
          type="button"
          className="wb13-brief-dismiss"
          aria-label="Download brief as a Word document"
          title="Download as .docx"
          onClick=${() => downloadBriefDocx(briefing)}
        >
          <${Icon} name="file" />
        </button>
        <button
          type="button"
          className="wb13-brief-dismiss"
          aria-label="Dismiss briefing"
          onClick=${onDismiss}
        >
          <${Icon} name="close" />
        </button>
      </div>

      <${BriefingSources} sources=${sources} />
      ${nothing
        ? html`<p className="wb13-brief-empty">
            Inbox is clear, nothing is waiting on a decision, and there's nothing else queued for
            you right now.
          </p>`
        : html`<div className="wb13-brief-grid">
            ${slackAwaiting && slackAwaiting.length
              ? html`<${BriefSection}
                  icon="chat"
                  title="Awaiting your reply"
                  count=${counts.slackAwaiting}
                >
                  ${slackAwaiting.map(
                    (row) =>
                      html`<${BriefLinkRow}
                        key=${row.id}
                        title=${row.text}
                        meta=${[row.channel ? `#${row.channel}` : '', row.who]
                          .filter(Boolean)
                          .join(' · ')}
                        link=${row.replyHref}
                        testid="workbench-briefing-slack-awaiting"
                      />`
                  )}
                <//>`
              : null}
            ${slackWeighIn && slackWeighIn.length
              ? html`<${BriefSection}
                  icon="chat"
                  title="Worth weighing in"
                  count=${counts.slackWeighIn}
                >
                  ${slackWeighIn.map(
                    (row) =>
                      html`<${BriefLinkRow}
                        key=${row.id}
                        title=${row.text}
                        meta=${[row.channel ? `#${row.channel}` : '', "you weren't tagged"]
                          .filter(Boolean)
                          .join(' · ')}
                        link=${row.replyHref}
                        testid="workbench-briefing-slack-weighin"
                      />`
                  )}
                <//>`
              : null}
            ${replies.length
              ? html`<${BriefSection} icon="mail" title="Replies waiting" count=${counts.replies}>
                  ${replies.map(
                    (message) =>
                      html`<${BriefReplyRow}
                        key=${message.id}
                        message=${message}
                        onOpenMessage=${onOpenMessage}
                      />`
                  )}
                <//>`
              : null}
            ${events.length
              ? html`<${BriefSection}
                  icon="calendar"
                  title="On your calendar"
                  count=${counts.events}
                >
                  ${events.map(
                    (event) => html`<${BriefEventRow} key=${event.id} event=${event} />`
                  )}
                <//>`
              : null}
            ${attention.length
              ? html`<${BriefSection} icon="shield" title="To decide" count=${counts.attention}>
                  ${attention.map((row) => html`<${BriefAttentionRow} key=${row.id} row=${row} />`)}
                <//>`
              : null}
            ${slack && slack.length
              ? html`<${BriefSection} icon="chat" title="Slack to check" count=${counts.slack}>
                  ${slack.map(
                    (row) =>
                      html`<${BriefLinkRow}
                        key=${row.id}
                        title=${row.text}
                        meta=${[row.who, row.channel ? `#${row.channel}` : '', row.when]
                          .filter(Boolean)
                          .join(' · ')}
                        link=${row.permalink}
                        testid="workbench-briefing-slack"
                      />`
                  )}
                <//>`
              : null}
            ${github && github.length
              ? html`<${BriefSection} icon="spark" title="On GitHub" count=${counts.github}>
                  ${github.map(
                    (row) =>
                      html`<${BriefLinkRow}
                        key=${row.id}
                        title=${row.title}
                        meta=${[row.reason, row.repo, row.when].filter(Boolean).join(' · ')}
                        link=${row.link}
                        testid="workbench-briefing-github"
                      />`
                  )}
                <//>`
              : null}
            ${drive && drive.length
              ? html`<${BriefSection} icon="folder" title="Recent files" count=${counts.drive}>
                  ${drive.map(
                    (row) =>
                      html`<${BriefLinkRow}
                        key=${row.id}
                        title=${row.name}
                        meta=${[row.kind, row.when].filter(Boolean).join(' · ')}
                        link=${row.link}
                        testid="workbench-briefing-drive"
                      />`
                  )}
                <//>`
              : null}
            ${notion && notion.length
              ? html`<${BriefSection} icon="file" title="Recent in Notion" count=${counts.notion}>
                  ${notion.map(
                    (row) =>
                      html`<${BriefLinkRow}
                        key=${row.id}
                        title=${row.title}
                        meta=${row.when}
                        link=${row.url}
                        testid="workbench-briefing-notion"
                      />`
                  )}
                <//>`
              : null}
            ${sourceProblems.length
              ? html`<${BriefSection}
                  icon="shield"
                  title="Could not read"
                  count=${counts.sourceProblems}
                >
                  ${sourceProblems.map(
                    (row) =>
                      html`<${BriefLinkRow}
                        key=${row.id}
                        title=${row.label}
                        meta=${row.detail}
                        testid="workbench-briefing-source-problem"
                      />`
                  )}
                <//>`
              : null}
          </div>`}

      <div className="wb13-brief-foot">
        <${Icon} name="shield" />
        <span>Synthesized from your connected tools. Reads stay private — nothing was sent.</span>
      </div>
    </section>
  `;
}
