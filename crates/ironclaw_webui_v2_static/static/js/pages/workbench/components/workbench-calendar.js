import { html } from '../../../lib/html.js';
import { buildWeekColumns, weekTimeWindow, layoutDayColumn } from '../lib/workbench-connectors.js';

// Pixels per hour for the time ruler; the column height is hours × this.
const HOUR_PX = 44;

// Scoped styles for the time-ruler week grid. Uses the app-wide --v2-* tokens
// (blue #1c63d6 accent, dark surfaces) + Newsreader for the day number, so it
// stays faithful to the v13 shell. The whole grid is one horizontally-scrollable
// block with a min-width, so it degrades to a swipeable week at 375px.
const CALENDAR_STYLE = `
.wb13-tcal { margin-top: 4px; overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--v2-panel-border); border-radius: 14px; }
.wb13-tcal-inner { min-width: 720px; }
.wb13-tcal-row { display: grid; grid-template-columns: 52px repeat(7, minmax(0, 1fr)); }
.wb13-tcal-head .wb13-tcal-cell { padding: 9px 8px; border-bottom: 1px solid var(--v2-panel-border); display: flex; align-items: baseline; gap: 6px; }
.wb13-tcal-head .wb13-tcal-cell.is-today { background: color-mix(in srgb, var(--v2-accent) 12%, transparent); }
.wb13-tcal-head .wd { font: 600 11px/1 var(--v2-font, inherit); letter-spacing: 0.05em; text-transform: uppercase; color: var(--v2-text-muted); }
.wb13-tcal-head .dn { font-family: "Newsreader", Georgia, serif; font-size: 18px; line-height: 1; color: var(--v2-text-strong); }
.wb13-tcal-head .is-today .wd, .wb13-tcal-head .is-today .dn { color: var(--v2-accent-text); }
.wb13-tcal-axiscell { border-bottom: 1px solid var(--v2-panel-border); }
.wb13-tcal-allday .wb13-tcal-cell { padding: 5px 6px; border-bottom: 1px solid var(--v2-panel-border); display: flex; flex-direction: column; gap: 3px; min-height: 20px; }
.wb13-tcal-allday .axislabel { font: 600 9px/1.3 var(--v2-font, inherit); letter-spacing: 0.04em; text-transform: uppercase; color: var(--v2-text-faint); padding: 6px 4px; text-align: right; border-bottom: 1px solid var(--v2-panel-border); }
.wb13-tcal-chip { font-size: 11px; line-height: 1.2; color: var(--v2-text); background: color-mix(in srgb, var(--v2-text-muted) 16%, transparent); border-radius: 5px; padding: 3px 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb13-tcal-axis { border-right: 1px solid var(--v2-panel-border); }
.wb13-tcal-hr { font: 500 10px/1 var(--v2-font, inherit); color: var(--v2-text-faint); text-align: right; padding: 0 6px; box-sizing: border-box; transform: translateY(-5px); }
.wb13-tcal-col { position: relative; border-right: 1px solid var(--v2-panel-border); background-image: repeating-linear-gradient(to bottom, color-mix(in srgb, var(--v2-panel-border) 55%, transparent) 0, color-mix(in srgb, var(--v2-panel-border) 55%, transparent) 1px, transparent 1px, transparent ${HOUR_PX}px); }
.wb13-tcal-col:last-child { border-right: 0; }
.wb13-tcal-col.is-weekend { background-color: color-mix(in srgb, var(--v2-panel-border) 14%, transparent); }
.wb13-tcal-ev { position: absolute; box-sizing: border-box; border-radius: 6px; border-left: 3px solid var(--v2-accent); background: color-mix(in srgb, var(--v2-accent) 16%, var(--v2-surface, #0b1220)); padding: 2px 5px; overflow: hidden; text-decoration: none; color: inherit; }
.wb13-tcal-ev:hover { background: color-mix(in srgb, var(--v2-accent) 26%, var(--v2-surface, #0b1220)); z-index: 5; }
.wb13-tcal-ev .t { font: 600 10px/1.2 var(--v2-font, inherit); color: var(--v2-accent-text); }
.wb13-tcal-ev .ti { font-size: 11.5px; line-height: 1.25; color: var(--v2-text-strong); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.wb13-tcal-ev .jn { font: 700 8.5px/1 var(--v2-font, inherit); letter-spacing: 0.04em; text-transform: uppercase; color: var(--v2-accent-text); border: 1px solid color-mix(in srgb, var(--v2-accent) 45%, transparent); border-radius: 4px; padding: 1px 3px; vertical-align: 1px; }
.wb13-tcal-now { position: absolute; left: 0; right: 0; height: 2px; background: var(--v2-accent); z-index: 6; }
.wb13-tcal-now::before { content: ''; position: absolute; left: -3px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--v2-accent); }
`;

