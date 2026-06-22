import{j as g,k as h,l as u}from"./chunk-G3654ODO.js";import{j as e}from"./chunk-NLGAQ5GP.js";var d=44,C=`
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
.wb13-tcal-col { position: relative; border-right: 1px solid var(--v2-panel-border); background-image: repeating-linear-gradient(to bottom, color-mix(in srgb, var(--v2-panel-border) 55%, transparent) 0, color-mix(in srgb, var(--v2-panel-border) 55%, transparent) 1px, transparent 1px, transparent ${d}px); }
.wb13-tcal-col:last-child { border-right: 0; }
.wb13-tcal-col.is-weekend { background-color: color-mix(in srgb, var(--v2-panel-border) 14%, transparent); }
.wb13-tcal-ev { position: absolute; box-sizing: border-box; border-radius: 6px; border-left: 3px solid var(--v2-accent); background: color-mix(in srgb, var(--v2-accent) 16%, var(--v2-surface, #0b1220)); padding: 2px 5px; overflow: hidden; text-decoration: none; color: inherit; }
.wb13-tcal-ev:hover { background: color-mix(in srgb, var(--v2-accent) 26%, var(--v2-surface, #0b1220)); z-index: 5; }
.wb13-tcal-ev .t { font: 600 10px/1.2 var(--v2-font, inherit); color: var(--v2-accent-text); }
.wb13-tcal-ev .ti { font-size: 11.5px; line-height: 1.25; color: var(--v2-text-strong); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.wb13-tcal-ev .jn { font: 700 8.5px/1 var(--v2-font, inherit); letter-spacing: 0.04em; text-transform: uppercase; color: var(--v2-accent-text); border: 1px solid color-mix(in srgb, var(--v2-accent) 45%, transparent); border-radius: 4px; padding: 1px 3px; vertical-align: 1px; }
.wb13-tcal-now { position: absolute; left: 0; right: 0; height: 2px; background: var(--v2-accent); z-index: 6; }
.wb13-tcal-now::before { content: ''; position: absolute; left: -3px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--v2-accent); }
`;function D(){let n=new Date;return n.getHours()*60+n.getMinutes()}function P({events:n=[],calendarReady:f=!1,calendarError:$=!1,onConnect:c}){let l=g(n),i=h(l),p=i.endMin-i.startMin||1,y=p/60*d,b=[];for(let a=i.startMin;a<=i.endMin;a+=60)b.push(a/60);let N=a=>`${(a+11)%12+1}${a<12||a===24?"a":"p"}`,k=l.some(a=>a.allDay.length),M=l.some(a=>a.allDay.length||a.timed.length),s=D(),v=s>=i.startMin&&s<=i.endMin?(s-i.startMin)/p*100:null,o;return f?$?o=e`<section className="wb13-group">
      <div className="wb13-read">
        <p>Couldn't read your calendar right now. Try again in a moment.</p>
      </div>
    </section>`:o=e`
      <div className="wb13-tcal">
        <div className="wb13-tcal-inner">
          <div className="wb13-tcal-row wb13-tcal-head">
            <div className="wb13-tcal-axiscell"></div>
            ${l.map(a=>e`<div
                  key=${a.dateKey}
                  className=${["wb13-tcal-cell",a.isToday&&"is-today"].filter(Boolean).join(" ")}
                >
                  <span className="wd">${a.weekday}</span
                  ><span className="dn">${a.dayNum}</span>
                </div>`)}
          </div>
          ${k?e`<div className="wb13-tcal-row wb13-tcal-allday">
                <div className="axislabel">all-day</div>
                ${l.map(a=>e`<div key=${a.dateKey} className="wb13-tcal-cell">
                      ${a.allDay.map(r=>e`<div key=${r.id} className="wb13-tcal-chip" title=${r.title||""}>
                            ${r.title||"(untitled event)"}
                          </div>`)}
                    </div>`)}
              </div>`:null}
          <div className="wb13-tcal-row" style=${{height:`${y}px`}}>
            <div className="wb13-tcal-axis">
              ${b.map((a,r)=>e`<div key=${a} className="wb13-tcal-hr" style=${{height:`${d}px`}}>
                    ${r===0?"":N(a%24)}
                  </div>`)}
            </div>
            ${l.map(a=>{let r=u(a.timed,i.startMin,i.endMin);return e`<div
                key=${a.dateKey}
                className=${["wb13-tcal-col",a.isWeekend&&"is-weekend"].filter(Boolean).join(" ")}
              >
                ${a.isToday&&v!=null?e`<div className="wb13-tcal-now" style=${{top:`${v}%`}}></div>`:null}
                ${r.map(t=>{let w={top:`${t.topPct}%`,height:`${t.heightPct}%`,left:`calc(${t.leftPct}% + 2px)`,width:`calc(${t.widthPct}% - 4px)`},x=t.joinUrl||t.link,m=e`<div className="t">
                      ${t.timeLabel}${t.joinUrl?e` <span className="jn">Join</span>`:""}
                    </div>
                    <div className="ti">${t.title||"(untitled event)"}</div>`;return x?e`<a
                        key=${t.id}
                        className="wb13-tcal-ev"
                        style=${w}
                        href=${x}
                        target="_blank"
                        rel="noreferrer noopener"
                        title=${t.joinUrl?`Join: ${t.title||""}`:t.title||""}
                        >${m}</a
                      >`:e`<div
                        key=${t.id}
                        className="wb13-tcal-ev"
                        style=${w}
                        title=${t.title||""}
                      >
                        ${m}
                      </div>`})}
              </div>`})}
          </div>
        </div>
      </div>
      ${M?null:e`<div className="wb13-inspector-note">Nothing scheduled in the week ahead.</div>`}
    `:o=e`<section className="wb13-group">
      <div className="wb13-read">
        <p>Connect Google Calendar to see your week here.</p>
        ${c?e`<button type="button" className="wb13-button is-primary" onClick=${c}>
              Connect Calendar
            </button>`:null}
      </div>
    </section>`,e`
    <main className="wb13-main" data-testid="workbench-calendar">
      <style>
        ${C}
      </style>
      <div className="wb13-page">
        <div className="wb13-wrap">
          <div className="wb13-head">
            <h1>Your week</h1>
            <span className="meta">Live from Google Calendar</span>
          </div>
          ${o}
        </div>
      </div>
    </main>
  `}export{P as CalendarView};
