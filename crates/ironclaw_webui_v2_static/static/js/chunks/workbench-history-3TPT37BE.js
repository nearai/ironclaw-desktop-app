import{b as l,c as u,e as m}from"./chunk-XFPBPG4V.js";import"./chunk-UB2NMU7V.js";import{a as d}from"./chunk-4INX7S4N.js";import{c as a}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";function w(s){let t=Date.parse(s||"");if(!Number.isFinite(t))return"";let n=Date.now()-t,e=Math.floor(n/6e4);if(e<1)return"just now";if(e<60)return`${e}m ago`;let r=Math.floor(e/60);if(r<24)return`${r}h ago`;let o=Math.floor(r/24);if(o<7)return`${o}d ago`;try{return new Date(t).toLocaleDateString()}catch{return""}}function b(s){let t=Number(s.turn_count||0);return[t?`${t} turn${t===1?"":"s"}`:null,w(s.updated_at)].filter(Boolean).join(" \xB7 ")}function p({onReopen:s}){let{threads:t,isLoading:n,isError:e,refetch:r}=l(),o=Array.isArray(t)?t:[],c=u();return a`
    <main className="wb13-main">
      <div className="wb13-page">
        <div className="wb13-wrap">
          <div className="wb13-head"><h1>Conversations</h1></div>
          ${e?a`<div className="wb13-allclear" data-testid="workbench-history-error">
                Couldn't load your conversations.
                <button type="button" className="wb13-button is-sm" onClick=${()=>r()}>
                  Retry
                </button>
              </div>`:n?a`<div className="wb13-allclear">Loading your conversations…</div>`:o.length?a`<div className="wb13-section wb13-list" data-testid="workbench-history-list">
                    ${o.map(i=>a`<button
                          key=${i.id}
                          type="button"
                          className="wb13-card wb13-card-readable"
                          data-testid="workbench-history-row"
                          onClick=${()=>typeof s=="function"&&s(i)}
                        >
                          <div className="wb13-card-main">
                            <div className="wb13-card-title">
                              ${m(i,c)}
                            </div>
                            ${b(i)?a`<div className="wb13-card-copy">${b(i)}</div>`:null}
                          </div>
                          <span className="wb13-button is-sm"><${d} name="pulse" /> Open</span>
                        </button>`)}
                  </div>`:a`<div className="wb13-allclear" data-testid="workbench-history-empty">
                    No conversations yet. Anything you Ask in the Workbench shows up here.
                  </div>`}
        </div>
      </div>
    </main>
  `}export{p as HistoryView};