function nowMinutesOfDay() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// The Calendar (time-ruler week) view — your live Google Calendar as a real week
// grid: a left hour axis, 7 day columns with proportionally-tall event blocks,
// overlaps split into side-by-side lanes, all-day events in a band on top, and a
// "now" line on today. Read-only; today-onward. Events come from the same connector
// read that feeds the rail's "Upcoming" group.
export function CalendarView({
  events = [],
  calendarReady = false,
  calendarError = false,
  onConnect
}) {
  const columns = buildWeekColumns(events);
  const win = weekTimeWindow(columns);
  const span = win.endMin - win.startMin || 1;
  const gridHeight = (span / 60) * HOUR_PX;
  const hours = [];
  for (let m = win.startMin; m <= win.endMin; m += 60) hours.push(m / 60);
  const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 || h === 24 ? 'a' : 'p'}`;
  const hasAllDay = columns.some((c) => c.allDay.length);
  const hasEvents = columns.some((c) => c.allDay.length || c.timed.length);
  const nowMin = nowMinutesOfDay();
  const nowTopPct =
    nowMin >= win.startMin && nowMin <= win.endMin ? ((nowMin - win.startMin) / span) * 100 : null;

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
      <div className="wb13-tcal">
        <div className="wb13-tcal-inner">
          <div className="wb13-tcal-row wb13-tcal-head">
            <div className="wb13-tcal-axiscell"></div>
            ${columns.map(
              (col) =>
                html`<div
                  key=${col.dateKey}
                  className=${['wb13-tcal-cell', col.isToday && 'is-today']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="wd">${col.weekday}</span
                  ><span className="dn">${col.dayNum}</span>
                </div>`
            )}
          </div>
          ${hasAllDay
            ? html`<div className="wb13-tcal-row wb13-tcal-allday">
                <div className="axislabel">all-day</div>
                ${columns.map(
                  (col) =>
                    html`<div key=${col.dateKey} className="wb13-tcal-cell">
                      ${col.allDay.map(
                        (ev) =>
                          html`<div key=${ev.id} className="wb13-tcal-chip" title=${ev.title || ''}>
                            ${ev.title || '(untitled event)'}
                          </div>`
                      )}
                    </div>`
                )}
              </div>`
            : null}
          <div className="wb13-tcal-row" style=${{ height: `${gridHeight}px` }}>
            <div className="wb13-tcal-axis">
              ${hours.map(
                (h, i) =>
                  html`<div key=${h} className="wb13-tcal-hr" style=${{ height: `${HOUR_PX}px` }}>
                    ${i === 0 ? '' : hourLabel(h % 24)}
                  </div>`
              )}
            </div>
            ${columns.map((col) => {
              const laid = layoutDayColumn(col.timed, win.startMin, win.endMin);
              return html`<div
                key=${col.dateKey}
                className=${['wb13-tcal-col', col.isWeekend && 'is-weekend']
                  .filter(Boolean)
                  .join(' ')}
              >
                ${col.isToday && nowTopPct != null
                  ? html`<div className="wb13-tcal-now" style=${{ top: `${nowTopPct}%` }}></div>`
                  : null}
                ${laid.map((ev) => {
                  const style = {
                    top: `${ev.topPct}%`,
                    height: `${ev.heightPct}%`,
                    left: `calc(${ev.leftPct}% + 2px)`,
                    width: `calc(${ev.widthPct}% - 4px)`
                  };
                  // A joinable meeting links to its video call (the dominant
                  // action); otherwise to the event page. Single anchor, with an
                  // inline "Join" cue so the block reads as joinable.
                  const href = ev.joinUrl || ev.link;
                  const inner = html`<div className="t">
                      ${ev.timeLabel}${ev.joinUrl ? html` <span className="jn">Join</span>` : ''}
                    </div>
                    <div className="ti">${ev.title || '(untitled event)'}</div>`;
                  return href
                    ? html`<a
                        key=${ev.id}
                        className="wb13-tcal-ev"
                        style=${style}
                        href=${href}
                        target="_blank"
                        rel="noreferrer noopener"
                        title=${ev.joinUrl ? `Join: ${ev.title || ''}` : ev.title || ''}
                        >${inner}</a
                      >`
                    : html`<div
                        key=${ev.id}
                        className="wb13-tcal-ev"
                        style=${style}
                        title=${ev.title || ''}
                      >
                        ${inner}
                      </div>`;
                })}
              </div>`;
            })}
          </div>
        </div>
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
