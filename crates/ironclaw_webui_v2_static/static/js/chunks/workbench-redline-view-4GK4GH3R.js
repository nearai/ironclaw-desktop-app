import{b as v,c as g}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";function N(r){return(typeof r=="string"?r:"").match(/\s+|\S+/g)||[]}function D(r){let o=[];for(let e of r){if(!e.text)continue;let n=o[o.length-1];n&&n.op===e.op?n.text+=e.text:o.push({op:e.op,text:e.text})}return o}function R(r,o){let e=r.length,n=o.length,d=Array.from({length:e+1},()=>new Int32Array(n+1));for(let l=e-1;l>=0;l--)for(let s=n-1;s>=0;s--)d[l][s]=r[l]===o[s]?d[l+1][s+1]+1:Math.max(d[l+1][s],d[l][s+1]);return d}function _(r,o){let e=N(r),n=N(o);if(e.length+n.length>4e3){let f=[];return typeof r=="string"&&r&&f.push({op:"delete",text:r}),typeof o=="string"&&o&&f.push({op:"insert",text:o}),f}let d=R(e,n),l=e.length,s=n.length,i=[],a=0,c=0;for(;a<l&&c<s;)e[a]===n[c]?(i.push({op:"equal",text:e[a]}),a++,c++):d[a+1][c]>=d[a][c+1]?(i.push({op:"delete",text:e[a]}),a++):(i.push({op:"insert",text:n[c]}),c++);for(;a<l;)i.push({op:"delete",text:e[a++]});for(;c<s;)i.push({op:"insert",text:n[c++]});return D(i)}function F(r,o){let e=String(r??"").match(/\S+/g)||[],n=String(o??"").match(/\S+/g)||[];return!e.length&&!n.length?1:!e.length||!n.length?0:2*R(e,n)[0][0]/(e.length+n.length)}var L=.4,O=2500;function S(r){return(typeof r=="string"?r:"").split(/\n+/).map(e=>e.trim()).filter(Boolean)}function C(r,o){let e=S(r),n=S(o),d=R(e,n),l=e.length,s=n.length,i=[],a=0,c=0;for(;a<l&&c<s;)e[a]===n[c]?(i.push({kind:"equal",before:e[a],after:n[c]}),a++,c++):d[a+1][c]>=d[a][c+1]?(i.push({kind:"del",before:e[a]}),a++):(i.push({kind:"ins",after:n[c]}),c++);for(;a<l;)i.push({kind:"del",before:e[a++]});for(;c<s;)i.push({kind:"ins",after:n[c++]});let f=(p,u)=>({kind:"modified",before:p,after:u,segments:_(p,u),changed:!0}),x=p=>({kind:"removed",before:p,after:"",segments:[{op:"delete",text:p}],changed:!0}),j=p=>({kind:"added",before:"",after:p,segments:[{op:"insert",text:p}],changed:!0}),y=[],w=0;for(;w<i.length;){if(i[w].kind==="equal"){let b=i[w];y.push({kind:"unchanged",before:b.before,after:b.after,segments:b.before?[{op:"equal",text:b.before}]:[],changed:!1}),w++;continue}let p=[],u=[];for(;w<i.length&&i[w].kind!=="equal";)i[w].kind==="del"?p.push(i[w].before):u.push(i[w].after),w++;let k=new Array(p.length).fill(!1),$=new Array(u.length).fill(-1);if(p.length*u.length<=O){let b=[];for(let t=0;t<p.length;t++)for(let h=0;h<u.length;h++){let m=F(p[t],u[h]);m>=L&&b.push({di:t,ii:h,sim:m})}b.sort((t,h)=>h.sim-t.sim||t.di-h.di||t.ii-h.ii);for(let t of b)k[t.di]||$[t.ii]!==-1||(k[t.di]=!0,$[t.ii]=t.di)}for(let b=0;b<p.length;b++)k[b]||y.push(x(p[b]));for(let b=0;b<u.length;b++)y.push($[b]!==-1?f(p[$[b]],u[b]):j(u[b]))}return y.filter(Boolean).map((p,u)=>({id:`clause-${u}`,...p}))}function I(r,o){let e=Array.isArray(r)?r:[],n=o&&typeof o=="object"?o:{};return e.map(d=>{if(!d||typeof d!="object")return"";let l=n[d.id]==="reject"?d.before:d.after;return typeof l=="string"?l:""}).filter(d=>d.length>0).join(`
`)}var z={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};function A(r){return String(r??"").replace(/[&<>"']/g,o=>z[o])}function T(r,{title:o="Redline"}={}){let e=Array.isArray(r)?r:[],n=A(o),d=e.map(l=>{if(!l||typeof l!="object")return"";let s=(Array.isArray(l.segments)?l.segments:[]).map(i=>{let a=A(i&&i.text);return i&&i.op==="insert"?`<ins>${a}</ins>`:i&&i.op==="delete"?`<del>${a}</del>`:a}).join("");return`<p class="c"><span class="k">${A(l.kind)}</span>${s}</p>`}).filter(Boolean).join(`
`);return`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${n}</title>
<style>
body{font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:760px;margin:40px auto;padding:0 22px;color:#1b1b1b}
h1{font-size:20px;margin:0 0 18px}
.c{margin:0 0 12px;padding:11px 13px;border:1px solid #e4e4e4;border-radius:8px;white-space:pre-wrap}
.k{display:inline-block;font:700 10px/1 sans-serif;text-transform:uppercase;letter-spacing:.07em;color:#8a8a8a;margin-right:8px}
ins{color:#0a7d33;text-decoration:underline}
del{color:#c0392b;text-decoration:line-through}
</style></head>
<body><h1>${n}</h1>
${d}
</body></html>`}function M(r){return!r||r.kind!=="modified"?!1:N(r.before).length+N(r.after).length>4e3}var E={unchanged:"Unchanged",modified:"Modified",added:"Added",removed:"Removed"},B=`
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
  .wb13-rl-degraded {
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--wb-warn-text, var(--wb-muted));
    max-width: 920px;
    margin: -4px 0 12px;
    padding: 9px 12px;
    border: 1px solid var(--wb-warn-line, var(--wb-line));
    border-radius: 10px;
    background: var(--wb-warn-soft, transparent);
  }
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
`;function q({segments:r}){let o=Array.isArray(r)?r:[];return g`<div className="wb13-rl-text">
    ${o.map((e,n)=>e.op==="insert"?g`<ins key=${n} className="wb13-rl-ins">${e.text}</ins>`:e.op==="delete"?g`<del key=${n} className="wb13-rl-del">${e.text}</del>`:g`<span key=${n}>${e.text}</span>`)}
  </div>`}function H({initialOriginal:r="",initialRevised:o=""}){let[e,n]=v.default.useState(r),[d,l]=v.default.useState(o),s=v.default.useMemo(()=>C(e,d),[e,d]),[i,a]=v.default.useState({}),[c,f]=v.default.useState(!1),x=s.filter(t=>t.changed).length,j=s.some(M),y=!!(e.trim()||d.trim()),w=t=>i[t]==="reject"?"reject":"accept",p=(t,h)=>{f(!1),a(m=>({...m,[t]:h}))},u=s.filter(t=>t.changed&&w(t.id)==="reject").length,k=v.default.useMemo(()=>I(s,i),[s,i]),$=async()=>{try{await navigator.clipboard.writeText(k),f(!0)}catch{f(!1)}},b=()=>{try{let t=new Blob([T(s,{title:"Redline"})],{type:"text/html"}),h=URL.createObjectURL(t),m=document.createElement("a");m.href=h,m.download="redline.html",document.body.appendChild(m),m.click(),m.remove(),setTimeout(()=>URL.revokeObjectURL(h),0)}catch{}};return g`
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
                onInput=${t=>n(t.target.value)}
              ></textarea>
            </div>
            <div className="wb13-rl-pane">
              <label htmlFor="wb13-rl-revised">Revised</label>
              <textarea
                id="wb13-rl-revised"
                data-testid="workbench-redline-revised"
                placeholder="Paste the revised version…"
                value=${d}
                onInput=${t=>l(t.target.value)}
              ></textarea>
            </div>
          </div>
          ${y?g`
                <div className="wb13-rl-summary" data-testid="workbench-redline-summary">
                  ${x?`${x} ${x===1?"clause":"clauses"} changed of ${s.length}`:"No changes \u2014 the two versions match."}
                </div>
                ${j?g`<div className="wb13-rl-degraded" data-testid="workbench-redline-degraded">
                      One or more clauses were too large to compare word-by-word and are shown as a
                      full replacement.
                    </div>`:null}
                <div className="wb13-rl-list" data-testid="workbench-redline-list">
                  ${s.map(t=>{let h=w(t.id);return g`
                      <div
                        className=${`wb13-rl-clause is-${t.kind}${t.changed&&h==="reject"?" is-rejected":""}`}
                        key=${t.id}
                        data-testid="workbench-redline-clause"
                        data-kind=${t.kind}
                        data-decision=${t.changed?h:""}
                      >
                        <div className="wb13-rl-head">
                          <span className=${`wb13-rl-chip is-${t.kind}`}>
                            ${E[t.kind]||t.kind}
                          </span>
                          ${t.changed?g`<span className="wb13-rl-decide">
                                <button
                                  type="button"
                                  className="is-accept"
                                  data-testid="workbench-redline-accept"
                                  aria-pressed=${h==="accept"}
                                  aria-label=${`Accept change to ${t.id}`}
                                  onClick=${()=>p(t.id,"accept")}
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  className="is-reject"
                                  data-testid="workbench-redline-reject"
                                  aria-pressed=${h==="reject"}
                                  aria-label=${`Reject change to ${t.id}`}
                                  onClick=${()=>p(t.id,"reject")}
                                >
                                  Reject
                                </button>
                              </span>`:null}
                        </div>
                        <${q} segments=${t.segments} />
                      </div>
                    `})}
                </div>
                <div className="wb13-rl-foot">
                  <button
                    type="button"
                    className="wb13-button is-sm"
                    data-testid="workbench-redline-copy"
                    disabled=${!k}
                    onClick=${$}
                  >
                    ${c?"Copied":"Copy resolved text"}
                  </button>
                  <button
                    type="button"
                    className="wb13-button is-sm"
                    data-testid="workbench-redline-download"
                    disabled=${!s.length}
                    onClick=${b}
                  >
                    Download redline
                  </button>
                  <span className="wb13-rl-count" data-testid="workbench-redline-count">
                    ${x-u} of ${x} changes
                    accepted${u?` \xB7 ${u} reverted to the original`:""}
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
  `}export{H as RedlineView};
