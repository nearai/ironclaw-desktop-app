import{l as w}from"./chunk-W4RVULSV.js";import{c as a}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";var g=`
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
`;function y(d){let t=String(d||"").split("-").map(Number);if(t.length<3||t.some(s=>Number.isNaN(s)))return"";try{return new Date(t[0],t[1],t[2]).toLocaleDateString(void 0,{month:"short"})}catch{return""}}function u({events:d=[],calendarReady:t=!1,calendarError:s=!1,onConnect:o}){let r=w(d).filter(n=>n.allDay.length||n.timed.length),i;return t?s?i=a`<section className="wb13-group">
      <div className="wb13-read">
        <p>Couldn't read your calendar right now. Try again in a moment.</p>
      </div>
    </section>`:r.length?i=a`<div className="wb13-agenda">
      ${r.map(n=>{let l=y(n.dateKey),b=[...n.allDay,...n.timed];return a`<section key=${n.dateKey} className="wb13-agenda-day">
          <div
            className=${["wb13-agenda-dayhead",n.isToday&&"is-today"].filter(Boolean).join(" ")}
          >
            <span className="dn">${n.dayNum}</span>
            <span className="wd"
              >${n.weekday}${l?` ${l}`:""}${n.isToday?" \xB7 Today":""}</span
            >
          </div>
          <div className="wb13-agenda-events">
            ${b.map(e=>{let p=e.joinUrl||e.link,c=a`<span className="time">${e.timeLabel}</span>
                <span className="title">${e.title||"(untitled event)"}</span>
                ${e.joinUrl?a`<span className="join">Join</span>`:a`<span></span>`}`,m=["wb13-agenda-ev",e.allDay&&"is-allday"].filter(Boolean).join(" ");return p?a`<a
                    key=${e.id}
                    className=${m}
                    href=${p}
                    target="_blank"
                    rel="noreferrer noopener"
                    title=${e.joinUrl?`Join: ${e.title||""}`:e.title||""}
                    >${c}</a
                  >`:a`<div key=${e.id} className=${m} title=${e.title||""}>${c}</div>`})}
          </div>
        </section>`})}
    </div>`:i=a`<div className="wb13-agenda-empty">Nothing scheduled in the week ahead.</div>`:i=a`<section className="wb13-group">
      <div className="wb13-read">
        <p>Connect Google Calendar to see your week here.</p>
        ${o?a`<button type="button" className="wb13-button is-primary" onClick=${o}>
              Connect Calendar
            </button>`:null}
      </div>
    </section>`,a`
    <main className="wb13-main" data-testid="workbench-calendar">
      <style>
        ${g}
      </style>
      <div className="wb13-page">
        <div className="wb13-wrap">
          <div className="wb13-head">
            <h1>Your week</h1>
            <span className="meta">Live from Google Calendar</span>
          </div>
          ${i}
        </div>
      </div>
    </main>
  `}export{u as CalendarView};
