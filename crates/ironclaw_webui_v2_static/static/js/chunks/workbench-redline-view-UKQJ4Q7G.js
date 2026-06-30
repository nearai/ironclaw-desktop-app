import{b as k,c as g}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";function A(n){return(typeof n=="string"?n:"").match(/\s+|\S+/g)||[]}function I(n){let i=[];for(let e of n){if(!e.text)continue;let t=i[i.length-1];t&&t.op===e.op?t.text+=e.text:i.push({op:e.op,text:e.text})}return i}function N(n,i){let e=n.length,t=i.length,a=Array.from({length:e+1},()=>new Int32Array(t+1));for(let b=e-1;b>=0;b--)for(let p=t-1;p>=0;p--)a[b][p]=n[b]===i[p]?a[b+1][p+1]+1:Math.max(a[b+1][p],a[b][p+1]);return a}function M(n,i){let e=A(n),t=A(i);if(e.length+t.length>4e3){let f=[];return typeof n=="string"&&n&&f.push({op:"delete",text:n}),typeof i=="string"&&i&&f.push({op:"insert",text:i}),f}let a=N(e,t),b=e.length,p=t.length,s=[],l=0,c=0;for(;l<b&&c<p;)e[l]===t[c]?(s.push({op:"equal",text:e[l]}),l++,c++):a[l+1][c]>=a[l][c+1]?(s.push({op:"delete",text:e[l]}),l++):(s.push({op:"insert",text:t[c]}),c++);for(;l<b;)s.push({op:"delete",text:e[l++]});for(;c<p;)s.push({op:"insert",text:t[c++]});return I(s)}function T(n,i){let e=String(n??"").match(/\S+/g)||[],t=String(i??"").match(/\S+/g)||[];return!e.length&&!t.length?1:!e.length||!t.length?0:2*N(e,t)[0][0]/(e.length+t.length)}var _=.4,z=2500;function S(n){return(typeof n=="string"?n:"").split(/\n+/).map(e=>e.trim()).filter(Boolean)}function R(n,i){let e=S(n),t=S(i),a=N(e,t),b=e.length,p=t.length,s=[],l=0,c=0;for(;l<b&&c<p;)e[l]===t[c]?(s.push({kind:"equal",before:e[l],after:t[c]}),l++,c++):a[l+1][c]>=a[l][c+1]?(s.push({kind:"del",before:e[l]}),l++):(s.push({kind:"ins",after:t[c]}),c++);for(;l<b;)s.push({kind:"del",before:e[l++]});for(;c<p;)s.push({kind:"ins",after:t[c++]});let f=(d,u)=>({kind:"modified",before:d,after:u,segments:M(d,u),changed:!0}),x=d=>({kind:"removed",before:d,after:"",segments:[{op:"delete",text:d}],changed:!0}),$=d=>({kind:"added",before:"",after:d,segments:[{op:"insert",text:d}],changed:!0}),v=[],w=0;for(;w<s.length;){if(s[w].kind==="equal"){let o=s[w];v.push({kind:"unchanged",before:o.before,after:o.after,segments:o.before?[{op:"equal",text:o.before}]:[],changed:!1}),w++;continue}let d=[],u=[];for(;w<s.length&&s[w].kind!=="equal";)s[w].kind==="del"?d.push(s[w].before):u.push(s[w].after),w++;let y=new Array(d.length).fill(!1),r=new Array(u.length).fill(-1);if(d.length*u.length<=z){let o=[];for(let h=0;h<d.length;h++)for(let m=0;m<u.length;m++){let j=T(d[h],u[m]);j>=_&&o.push({di:h,ii:m,sim:j})}o.sort((h,m)=>m.sim-h.sim||h.di-m.di||h.ii-m.ii);for(let h of o)y[h.di]||r[h.ii]!==-1||(y[h.di]=!0,r[h.ii]=h.di)}for(let o=0;o<d.length;o++)y[o]||v.push(x(d[o]));for(let o=0;o<u.length;o++)v.push(r[o]!==-1?f(d[r[o]],u[o]):$(u[o]))}return v.filter(Boolean).map((d,u)=>({id:`clause-${u}`,...d}))}function C(n,i){let e=Array.isArray(n)?n:[],t=i&&typeof i=="object"?i:{};return e.map(a=>{if(!a||typeof a!="object")return"";let b=t[a.id]==="reject"?a.before:a.after;return typeof b=="string"?b:""}).filter(a=>a.length>0).join(`
`)}var F={unchanged:"Unchanged",modified:"Modified",added:"Added",removed:"Removed"},D=`
  .wb13-rl-entry { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; max-width: 920px; }
  .wb13-rl-pane { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 6px; }
  .wb13-rl-pane label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--wb-muted); }
  .wb13-rl-pane textarea {
    min-height: 150px;
    padding: 11px 13px;
    border: 1px solid var(--wb-line);
    border-radius: 12px;
    background: var(--wb-input, var(--wb-surface));
    color: var(--wb-ink);
    font: 13px/1.5 var(--wb-font-body);
    resize: vertical;
  }
  .wb13-rl-pane textarea:focus-visible { outline: 2px solid var(--wb-accent, var(--wb-ink)); outline-offset: 1px; }
  .wb13-rl-summary { font-size: 13px; color: var(--wb-muted); margin-bottom: 12px; max-width: 920px; }
  .wb13-rl-list { display: flex; flex-direction: column; gap: 8px; max-width: 920px; }
  .wb13-rl-clause {
    border: 1px solid var(--wb-line);
    border-radius: 12px;
    background: var(--wb-surface);
    padding: 12px 14px;
  }
  .wb13-rl-clause.is-unchanged { opacity: 0.62; }
  .wb13-rl-head { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
  .wb13-rl-decide { margin-left: auto; display: inline-flex; gap: 4px; }
  .wb13-rl-decide button {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 9px;
    border: 1px solid var(--wb-line);
    border-radius: 999px;
    background: transparent;
    color: var(--wb-muted);
    cursor: pointer;
  }
  .wb13-rl-decide button[aria-pressed='true'].is-accept { color: var(--wb-good-text, var(--wb-good)); border-color: var(--wb-good-line, var(--wb-good)); }
  .wb13-rl-decide button[aria-pressed='true'].is-reject { color: var(--wb-danger); border-color: var(--wb-danger); }
  .wb13-rl-clause.is-rejected { border-style: dashed; }
  .wb13-rl-foot { display: flex; align-items: center; gap: 12px; margin-top: 14px; max-width: 920px; }
  .wb13-rl-foot .wb13-rl-count { font-size: 12.5px; color: var(--wb-muted); }
  .wb13-rl-chip {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 999px;
    color: var(--wb-muted);
    background: var(--wb-surface-2, transparent);
    border: 1px solid var(--wb-line);
  }
  .wb13-rl-chip.is-modified { color: var(--wb-warn-text, var(--wb-gold)); border-color: var(--wb-warn-line, var(--wb-line)); }
  .wb13-rl-chip.is-added { color: var(--wb-good-text, var(--wb-good)); border-color: var(--wb-good-line, var(--wb-line)); }
  .wb13-rl-chip.is-removed { color: var(--wb-danger); border-color: var(--wb-danger); }
  .wb13-rl-text { font: 13.5px/1.6 var(--wb-font-body); color: var(--wb-ink-2); white-space: pre-wrap; word-break: break-word; }
  .wb13-rl-ins { color: var(--wb-good-text, var(--wb-good)); text-decoration: underline; text-decoration-thickness: 1px; }
  .wb13-rl-del { color: var(--wb-danger); text-decoration: line-through; }
  .wb13-rl-empty {
    max-width: 560px;
    padding: 16px 18px;
    border: 1px solid var(--wb-line);
    border-radius: 14px;
    background: var(--wb-surface);
    font-size: 13px;
    line-height: 1.5;
    color: var(--wb-muted);
  }
`;function O({segments:n}){let i=Array.isArray(n)?n:[];return g`<div className="wb13-rl-text">
    ${i.map((e,t)=>e.op==="insert"?g`<ins key=${t} className="wb13-rl-ins">${e.text}</ins>`:e.op==="delete"?g`<del key=${t} className="wb13-rl-del">${e.text}</del>`:g`<span key=${t}>${e.text}</span>`)}
  </div>`}function q({initialOriginal:n="",initialRevised:i=""}){let[e,t]=k.default.useState(n),[a,b]=k.default.useState(i),p=k.default.useMemo(()=>R(e,a),[e,a]),[s,l]=k.default.useState({}),[c,f]=k.default.useState(!1),x=p.filter(r=>r.changed).length,$=!!(e.trim()||a.trim()),v=r=>s[r]==="reject"?"reject":"accept",w=(r,o)=>{f(!1),l(h=>({...h,[r]:o}))},d=p.filter(r=>r.changed&&v(r.id)==="reject").length,u=k.default.useMemo(()=>C(p,s),[p,s]),y=async()=>{try{await navigator.clipboard.writeText(u),f(!0)}catch{f(!1)}};return g`
    <main className="wb13-main">
      <style>
        ${D}
      </style>
      <div className="wb13-page">
        <div className="wb13-wide">
          <div className="wb13-head"><h1>Redline</h1></div>
          <div className="wb13-rl-entry">
            <div className="wb13-rl-pane">
              <label htmlFor="wb13-rl-original">Original</label>
              <textarea
                id="wb13-rl-original"
                data-testid="workbench-redline-original"
                placeholder="Paste the original version…"
                value=${e}
                onInput=${r=>t(r.target.value)}
              ></textarea>
            </div>
            <div className="wb13-rl-pane">
              <label htmlFor="wb13-rl-revised">Revised</label>
              <textarea
                id="wb13-rl-revised"
                data-testid="workbench-redline-revised"
                placeholder="Paste the revised version…"
                value=${a}
                onInput=${r=>b(r.target.value)}
              ></textarea>
            </div>
          </div>
          ${$?g`
                <div className="wb13-rl-summary" data-testid="workbench-redline-summary">
                  ${x?`${x} ${x===1?"clause":"clauses"} changed of ${p.length}`:"No changes \u2014 the two versions match."}
                </div>
                <div className="wb13-rl-list" data-testid="workbench-redline-list">
                  ${p.map(r=>{let o=v(r.id);return g`
                      <div
                        className=${`wb13-rl-clause is-${r.kind}${r.changed&&o==="reject"?" is-rejected":""}`}
                        key=${r.id}
                        data-testid="workbench-redline-clause"
                        data-kind=${r.kind}
                        data-decision=${r.changed?o:""}
                      >
                        <div className="wb13-rl-head">
                          <span className=${`wb13-rl-chip is-${r.kind}`}>
                            ${F[r.kind]||r.kind}
                          </span>
                          ${r.changed?g`<span className="wb13-rl-decide">
                                <button
                                  type="button"
                                  className="is-accept"
                                  data-testid="workbench-redline-accept"
                                  aria-pressed=${o==="accept"}
                                  aria-label=${`Accept change to ${r.id}`}
                                  onClick=${()=>w(r.id,"accept")}
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  className="is-reject"
                                  data-testid="workbench-redline-reject"
                                  aria-pressed=${o==="reject"}
                                  aria-label=${`Reject change to ${r.id}`}
                                  onClick=${()=>w(r.id,"reject")}
                                >
                                  Reject
                                </button>
                              </span>`:null}
                        </div>
                        <${O} segments=${r.segments} />
                      </div>
                    `})}
                </div>
                <div className="wb13-rl-foot">
                  <button
                    type="button"
                    className="wb13-button is-sm"
                    data-testid="workbench-redline-copy"
                    disabled=${!u}
                    onClick=${y}
                  >
                    ${c?"Copied":"Copy resolved text"}
                  </button>
                  <span className="wb13-rl-count" data-testid="workbench-redline-count">
                    ${x-d} of ${x} changes
                    accepted${d?` \xB7 ${d} reverted to the original`:""}
                  </span>
                </div>
              `:g`<div className="wb13-rl-empty" data-testid="workbench-redline-empty">
                Paste an original and a revised version above to see a tracked-changes redline —
                insertions underlined, deletions struck through, aligned clause by clause.
                Read-only: nothing is sent or saved.
              </div>`}
        </div>
      </div>
    </main>
  `}export{q as RedlineView};
