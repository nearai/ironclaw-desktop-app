import{b as v,c as w}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";function A(n){return(typeof n=="string"?n:"").match(/\s+|\S+/g)||[]}function M(n){let o=[];for(let t of n){if(!t.text)continue;let r=o[o.length-1];r&&r.op===t.op?r.text+=t.text:o.push({op:t.op,text:t.text})}return o}function j(n,o){let t=n.length,r=o.length,s=Array.from({length:t+1},()=>new Int32Array(r+1));for(let l=t-1;l>=0;l--)for(let d=r-1;d>=0;d--)s[l][d]=n[l]===o[d]?s[l+1][d+1]+1:Math.max(s[l+1][d],s[l][d+1]);return s}function L(n,o){let t=A(n),r=A(o);if(t.length+r.length>4e3){let m=[];return typeof n=="string"&&n&&m.push({op:"delete",text:n}),typeof o=="string"&&o&&m.push({op:"insert",text:o}),m}let s=j(t,r),l=t.length,d=r.length,i=[],a=0,b=0;for(;a<l&&b<d;)t[a]===r[b]?(i.push({op:"equal",text:t[a]}),a++,b++):s[a+1][b]>=s[a][b+1]?(i.push({op:"delete",text:t[a]}),a++):(i.push({op:"insert",text:r[b]}),b++);for(;a<l;)i.push({op:"delete",text:t[a++]});for(;b<d;)i.push({op:"insert",text:r[b++]});return M(i)}function _(n,o){let t=String(n??"").match(/\S+/g)||[],r=String(o??"").match(/\S+/g)||[];return!t.length&&!r.length?1:!t.length||!r.length?0:2*j(t,r)[0][0]/(t.length+r.length)}var z=.4,B=2500;function S(n){return(typeof n=="string"?n:"").split(/\n+/).map(t=>t.trim()).filter(Boolean)}function C(n,o){let t=S(n),r=S(o),s=j(t,r),l=t.length,d=r.length,i=[],a=0,b=0;for(;a<l&&b<d;)t[a]===r[b]?(i.push({kind:"equal",before:t[a],after:r[b]}),a++,b++):s[a+1][b]>=s[a][b+1]?(i.push({kind:"del",before:t[a]}),a++):(i.push({kind:"ins",after:r[b]}),b++);for(;a<l;)i.push({kind:"del",before:t[a++]});for(;b<d;)i.push({kind:"ins",after:r[b++]});let m=(p,h)=>({kind:"modified",before:p,after:h,segments:L(p,h),changed:!0}),f=p=>({kind:"removed",before:p,after:"",segments:[{op:"delete",text:p}],changed:!0}),$=p=>({kind:"added",before:"",after:p,segments:[{op:"insert",text:p}],changed:!0}),x=[],g=0;for(;g<i.length;){if(i[g].kind==="equal"){let e=i[g];x.push({kind:"unchanged",before:e.before,after:e.after,segments:e.before?[{op:"equal",text:e.before}]:[],changed:!1}),g++;continue}let p=[],h=[];for(;g<i.length&&i[g].kind!=="equal";)i[g].kind==="del"?p.push(i[g].before):h.push(i[g].after),g++;let k=new Array(p.length).fill(!1),y=new Array(h.length).fill(-1);if(p.length*h.length<=B){let e=[];for(let c=0;c<p.length;c++)for(let u=0;u<h.length;u++){let R=_(p[c],h[u]);R>=z&&e.push({di:c,ii:u,sim:R})}e.sort((c,u)=>u.sim-c.sim||c.di-u.di||c.ii-u.ii);for(let c of e)k[c.di]||y[c.ii]!==-1||(k[c.di]=!0,y[c.ii]=c.di)}for(let e=0;e<p.length;e++)k[e]||x.push(f(p[e]));for(let e=0;e<h.length;e++)x.push(y[e]!==-1?m(p[y[e]],h[e]):$(h[e]))}return x.filter(Boolean).map((p,h)=>({id:`clause-${h}`,...p}))}function I(n,o){let t=Array.isArray(n)?n:[],r=o&&typeof o=="object"?o:{};return t.map(s=>{if(!s||typeof s!="object")return"";let l=r[s.id]==="reject"?s.before:s.after;return typeof l=="string"?l:""}).filter(s=>s.length>0).join(`
`)}var E={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};function N(n){return String(n??"").replace(/[&<>"']/g,o=>E[o])}function T(n,{title:o="Redline"}={}){let t=Array.isArray(n)?n:[],r=N(o),s=t.map(l=>{if(!l||typeof l!="object")return"";let d=(Array.isArray(l.segments)?l.segments:[]).map(i=>{let a=N(i&&i.text);return i&&i.op==="insert"?`<ins>${a}</ins>`:i&&i.op==="delete"?`<del>${a}</del>`:a}).join("");return`<p class="c"><span class="k">${N(l.kind)}</span>${d}</p>`}).filter(Boolean).join(`
`);return`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${r}</title>
<style>
body{font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:760px;margin:40px auto;padding:0 22px;color:#1b1b1b}
h1{font-size:20px;margin:0 0 18px}
.c{margin:0 0 12px;padding:11px 13px;border:1px solid #e4e4e4;border-radius:8px;white-space:pre-wrap}
.k{display:inline-block;font:700 10px/1 sans-serif;text-transform:uppercase;letter-spacing:.07em;color:#8a8a8a;margin-right:8px}
ins{color:#0a7d33;text-decoration:underline}
del{color:#c0392b;text-decoration:line-through}
</style></head>
<body><h1>${r}</h1>
${s}
</body></html>`}var F={unchanged:"Unchanged",modified:"Modified",added:"Added",removed:"Removed"},O=`
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
  /* Touch: the accept/reject toggles are small on a fine pointer \u2014 give them a 44px target. */
  @media (pointer: coarse) {
    .wb13-rl-decide button { min-height: 44px; padding-left: 14px; padding-right: 14px; }
  }
`;function D({segments:n}){let o=Array.isArray(n)?n:[];return w`<div className="wb13-rl-text">
    ${o.map((t,r)=>t.op==="insert"?w`<ins key=${r} className="wb13-rl-ins">${t.text}</ins>`:t.op==="delete"?w`<del key=${r} className="wb13-rl-del">${t.text}</del>`:w`<span key=${r}>${t.text}</span>`)}
  </div>`}function H({initialOriginal:n="",initialRevised:o=""}){let[t,r]=v.default.useState(n),[s,l]=v.default.useState(o),d=v.default.useMemo(()=>C(t,s),[t,s]),[i,a]=v.default.useState({}),[b,m]=v.default.useState(!1),f=d.filter(e=>e.changed).length,$=!!(t.trim()||s.trim()),x=e=>i[e]==="reject"?"reject":"accept",g=(e,c)=>{m(!1),a(u=>({...u,[e]:c}))},p=d.filter(e=>e.changed&&x(e.id)==="reject").length,h=v.default.useMemo(()=>I(d,i),[d,i]),k=async()=>{try{await navigator.clipboard.writeText(h),m(!0)}catch{m(!1)}},y=()=>{try{let e=new Blob([T(d,{title:"Redline"})],{type:"text/html"}),c=URL.createObjectURL(e),u=document.createElement("a");u.href=c,u.download="redline.html",document.body.appendChild(u),u.click(),u.remove(),setTimeout(()=>URL.revokeObjectURL(c),0)}catch{}};return w`
    <main className="wb13-main">
      <style>
        ${O}
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
                value=${t}
                onInput=${e=>r(e.target.value)}
              ></textarea>
            </div>
            <div className="wb13-rl-pane">
              <label htmlFor="wb13-rl-revised">Revised</label>
              <textarea
                id="wb13-rl-revised"
                data-testid="workbench-redline-revised"
                placeholder="Paste the revised version…"
                value=${s}
                onInput=${e=>l(e.target.value)}
              ></textarea>
            </div>
          </div>
          ${$?w`
                <div className="wb13-rl-summary" data-testid="workbench-redline-summary">
                  ${f?`${f} ${f===1?"clause":"clauses"} changed of ${d.length}`:"No changes \u2014 the two versions match."}
                </div>
                <div className="wb13-rl-list" data-testid="workbench-redline-list">
                  ${d.map(e=>{let c=x(e.id);return w`
                      <div
                        className=${`wb13-rl-clause is-${e.kind}${e.changed&&c==="reject"?" is-rejected":""}`}
                        key=${e.id}
                        data-testid="workbench-redline-clause"
                        data-kind=${e.kind}
                        data-decision=${e.changed?c:""}
                      >
                        <div className="wb13-rl-head">
                          <span className=${`wb13-rl-chip is-${e.kind}`}>
                            ${F[e.kind]||e.kind}
                          </span>
                          ${e.changed?w`<span className="wb13-rl-decide">
                                <button
                                  type="button"
                                  className="is-accept"
                                  data-testid="workbench-redline-accept"
                                  aria-pressed=${c==="accept"}
                                  aria-label=${`Accept change to ${e.id}`}
                                  onClick=${()=>g(e.id,"accept")}
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  className="is-reject"
                                  data-testid="workbench-redline-reject"
                                  aria-pressed=${c==="reject"}
                                  aria-label=${`Reject change to ${e.id}`}
                                  onClick=${()=>g(e.id,"reject")}
                                >
                                  Reject
                                </button>
                              </span>`:null}
                        </div>
                        <${D} segments=${e.segments} />
                      </div>
                    `})}
                </div>
                <div className="wb13-rl-foot">
                  <button
                    type="button"
                    className="wb13-button is-sm"
                    data-testid="workbench-redline-copy"
                    disabled=${!h}
                    onClick=${k}
                  >
                    ${b?"Copied":"Copy resolved text"}
                  </button>
                  <button
                    type="button"
                    className="wb13-button is-sm"
                    data-testid="workbench-redline-download"
                    disabled=${!d.length}
                    onClick=${y}
                  >
                    Download redline
                  </button>
                  <span className="wb13-rl-count" data-testid="workbench-redline-count">
                    ${f-p} of ${f} changes
                    accepted${p?` \xB7 ${p} reverted to the original`:""}
                  </span>
                </div>
              `:w`<div className="wb13-rl-empty" data-testid="workbench-redline-empty">
                Paste an original and a revised version above to see a tracked-changes redline —
                insertions underlined, deletions struck through, aligned clause by clause.
                Read-only: nothing is sent or saved.
              </div>`}
        </div>
      </div>
    </main>
  `}export{H as RedlineView};
