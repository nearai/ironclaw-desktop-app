import { html } from '../../../lib/html.js';
import { buildWeekColumns } from '../lib/workbench-connectors.js';

// Scoped styles for the week grid. Uses the app-wide --v2-* tokens (blue #1c63d6
// accent, dark surfaces) + Newsreader for the day number, so it stays faithful to
// the v13 shell. On narrow screens the 7 columns become a horizontal snap-scroll
// so it still works at 375px.
const CALENDAR_STYLE = `
.wb13-cal-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; margin-top: 4px; }
.wb13-cal-col { display: flex; flex-direction: column; border: 1px solid var(--v2-panel-border); border-radius: 12px; background: var(--v2-surface, transparent); min-height: 200px; overflow: hidden; }
.wb13-cal-col.is-weekend { background: color-mix(in srgb, var(--v2-panel-border) 18%, transparent); }
.wb13-cal-col.is-today { border-color: color-mix(in srgb, var(--v2-accent) 60%, var(--v2-panel-border)); box-shadow: inset 0 2px 0 0 var(--v2-accent); }
.wb13-cal-colhead { display: flex; align-items: baseline; gap: 6px; padding: 9px 10px; border-bottom: 1px solid var(--v2-panel-border); }
.wb13-cal-colhead .wd { font: 600 11px/1 var(--v2-font, inherit); letter-spacing: 0.05em; text-transform: uppercase; color: var(--v2-text-muted); }
.wb13-cal-colhead .dn { font-family: "Newsreader", Georgia, serif; font-size: 19px; line-height: 1; color: var(--v2-text-strong); }
.wb13-cal-col.is-today .wb13-cal-colhead .wd, .wb13-cal-col.is-today .wb13-cal-colhead .dn { color: var(--v2-accent-text); }
.wb13-cal-stack { display: flex; flex-direction: column; gap: 5px; padding: 7px; flex: 1; }
.wb13-cal-chip { font-size: 11.5px; line-height: 1.25; color: var(--v2-text); background: color-mix(in srgb, var(--v2-text-muted) 14%, transparent); border-radius: 6px; padding: 4px 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb13-cal-event { display: block; text-decoration: none; border-left: 3px solid var(--v2-accent); background: color-mix(in srgb, var(--v2-accent) 9%, transparent); border-radius: 0 7px 7px 0; padding: 5px 8px; color: inherit; }
.wb13-cal-event:hover { background: color-mix(in srgb, var(--v2-accent) 18%, transparent); }
.wb13-cal-event .t { font: 600 11px/1.2 var(--v2-font, inherit); color: var(--v2-accent-text); }
.wb13-cal-event .ti { font-size: 12.5px; line-height: 1.3; color: var(--v2-text-strong); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.wb13-cal-none { color: var(--v2-text-faint); font-size: 12px; padding: 2px; }
@media (max-width: 900px) {
  .wb13-cal-week { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 72%; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; padding-bottom: 6px; }
  .wb13-cal-col { scroll-snap-align: start; }
}
`;

function EventBlock({ ev }) {
  const inner = html`
    <div className="t">${ev.timeLabel}</div>
    <div className="ti">${ev.title || '(untitled event)'}</div>
  `;
  return ev.link
    ? html`<a
        className="wb13-cal-event"
        href=${ev.link}
        target="_blank"
        rel="noreferrer noopener"
        title=${ev.title || ''}
        >${inner}</a
      >`
    : html`<div className="wb13-cal-event" title=${ev.title || ''}>${inner}</div>`;
}

// The Calendar (week grid) view — your live Google Calendar laid out as a rolling
// 7-day week, today first. Read-only; events come from the same connector read
// that feeds the rail's "Upcoming" group. Today-onward (past days are never shown).
export function CalendarView({
  events = [],
  calendarReady = false,
  calendarError = false,
  onConnect
}) {
  const columns = buildWeekColumns(events);
  const hasEvents = columns.some((c) => c.allDay.length || c.timed.length);

  let body;
  if (!calendarReady) {
    body = html`<section className="wb13-group">
      <div className="wb13-read">
        <p>Connect Google Calendar to see your week here.</p>
        ${onConnect
          ? html`<button type="button" className="wb13-button is-primary" onClick=${onConnect}>
              Connect Calendar
            </button>`
          : null}
      </div>
    </section>`;
  } else if (calendarError) {
    body = html`<section className="wb13-group">
      <div className="wb13-read">
        <p>Couldn't read your calendar right now. Try again in a moment.</p>
      </div>
    </section>`;
  } else {
    body = html`
      <div className="wb13-cal-week" role="list" aria-label="This week">
        ${columns.map(
          (col) => html`
            <div
              key=${col.dateKey}
              role="listitem"
              className=${['wb13-cal-col', col.isToday && 'is-today', col.isWeekend && 'is-weekend']
                .filter(Boolean)
                .join(' ')}
            >
              <div className="wb13-cal-colhead">
                <span className="wd">${col.weekday}</span>
                <span className="dn">${col.dayNum}</span>
              </div>
              <div className="wb13-cal-stack">
                ${col.allDay.map(
                  (ev) =>
                    html`<div key=${ev.id} className="wb13-cal-chip" title=${ev.title || ''}>
                      ${ev.title || '(untitled event)'}
                    </div>`
                )}
                ${col.timed.map((ev) => html`<${EventBlock} key=${ev.id} ev=${ev} />`)}
                ${!col.allDay.length && !col.timed.length
                  ? html`<div className="wb13-cal-none">—</div>`
                  : null}
              </div>
            </div>
          `
        )}
      </div>
      ${!hasEvents
        ? html`<div className="wb13-inspector-note">Nothing scheduled in the week ahead.</div>`
        : null}
    `;
  }

  return html`
    <main className="wb13-main" data-testid="workbench-calendar">
      <style>
        ${CALENDAR_STYLE}
      </style>
      <div className="wb13-page">
        <div className="wb13-wrap">
          <div className="wb13-head">
            <h1>Your week</h1>
            <span className="meta">Live from Google Calendar</span>
          </div>
          ${body}
        </div>
      </div>
    </main>
  `;
}
