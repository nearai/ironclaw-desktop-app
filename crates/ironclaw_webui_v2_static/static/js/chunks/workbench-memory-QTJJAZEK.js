import{a as l,b,c as p,d as v}from"./chunk-KRV3JAXK.js";import{a as m}from"./chunk-KN3NV7CC.js";import{a as d}from"./chunk-4INX7S4N.js";import{b as t,c as a}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";var N=`
.wb13-memory-list { display: flex; flex-direction: column; gap: 8px; }
.wb13-memory-item .wb13-card-copy { color: var(--wb-faint); text-transform: none; }
`;function S(){let[s,i]=t.default.useState(""),[o,w]=t.default.useState("Personal"),[r,c]=t.default.useState(()=>b()),n=!!s.trim(),u=()=>{n&&(c(p({text:s,scope:o})),i(""))},y=e=>c(v(e));return a`
    <main className="wb13-main" data-testid="workbench-memory">
      <style>
        ${N}
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
              value=${s}
              onInput=${e=>i(e.currentTarget.value)}
            ></textarea>
            <div className="wb13-chips" role="radiogroup" aria-label="Memory scope">
              ${l.map(e=>a`
                  <button
                    key=${e}
                    type="button"
                    role="radio"
                    aria-checked=${o===e}
                    className=${m("wb13-chip",o===e&&"is-active")}
                    onClick=${()=>w(e)}
                  >
                    ${e}
                  </button>
                `)}
            </div>
            <button
              type="button"
              className="wb13-button is-primary"
              data-testid="workbench-memory-save"
              disabled=${!n}
              onClick=${u}
            >
              Save preference
            </button>
          </section>
          ${r.length?a`<section className="wb13-group">
                <div className="wb13-kicker">Saved preferences · ${r.length}</div>
                <div className="wb13-memory-list" data-testid="workbench-memory-list">
                  ${r.map(e=>a`
                      <div key=${e.id} className="wb13-card wb13-memory-item">
                        <div className="wb13-action-icon is-hold"><${d} name="pin" /></div>
                        <div className="wb13-card-main">
                          <div className="wb13-card-title">${e.text}</div>
                          <div className="wb13-card-copy">${e.scope}</div>
                        </div>
                        <button
                          type="button"
                          className="wb13-button is-sm"
                          aria-label=${`Forget: ${e.text}`}
                          onClick=${()=>y(e.id)}
                        >
                          Forget
                        </button>
                      </div>
                    `)}
                </div>
              </section>`:null}
        </div>
      </div>
    </main>
  `}export{S as MemoryView};
