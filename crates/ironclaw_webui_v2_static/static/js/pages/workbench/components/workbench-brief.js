import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';

// The RICH briefing render — the daily-briefing skill's five sections, fed by the
// tool-free synthesis turn (workbench-brief-synth.js): a summary count, "Needs
// you" with a why-it's-on-you context line + an inline, editable, ready reply,
// the "Worth weighing in" radar (decisions forming in your domain you weren't
// tagged on), "This week", and "Best times". Reuses the wb13-brief-* tokens so it
// is visually native to v13. Read-only posture: the inline reply only ever opens
// the gated draft modal — nothing is sent from here.

// Human summary line from the validated counts. Pure + exported for unit tests.
export function briefSummaryLine(summary = {}) {
  const parts = [];
  const r = Number(summary.awaitingReply) || 0;
  const f = Number(summary.flagged) || 0;
  const w = Number(summary.weeklySignals) || 0;
  if (r) parts.push(`${r} awaiting your reply`);
  if (f) parts.push(`${f} flagged for you`);
  if (w) parts.push(`${w} weekly ${w === 1 ? 'signal' : 'signals'}`);
  if (!parts.length) return "You're all clear — nothing needs you right now.";
  return parts.join(' · ');
}

function Badges({ items }) {
  const badges = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!badges.length) return null;
  return html`<span className="wb13-brief-rowmeta">${badges.join(' · ')}</span>`;
}

// Copy the (possibly edited) reply to the clipboard. Best-effort: the async
// Clipboard API where available, a hidden-textarea execCommand fallback otherwise
// (non-secure contexts). NEVER posts anything — copy only.
function copyReplyToClipboard(text) {
  const value = String(text || '');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).catch(() => {});
      return;
    }
  } catch (_) {
    // fall through to the textarea path
  }
  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'absolute';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
  } catch (_) {
    // copy is a convenience; a failure is non-fatal
  }
}

