import{a as v}from"./chunk-4INX7S4N.js";import{b,c as e}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";var c=Object.freeze(["green","yellow","red","grey"]),m=Object.freeze([{id:"parties",label:"Parties",type:"text",prompt:"Who are the named parties to this agreement? List each party and its role (e.g. Disclosing / Receiving)."},{id:"governing-law",label:"Governing Law",type:"text",prompt:'What governing law and jurisdiction does this agreement specify? Quote the clause if present, otherwise say "not specified".'},{id:"term",label:"Term",type:"text",prompt:"What is the term/duration of this agreement and when does it commence? Include any confidentiality survival period."},{id:"termination",label:"Termination",type:"text",prompt:"How can this agreement be terminated? Summarise the termination rights, any notice period, and whether cause is required."},{id:"change-of-control",label:"Change of Control",type:"text",prompt:"Does this agreement address change of control or assignment? Summarise any consent, notice, or termination right triggered by a change of control or assignment."}]);var x=Object.freeze({green:"Clear",yellow:"Review",red:"Risk",grey:"N/A"});function f(a,s,l){let t=a&&a[s];return t&&t[l]||null}function g({columns:a=[],documents:s=[],cells:l={}}){let t=Array.isArray(a)?a:[],d=Array.isArray(s)?s:[];return!t.length||!d.length?null:e`
    <div className="wb13-review-grid-wrap" data-testid="workbench-review-grid">
      <style>
        .wb13-review-grid-wrap {
          overflow-x: auto;
          border: 1px solid var(--wb-line);
          border-radius: 14px;
          background: var(--wb-surface);
        }
        .wb13-review-grid {
          border-collapse: collapse;
          width: 100%;
          font-size: 13px;
        }
        .wb13-review-grid th {
          text-align: left;
          font-weight: 600;
          font-size: 10.5px;
          line-height: 1.2;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--wb-muted);
          padding: 12px 14px;
          border-bottom: 1px solid var(--wb-line);
          white-space: nowrap;
        }
        .wb13-review-grid td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--wb-line);
          vertical-align: top;
          color: var(--wb-ink-2);
          line-height: 1.45;
        }
        .wb13-review-grid tr:last-child td {
          border-bottom: 0;
        }
        .wb13-rev-doc {
          font-weight: 600;
          color: var(--wb-ink);
          white-space: nowrap;
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .wb13-rev-cell {
          min-width: 150px;
        }
        .wb13-rev-pending {
          color: var(--wb-faint);
        }
        .wb13-rev-flag {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 7px;
          vertical-align: 1px;
          background: var(--wb-muted);
        }
        .wb13-rev-flag.is-green {
          background: var(--wb-good);
        }
        .wb13-rev-flag.is-yellow {
          background: var(--wb-warn, var(--wb-gold));
        }
        .wb13-rev-flag.is-red {
          background: var(--wb-danger);
        }
        .wb13-rev-flag.is-grey {
          background: var(--wb-muted);
        }
        .wb13-review-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          padding: 10px 14px;
          font-size: 11.5px;
          color: var(--wb-muted);
          border-top: 1px solid var(--wb-line);
        }
        .wb13-review-legend span {
          display: inline-flex;
          align-items: center;
        }
      </style>
      <table className="wb13-review-grid">
        <thead>
          <tr>
            <th>Document</th>
            ${t.map(i=>e`<th key=${i.id}>${i.label}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${d.map(i=>e`
              <tr key=${i.id}>
                <td className="wb13-rev-doc" title=${i.title||i.name||i.id}>
                  ${i.title||i.name||i.id}
                </td>
                ${t.map(w=>{let n=f(l,i.id,w.id),o=n&&n.status==="done"?e`<span
                            className=${`wb13-rev-flag is-${c.includes(n.flag)?n.flag:"grey"}`}
                            aria-hidden="true"
                          ></span
                          ><span className="wb13-rev-summary">${n.summary}</span>`:n&&n.status==="error"?e`<span className="wb13-rev-pending">couldn't read</span>`:e`<span className="wb13-rev-pending" aria-label="not run yet"
                            >—</span
                          >`;return e`<td key=${w.id} className="wb13-rev-cell">${o}</td>`})}
              </tr>
            `)}
        </tbody>
      </table>
      <div className="wb13-review-legend" aria-hidden="true">
        ${c.map(i=>e`<span key=${i}
              ><span className=${`wb13-rev-flag is-${i}`}></span>${x[i]}</span
            >`)}
      </div>
    </div>
  `}var y=`
  .wb13-review-empty {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    max-width: 560px;
    margin: 10px 0;
    padding: 18px 20px;
    border: 1px solid var(--wb-line);
    border-radius: 14px;
    background: var(--wb-surface);
  }
  .wb13-review-empty .wb13-review-icon { width: 22px; height: 22px; flex: none; color: var(--wb-muted); margin-top: 2px; }
  .wb13-review-empty .wb13-review-title { font-weight: 650; font-size: 15px; color: var(--wb-ink); margin-bottom: 4px; }
  .wb13-review-empty .wb13-review-sub { font-size: 13px; line-height: 1.5; color: var(--wb-muted); }
  .wb13-review-empty .wb13-review-actions { margin-top: 14px; }
  .wb13-review-layout { display: flex; flex-direction: column; gap: 16px; margin-top: 4px; }
  .wb13-review-pick {
    border: 1px solid var(--wb-line);
    border-radius: 14px;
    background: var(--wb-surface);
    overflow: hidden;
    max-width: 560px;
  }
  .wb13-review-pick-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--wb-line);
    font-weight: 600;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--wb-muted);
  }
  .wb13-review-pick-head .wb13-review-pick-count { margin-left: auto; color: var(--wb-ink-2); }
  .wb13-review-pick-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    font-size: 13.5px;
    color: var(--wb-ink);
    cursor: pointer;
    min-height: 44px;
  }
  .wb13-review-pick-row + .wb13-review-pick-row { border-top: 1px solid var(--wb-line); }
  .wb13-review-pick-row input { width: 16px; height: 16px; flex: none; }
  .wb13-review-pick-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wb13-review-hint { font-size: 13px; color: var(--wb-muted); max-width: 560px; }
`;function h({subline:a}){return e`
    <div className="wb13-review-empty" data-testid="workbench-review-empty">
      <span className="wb13-review-icon" aria-hidden="true"><${v} name="layers" /></span>
      <div>
        <div className="wb13-review-title">Review your terms across many documents at once</div>
        <div className="wb13-review-sub">${a}</div>
        <div className="wb13-review-actions">
          <button type="button" className="wb13-button is-primary is-sm" disabled>
            Choose documents
          </button>
        </div>
      </div>
    </div>
  `}function S({files:a=[],driveReady:s=!1,driveLoading:l=!1}){let t=Array.isArray(a)?a:[],[d,i]=b.default.useState(()=>new Set),w=r=>i(u=>{let p=new Set(u);return p.has(r)?p.delete(r):p.add(r),p}),n=t.filter(r=>d.has(r.id)).map(r=>({id:r.id,name:r.name})),o;return s?l&&!t.length?o=e`<div className="wb13-review-hint" data-testid="workbench-review-loading">
      Loading documents from Google Drive…
    </div>`:t.length?o=e`
      <div className="wb13-review-layout">
        <div className="wb13-review-pick" data-testid="workbench-review-picker">
          <div className="wb13-review-pick-head">
            Documents<span className="wb13-review-pick-count">${d.size} selected</span>
          </div>
          ${t.map(r=>e`
              <label className="wb13-review-pick-row" key=${r.id}>
                <input
                  type="checkbox"
                  data-testid="workbench-review-doc"
                  checked=${d.has(r.id)}
                  onChange=${()=>w(r.id)}
                />
                <span className="wb13-review-pick-name" title=${r.name}>${r.name}</span>
              </label>
            `)}
        </div>
        ${n.length?e`<${g} columns=${m} documents=${n} cells=${{}} />`:e`<div className="wb13-review-hint" data-testid="workbench-review-hint">
              Pick documents above to build the review grid — the columns (parties, governing law,
              term, termination, change of control) fill once extraction runs.
            </div>`}
      </div>
    `:o=e`<${h}
      subline="No documents found in your Google Drive yet. Add contracts there and they'll appear here to review."
    />`:o=e`<${h}
      subline="Choose a set of contracts and the terms to pull from each — parties, governing law, term, termination, change of control — and IronClaw fills a grid you can scan. Connect Google Drive to pick documents."
    />`,e`
    <main className="wb13-main">
      <style>
        ${y}
      </style>
      <div className="wb13-page">
        <div className="wb13-wide">
          <div className="wb13-head"><h1>Review</h1></div>
          ${o}
        </div>
      </div>
    </main>
  `}export{S as ReviewView};
