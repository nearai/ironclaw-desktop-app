import{b as v,c as w}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";function N(n){return(typeof n=="string"?n:"").match(/\s+|\S+/g)||[]}function M(n){let a=[];for(let e of n){if(!e.text)continue;let r=a[a.length-1];r&&r.op===e.op?r.text+=e.text:a.push({op:e.op,text:e.text})}return a}function y(n,a){let e=n.length,r=a.length,c=Array.from({length:e+1},()=>new Int32Array(r+1));for(let p=e-1;p>=0;p--)for(let d=r-1;d>=0;d--)c[p][d]=n[p]===a[d]?c[p+1][d+1]+1:Math.max(c[p+1][d],c[p][d+1]);return c}function _(n,a){let e=N(n),r=N(a);if(e.length+r.length>4e3){let f=[];return typeof n=="string"&&n&&f.push({op:"delete",text:n}),typeof a=="string"&&a&&f.push({op:"insert",text:a}),f}let c=y(e,r),p=e.length,d=r.length,i=[],o=0,t=0;for(;o<p&&t<d;)e[o]===r[t]?(i.push({op:"equal",text:e[o]}),o++,t++):c[o+1][t]>=c[o][t+1]?(i.push({op:"delete",text:e[o]}),o++):(i.push({op:"insert",text:r[t]}),t++);for(;o<p;)i.push({op:"delete",text:e[o++]});for(;t<d;)i.push({op:"insert",text:r[t++]});return M(i)}function F(n,a){let e=String(n??"").match(/\S+/g)||[],r=String(a??"").match(/\S+/g)||[];return!e.length&&!r.length?1:!e.length||!r.length?0:2*y(e,r)[0][0]/(e.length+r.length)}var O=.4,T=2500;function A(n){return(typeof n=="string"?n:"").split(/\n+/).map(e=>e.trim()).filter(Boolean)}function S(n,a){let e=A(n),r=A(a),c=y(e,r),p=e.length,d=r.length,i=[],o=0,t=0;for(;o<p&&t<d;)e[o]===r[t]?(i.push({kind:"equal",before:e[o],after:r[t]}),o++,t++):c[o+1][t]>=c[o][t+1]?(i.push({kind:"del",before:e[o]}),o++):(i.push({kind:"ins",after:r[t]}),t++);for(;o<p;)i.push({kind:"del",before:e[o++]});for(;t<d;)i.push({kind:"ins",after:r[t++]});let f=(l,u)=>({kind:"modified",before:l,after:u,segments:_(l,u),changed:!0}),I=l=>({kind:"removed",before:l,after:"",segments:[{op:"delete",text:l}],changed:!0}),R=l=>({kind:"added",before:"",after:l,segments:[{op:"insert",text:l}],changed:!0}),m=[],b=0;for(;b<i.length;){if(i[b].kind==="equal"){let s=i[b];m.push({kind:"unchanged",before:s.before,after:s.after,segments:s.before?[{op:"equal",text:s.before}]:[],changed:!1}),b++;continue}let l=[],u=[];for(;b<i.length&&i[b].kind!=="equal";)i[b].kind==="del"?l.push(i[b].before):u.push(i[b].after),b++;let k=new Array(l.length).fill(!1),x=new Array(u.length).fill(-1);if(l.length*u.length<=T){let s=[];for(let h=0;h<l.length;h++)for(let g=0;g<u.length;g++){let $=F(l[h],u[g]);$>=O&&s.push({di:h,ii:g,sim:$})}s.sort((h,g)=>g.sim-h.sim||h.di-g.di||h.ii-g.ii);for(let h of s)k[h.di]||x[h.ii]!==-1||(k[h.di]=!0,x[h.ii]=h.di)}for(let s=0;s<l.length;s++)k[s]||m.push(I(l[s]));for(let s=0;s<u.length;s++)m.push(x[s]!==-1?f(l[x[s]],u[s]):R(u[s]))}return m.filter(Boolean).map((l,u)=>({id:`clause-${u}`,...l}))}var z={unchanged:"Unchanged",modified:"Modified",added:"Added",removed:"Removed"},B=`
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
`;function C({segments:n}){let a=Array.isArray(n)?n:[];return w`<div className="wb13-rl-text">
    ${a.map((e,r)=>e.op==="insert"?w`<ins key=${r} className="wb13-rl-ins">${e.text}</ins>`:e.op==="delete"?w`<del key=${r} className="wb13-rl-del">${e.text}</del>`:w`<span key=${r}>${e.text}</span>`)}
  </div>`}function D({initialOriginal:n="",initialRevised:a=""}){let[e,r]=v.default.useState(n),[c,p]=v.default.useState(a),d=v.default.useMemo(()=>S(e,c),[e,c]),i=d.filter(t=>t.changed).length,o=!!(e.trim()||c.trim());return w`
    <main className="wb13-main">
      <style>
        ${B}
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
                onInput=${t=>r(t.target.value)}
              ></textarea>
            </div>
            <div className="wb13-rl-pane">
              <label htmlFor="wb13-rl-revised">Revised</label>
              <textarea
                id="wb13-rl-revised"
                data-testid="workbench-redline-revised"
                placeholder="Paste the revised version…"
                value=${c}
                onInput=${t=>p(t.target.value)}
              ></textarea>
            </div>
          </div>
          ${o?w`
                <div className="wb13-rl-summary" data-testid="workbench-redline-summary">
                  ${i?`${i} ${i===1?"clause":"clauses"} changed of ${d.length}`:"No changes \u2014 the two versions match."}
                </div>
                <div className="wb13-rl-list" data-testid="workbench-redline-list">
                  ${d.map(t=>w`
                      <div
                        className=${`wb13-rl-clause is-${t.kind}`}
                        key=${t.id}
                        data-testid="workbench-redline-clause"
                        data-kind=${t.kind}
                      >
                        <div className="wb13-rl-head">
                          <span className=${`wb13-rl-chip is-${t.kind}`}>
                            ${z[t.kind]||t.kind}
                          </span>
                        </div>
                        <${C} segments=${t.segments} />
                      </div>
                    `)}
                </div>
              `:w`<div className="wb13-rl-empty" data-testid="workbench-redline-empty">
                Paste an original and a revised version above to see a tracked-changes redline —
                insertions underlined, deletions struck through, aligned clause by clause.
                Read-only: nothing is sent or saved.
              </div>`}
        </div>
      </div>
    </main>
  `}export{D as RedlineView};