// One "Needs you" item: who (channel · sender for Slack, source · sender for email)
// + badges, the context line, and — when a reply is owed — an editable draft. The
// action branches on source to keep the read-only / gated-write posture intact:
//   Email -> "Save as draft" opens the reviewable Gmail draft (a Draft-classed write).
//   Slack -> "Reply in Slack" opens the thread + "Copy reply" copies the text; Slack
//            has no draft API, so v1 posts NOTHING (no SLACK_POST is wired).
// The textarea is local state so the user edits before any of that.
function NeedsYouCard({ item, onDraftReply }) {
  const [body, setBody] = React.useState(item.suggestedReply || '');
  const hasReply = Boolean((item.suggestedReply || '').trim());
  const isSlack = item.source === 'Slack';
  const who = isSlack
    ? [item.channel ? `#${item.channel}` : 'Slack', item.sender].filter(Boolean).join(' · ')
    : [item.source, item.sender].filter(Boolean).join(' · ');
  return html`
    <div className="wb13-brief-row wb13-brief-needsyou" data-testid="workbench-brief-needsyou-item">
      <div className="wb13-brief-rowmain wb13-brief-needsyou-main">
        <span className="wb13-brief-rowtitle">${who || 'Needs you'}</span>
        <${Badges} items=${item.badges} />
        ${item.context ? html`<span className="wb13-brief-rowmeta">${item.context}</span>` : null}
        ${hasReply
          ? html`<textarea
                aria-label="Suggested reply"
                className="wb13-approve-textarea wb13-brief-reply"
                data-testid="workbench-brief-reply"
                rows="3"
                value=${body}
                onInput=${(event) => setBody(event.currentTarget.value)}
              ></textarea>
              <div className="wb13-brief-replyactions">
                ${isSlack
                  ? html`${item.replyHref
                        ? html`<a
                            className="wb13-button is-primary is-sm"
                            data-testid="workbench-brief-replyslack"
                            href=${item.replyHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Opens the Slack thread. Nothing is posted."
                          >
                            Reply in Slack
                          </a>`
                        : null}
                      <button
                        type="button"
                        className="wb13-button is-sm"
                        data-testid="workbench-brief-copyreply"
                        title="Copies the suggested reply. Nothing is posted."
                        onClick=${() => copyReplyToClipboard(body)}
                      >
                        Copy reply
                      </button>`
                  : typeof onDraftReply === 'function'
                    ? html`<button
                        type="button"
                        className="wb13-button is-primary is-sm"
                        data-testid="workbench-brief-savedraft"
                        title="Opens a reviewable Gmail draft. Nothing is sent."
                        onClick=${() => onDraftReply({ item, body })}
                      >
                        Save as draft
                      </button>`
                    : null}
                ${item.bestWindow
                  ? html`<span className="wb13-brief-rowmeta">Best: ${item.bestWindow}</span>`
                  : null}
              </div>`
          : null}
      </div>
      ${item.replyHref && !isSlack
        ? html`<a
            className="wb13-brief-rowlink"
            href=${item.replyHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open to reply"
            title="Open to reply"
          >
            <${Icon} name="external" />
          </a>`
        : null}
    </div>
  `;
}

function WeighInRow({ item }) {
  const meta = [item.channel ? `#${item.channel}` : '', 'you weren’t tagged']
    .filter(Boolean)
    .join(' · ');
  const inner = html`
    <span className="wb13-brief-rowtitle">${item.title}</span>
    ${meta ? html`<span className="wb13-brief-rowmeta">${meta}</span>` : null}
    ${item.whyYours
      ? html`<span className="wb13-brief-rowmeta">Why yours: ${item.whyYours}</span>`
      : null}
    ${item.myTake
      ? html`<span className="wb13-brief-rowmeta">Take (pressure-test): ${item.myTake}</span>`
      : null}
    ${Number.isFinite(item.confidence)
      ? html`<span className="wb13-brief-rowmeta">confidence ${item.confidence}%</span>`
      : null}
  `;
  if (item.link) {
    return html`<a
      className="wb13-brief-row wb13-brief-row-static"
      data-testid="workbench-brief-weighin"
      href=${item.link}
      target="_blank"
      rel="noopener noreferrer"
      >${inner}<span className="wb13-brief-rowlink"><${Icon} name="external" /></span
    ></a>`;
  }
  return html`<div
    className="wb13-brief-row wb13-brief-row-static"
    data-testid="workbench-brief-weighin"
  >
    ${inner}
  </div>`;
}

function WeekRow({ item }) {
  return html`<div
    className="wb13-brief-row wb13-brief-row-static"
    data-testid="workbench-brief-week"
  >
    <span className="wb13-brief-rowtitle">
      ${item.priority === 'high'
        ? html`<span className="wb13-brief-prio" aria-hidden="true"></span>`
        : null}
      ${item.title}
    </span>
    ${item.yourMove
      ? html`<span className="wb13-brief-rowmeta">Your move: ${item.yourMove}</span>`
      : null}
  </div>`;
}

function BestTimeRow({ item }) {
  const meta = [item.person, item.window].filter(Boolean).join(' — ');
  return html`<div
    className="wb13-brief-row wb13-brief-row-static"
    data-testid="workbench-brief-besttime"
  >
    <span className="wb13-brief-rowtitle">${meta}</span>
  </div>`;
}

function BriefSection({ icon, title, count, testid, children }) {
  return html`
    <div className="wb13-brief-section" data-testid=${testid}>
      <div className="wb13-brief-sectiontitle">
        <${Icon} name=${icon} />
        <span>${title}</span>
        ${count ? html`<span className="wb13-brief-sectioncount">${count}</span>` : null}
      </div>
      ${children}
    </div>
  `;
}

// The rich briefing. `briefing` = { summary, needsYou, worthWeighingIn, thisWeek,
// bestTimes } from synthesizeBriefing. onDraftReply({item, body}) opens the gated
// draft modal. Renders only the sections that have content (honest empty).
export function WorkbenchBrief({ briefing, onDraftReply, onDismiss }) {
  if (!briefing || typeof briefing !== 'object') return null;
  const needsYou = Array.isArray(briefing.needsYou) ? briefing.needsYou : [];
  const weighIn = Array.isArray(briefing.worthWeighingIn) ? briefing.worthWeighingIn : [];
  const thisWeek = Array.isArray(briefing.thisWeek) ? briefing.thisWeek : [];
  const bestTimes = Array.isArray(briefing.bestTimes) ? briefing.bestTimes : [];

  return html`
    <section
      className="wb13-brief wb13-brief-rich"
      data-testid="workbench-brief"
      aria-label="Daily briefing"
    >
      <div className="wb13-brief-head">
        <div className="wb13-brief-icon"><${Icon} name="spark" /></div>
        <div className="wb13-brief-headline">
          <div className="wb13-brief-eyebrow">Daily briefing · updated just now</div>
          <h2>${briefSummaryLine(briefing.summary)}</h2>
          ${briefing.intro
            ? html`<div className="wb13-brief-intro wb13-brief-rowmeta">${briefing.intro}</div>`
            : null}
        </div>
        ${typeof onDismiss === 'function'
          ? html`<button
              type="button"
              className="wb13-brief-dismiss"
              aria-label="Dismiss briefing"
              onClick=${onDismiss}
            >
              <${Icon} name="close" />
            </button>`
          : null}
      </div>

      <div className="wb13-brief-grid">
        ${needsYou.length
          ? html`<${BriefSection}
              icon="mail"
              title="Needs you"
              count=${needsYou.length}
              testid="workbench-brief-needsyou"
            >
              ${needsYou.map(
                (item, i) =>
                  html`<${NeedsYouCard}
                    key=${item.id || i}
                    item=${item}
                    onDraftReply=${onDraftReply}
                  />`
              )}
            <//>`
          : null}
        ${weighIn.length
          ? html`<${BriefSection}
              icon="spark"
              title="Worth weighing in"
              count=${weighIn.length}
              testid="workbench-brief-weighin-section"
            >
              ${weighIn.map((item, i) => html`<${WeighInRow} key=${item.id || i} item=${item} />`)}
            <//>`
          : null}
        ${thisWeek.length
          ? html`<${BriefSection}
              icon="calendar"
              title="This week"
              count=${thisWeek.length}
              testid="workbench-brief-week-section"
            >
              ${thisWeek.map((item, i) => html`<${WeekRow} key=${item.id || i} item=${item} />`)}
            <//>`
          : null}
        ${bestTimes.length
          ? html`<${BriefSection}
              icon="clock"
              title="Best times"
              testid="workbench-brief-besttimes-section"
            >
              ${bestTimes.map((item, i) => html`<${BestTimeRow} key=${i} item=${item} />`)}
            <//>`
          : null}
      </div>

      <div className="wb13-brief-foot">
        <${Icon} name="shield" />
        <span>Synthesized from your connected tools. Reads stay private — nothing was sent.</span>
      </div>
    </section>
  `;
}
