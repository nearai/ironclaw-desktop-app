import{b as v,g as p,i as w,j as u,k as y,l as h}from"./chunk-I4FJLH5R.js";import{a as b}from"./chunk-KN3NV7CC.js";import{a as n}from"./chunk-4INX7S4N.js";import{b as t,c as a}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";var g=`
.wb13-memory-list { display: flex; flex-direction: column; gap: 8px; }
.wb13-memory-item .wb13-card-copy { color: var(--wb-faint); text-transform: none; }
.wb13-learned-reasons { color: var(--wb-faint); text-transform: none; font-size: 12px; }
`;function C({dismissals:N,onClearSender:m}={}){let[o,c]=t.default.useState(""),[r,$]=t.default.useState("Personal"),[i,d]=t.default.useState(()=>u()),l=!!o.trim(),s=p(N||v()),f=()=>{l&&(d(y({text:o,scope:r})),c(""))},k=e=>d(h(e));return a`
    <main className="wb13-main" data-testid="workbench-memory">
      <style>
        ${g}
      </style>
      <div className="wb13-page">
        <div className="wb13-wrap">
          <div className="wb13-head">
            <h1>Save a preference?</h1>
            <span className="meta">User controlled memory</span>
          </div>
          <section className="wb13-group">
            <div className="wb13-read">
              <p>
                The Workbench applies these to how it drafts, surfaces, and prepares your work.
                Saved on this device — nothing is sent.
              </p>
            </div>
          </section>
          <section className="wb13-group">
            <div className="wb13-kicker">New preference</div>
            <textarea
              className="wb13-approve-textarea"
              data-testid="workbench-memory-input"
              rows="2"
              placeholder="e.g. Show sources before any external draft leaves"
              aria-label="Preference to remember"
              value=${o}
              onInput=${e=>c(e.currentTarget.value)}
            ></textarea>
            <div className="wb13-chips" role="radiogroup" aria-label="Memory scope">
              ${w.map(e=>a`
                  <button
                    key=${e}
                    type="button"
                    role="radio"
                    aria-checked=${r===e}
                    className=${b("wb13-chip",r===e&&"is-active")}
                    onClick=${()=>$(e)}
                  >
                    ${e}
                  </button>
                `)}
            </div>
            <button
              type="button"
              className="wb13-button is-primary"
              data-testid="workbench-memory-save"
              disabled=${!l}
              onClick=${f}
            >
              Save preference
            </button>
          </section>
          ${i.length?a`<section className="wb13-group">
                <div className="wb13-kicker">Saved preferences · ${i.length}</div>
                <div className="wb13-memory-list" data-testid="workbench-memory-list">
                  ${i.map(e=>a`
                      <div key=${e.id} className="wb13-card wb13-memory-item">
                        <div className="wb13-action-icon is-hold"><${n} name="pin" /></div>
                        <div className="wb13-card-main">
                          <div className="wb13-card-title">${e.text}</div>
                          <div className="wb13-card-copy">${e.scope}</div>
                        </div>
                        <button
                          type="button"
                          className="wb13-button is-sm"
                          aria-label=${`Forget: ${e.text}`}
                          onClick=${()=>k(e.id)}
                        >
                          Forget
                        </button>
                      </div>
                    `)}
                </div>
              </section>`:null}
          <section className="wb13-group" data-testid="workbench-memory-learned">
            <div className="wb13-kicker">
              Learned from your dismissals${s.length?` \xB7 ${s.length}`:""}
            </div>
            <div className="wb13-read">
              <p>
                When you file the same sender away a few times, the Workbench stops surfacing them
                in triage. Here is what it muted on its own — restore any whenever you want.
              </p>
            </div>
            ${s.length?a`<div className="wb13-memory-list" data-testid="workbench-memory-learned-list">
                  ${s.map(e=>a`
                      <div key=${e.sender} className="wb13-card wb13-memory-item">
                        <div className="wb13-action-icon is-hold"><${n} name="shield" /></div>
                        <div className="wb13-card-main">
                          <div className="wb13-card-title">${e.sender}</div>
                          <div className="wb13-learned-reasons">
                            Muted after ${e.count}
                            ${e.count===1?"dismissal":"dismissals"}${e.reasons.length?` \xB7 ${e.reasons.join(", ")}`:""}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="wb13-button is-sm"
                          data-testid="workbench-memory-restore"
                          aria-label=${`Restore ${e.sender}`}
                          onClick=${()=>typeof m=="function"&&m(e.sender)}
                        >
                          Restore
                        </button>
                      </div>
                    `)}
                </div>`:a`<div className="wb13-read">
                  <p className="wb13-learned-reasons">
                    Nothing muted yet. File a chatty sender "Not relevant" a couple of times and
                    they will show up here to confirm or restore.
                  </p>
                </div>`}
          </section>
        </div>
      </div>
    </main>
  `}export{C as MemoryView};
