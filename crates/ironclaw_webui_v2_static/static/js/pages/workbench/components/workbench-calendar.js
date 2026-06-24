import { html } from '../../../lib/html.js';
import { buildWeekColumns } from '../lib/workbench-connectors.js';

// Direction B Calendar — a readable AGENDA, not a cramped 24h time-grid.
// Events are grouped by day (from the same connector read that feeds the rail's
// Upcoming group); each day is a header + a list of time · title · Join rows. No
// overlapping blocks, no truncation. Styled on the wb13 (Direction B) tokens
// (light-first, system font). Read-only; today onward.
const CALENDAR_STYLE = `
.wb13-agenda { margin-top: 8px; display: flex; flex-direction: column; gap: 22px; }
.wb13-agenda-day { display: grid; grid-template-columns: 132px minmax(0, 1fr); gap: 18px; align-items: start; }
.wb13-agenda-dayhead { position: sticky; top: 0; display: flex; align-items: baseline; gap: 8px; padding-top: 2px; }
.wb13-agenda-dayhead .dn { font-size: 22px; font-weight: 700; line-height: 1; color: var(--wb-ink); }
.wb13-agenda-dayhead .wd { font-size: 12.5px; font-weight: 600; color: var(--wb-muted); }
.wb13-agenda-dayhead.is-today .dn, .wb13-agenda-dayhead.is-today .wd { color: var(--wb-accent); }
.wb13-agenda-events { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.wb13-agenda-ev {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-lg);
  background: var(--wb-canvas);
  color: inherit;
  text-decoration: none;
}
.wb13-agenda-ev:hover { border-color: var(--wb-accent); }
.wb13-agenda-ev .time { font-size: 12.5px; font-weight: 600; color: var(--wb-muted); white-space: nowrap; }
.wb13-agenda-ev.is-allday .time { color: var(--wb-faint); }
.wb13-agenda-ev .title { font-size: 14px; color: var(--wb-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb13-agenda-ev .join {
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase;
  color: var(--wb-accent); border: 1px solid var(--wb-accent-tint); background: var(--wb-accent-soft);
  border-radius: 6px; padding: 2px 7px; white-space: nowrap;
}
.wb13-agenda-empty { margin-top: 10px; color: var(--wb-faint); font-size: 13px; }
`;

function dayLabel(dateKey) {
  const parts = String(dateKey || '')
    .split('-')
    .map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return '';
  try {
    return new Date(parts[0], parts[1], parts[2]).toLocaleDateString(undefined, { month: 'short' });
  } catch (_) {
    return '';
  }
}

export function CalendarView({
  events = [],
  calendarReady = false,
  calendarError = false,
  onConnect
}) {
  const columns = buildWeekColumns(events).filter((col) => col.allDay.length || col.timed.length);

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
  } else if (!columns.length) {
    body = html`<div className="wb13-agenda-empty">Nothing scheduled in the week ahead.</div>`;
  } else {
    body = html`<div className="wb13-agenda">
      ${columns.map((col) => {
        const month = dayLabel(col.dateKey);
        const events = [...col.allDay, ...col.timed];
        return html`<section key=${col.dateKey} className="wb13-agenda-day">
          <div
            className=${['wb13-agenda-dayhead', col.isToday && 'is-today']
              .filter(Boolean)
              .join(' ')}
          >
            <span className="dn">${col.dayNum}</span>
            <span className="wd"
              >${col.weekday}${month ? ` ${month}` : ''}${col.isToday ? ' · Today' : ''}</span
            >
          </div>
          <div className="wb13-agenda-events">
            ${events.map((ev) => {
              const href = ev.joinUrl || ev.link;
              const inner = html`<span className="time">${ev.timeLabel}</span>
                <span className="title">${ev.title || '(untitled event)'}</span>
                ${ev.joinUrl ? html`<span className="join">Join</span>` : html`<span></span>`}`;
              const cls = ['wb13-agenda-ev', ev.allDay && 'is-allday'].filter(Boolean).join(' ');
              return href
                ? html`<a
                    key=${ev.id}
                    className=${cls}
                    href=${href}
                    target="_blank"
                    rel="noreferrer noopener"
                    title=${ev.joinUrl ? `Join: ${ev.title || ''}` : ev.title || ''}
                    >${inner}</a
                  >`
                : html`<div key=${ev.id} className=${cls} title=${ev.title || ''}>${inner}</div>`;
            })}
          </div>
        </section>`;
      })}
    </div>`;
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
