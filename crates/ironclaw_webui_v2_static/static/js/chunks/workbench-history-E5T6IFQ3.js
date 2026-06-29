import{b as c}from"./chunk-YUBNAG3S.js";import"./chunk-UB2NMU7V.js";import{a as l}from"./chunk-4INX7S4N.js";import{c as a}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";function u(n){let t=Date.parse(n||"");if(!Number.isFinite(t))return"";let i=Date.now()-t,o=Math.floor(i/6e4);if(o<1)return"just now";if(o<60)return`${o}m ago`;let e=Math.floor(o/60);if(e<24)return`${e}h ago`;let r=Math.floor(e/24);if(r<7)return`${r}d ago`;try{return new Date(t).toLocaleDateString()}catch{return""}}function d(n){let t=Number(n.turn_count||0);return[t?`${t} turn${t===1?"":"s"}`:null,u(n.updated_at)].filter(Boolean).join(" \xB7 ")}function h({onReopen:n}){let{threads:t,isLoading:i,isError:o,refetch:e}=c(),r=Array.isArray(t)?t:[];return a`
    <main className="wb13-main">
      <div className="wb13-page">
        <div className="wb13-wrap">
          <div className="wb13-head"><h1>Conversations</h1></div>
          ${o?a`<div className="wb13-allclear" data-testid="workbench-history-error">
                Couldn't load your conversations.
                <button type="button" className="wb13-button is-sm" onClick=${()=>e()}>
                  Retry
                </button>
              </div>`:i?a`<div className="wb13-allclear">Loading your conversations…</div>`:r.length?a`<div className="wb13-section wb13-list" data-testid="workbench-history-list">
                    ${r.map(s=>a`<button
                          key=${s.id}
                          type="button"
                          className="wb13-card wb13-card-readable"
                          data-testid="workbench-history-row"
                          onClick=${()=>typeof n=="function"&&n(s)}
                        >
                          <div className="wb13-card-main">
                            <div className="wb13-card-title">
                              ${s.title||"Untitled conversation"}
                            </div>
                            ${d(s)?a`<div className="wb13-card-copy">${d(s)}</div>`:null}
                          </div>
                          <span className="wb13-button is-sm"><${l} name="pulse" /> Open</span>
                        </button>`)}
                  </div>`:a`<div className="wb13-allclear" data-testid="workbench-history-empty">
                    No conversations yet. Anything you Ask in the Workbench shows up here.
                  </div>`}
        </div>
      </div>
    </main>
  `}export{h as HistoryView};
