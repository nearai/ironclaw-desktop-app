import{a as f}from"./chunk-KN3NV7CC.js";import{a as y}from"./chunk-4INX7S4N.js";import{b as d,c as m}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";var p="workbench:memory-prefs";var b=["Personal","Workspace","This project","This source"];function u(){try{return typeof localStorage<"u"?localStorage:null}catch{return null}}function n(a=u()){if(!a)return[];try{let r=a.getItem(p),o=r?JSON.parse(r):[];return Array.isArray(o)?o.filter(t=>t&&typeof t=="object"&&String(t.text||"").trim()).map(t=>({id:String(t.id||""),text:String(t.text||""),scope:String(t.scope||"Personal"),savedAt:String(t.savedAt||"")})):[]}catch{return[]}}function w({text:a,scope:r,id:o,savedAt:t}={},s=u()){let i=String(a||"").replace(/\s+/g," ").trim();if(!i||!s)return n(s);let c=n(s),l=[{id:o||`mem-${Date.now()}-${c.length}`,text:i.slice(0,400),scope:b.includes(String(r))?String(r):"Personal",savedAt:t||new Date().toISOString()},...c].slice(0,50);try{s.setItem(p,JSON.stringify(l))}catch{}return l}function S(a,r=u()){if(!r)return n(r);let o=n(r).filter(t=>t.id!==String(a));try{r.setItem(p,JSON.stringify(o))}catch{}return o}var g=`
.wb13-memory-list { display: flex; flex-direction: column; gap: 8px; }
.wb13-memory-item .wb13-card-copy { color: var(--wb-faint); text-transform: none; }
`;function P(){let[a,r]=d.default.useState(""),[o,t]=d.default.useState("Personal"),[s,i]=d.default.useState(()=>n()),c=!!a.trim(),v=()=>{c&&(i(w({text:a,scope:o})),r(""))},l=e=>i(S(e));return m`
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
              value=${a}
              onInput=${e=>r(e.currentTarget.value)}
            ></textarea>
            <div className="wb13-chips" role="radiogroup" aria-label="Memory scope">
              ${b.map(e=>m`
                  <button
                    key=${e}
                    type="button"
                    role="radio"
                    aria-checked=${o===e}
                    className=${f("wb13-chip",o===e&&"is-active")}
                    onClick=${()=>t(e)}
                  >
                    ${e}
                  </button>
                `)}
            </div>
            <button
              type="button"
              className="wb13-button is-primary"
              data-testid="workbench-memory-save"
              disabled=${!c}
              onClick=${v}
            >
              Save preference
            </button>
          </section>
          ${s.length?m`<section className="wb13-group">
                <div className="wb13-kicker">Saved preferences · ${s.length}</div>
                <div className="wb13-memory-list" data-testid="workbench-memory-list">
                  ${s.map(e=>m`
                      <div key=${e.id} className="wb13-card wb13-memory-item">
                        <div className="wb13-action-icon is-hold"><${y} name="pin" /></div>
                        <div className="wb13-card-main">
                          <div className="wb13-card-title">${e.text}</div>
                          <div className="wb13-card-copy">${e.scope}</div>
                        </div>
                        <button
                          type="button"
                          className="wb13-button is-sm"
                          aria-label=${`Forget: ${e.text}`}
                          onClick=${()=>l(e.id)}
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
  `}export{P as MemoryView};
