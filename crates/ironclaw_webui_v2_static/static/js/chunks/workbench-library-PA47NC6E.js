import{j as b,n as d,o as p,p as w,r as v}from"./chunk-I2QTKD74.js";import{a as r}from"./chunk-4INX7S4N.js";import{b as n,c as t}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";var u=Object.freeze({statusLabel:"On this device",label:"This desktop",detail:"Briefings and documents you export are kept here, on this device. Nothing is sent."});function T({savedItems:l,savedWorkSnapshot:$,onView:y}){let[i,f]=n.default.useState(""),[h,N]=n.default.useState(()=>w()),o=$||u,a=i.trim().toLowerCase(),c=(Array.isArray(l)?l:[]).map(e=>({item:e,artifact:d(e)})).filter(e=>e.artifact).filter(({item:e,artifact:s})=>{let L=`${e?.title||""} ${s?.title||""} ${s?.filename||""}`.toLowerCase();return!a||L.includes(a)}),m=h.filter(e=>!a||`${e.title} ${e.kind}`.toLowerCase().includes(a)),k=m.length===0&&c.length===0,S=e=>N(v(e));return t`
    <main className="wb13-main" data-testid="workbench-library">
      <div className="wb13-page">
        <div className="wb13-wide">
          <div className="wb13-head">
            <h1>Library</h1>
            <span className="meta">Saved work and review history</span>
          </div>
          <div className="wb13-library-source" data-testid="workbench-library-source">
            <span className="wb13-library-source-badge">
              <${r} name="file" /> ${o.statusLabel||o.label||"Saved work"}
            </span>
            <span>${o.detail||u.detail}</span>
          </div>
          <label className="wb13-pill-control" style=${{width:"min(420px, 100%)"}}>
            <${r} name="search" />
            <input
              type="search"
              aria-label="Search library"
              placeholder="Search saved work..."
              value=${i}
              onInput=${e=>f(e.currentTarget.value)}
            />
          </label>
          <div className="wb13-section wb13-list" data-testid="workbench-library-list">
            ${m.map(e=>t`
                <div key=${e.id} className="wb13-row">
                  <span className="wb13-row-icon"><${r} name="file" /></span>
                  <span>
                    <span className="wb13-row-title">${e.title}</span>
                    <span className="wb13-row-copy">${e.kind}</span>
                  </span>
                  <button
                    type="button"
                    className="wb13-button is-sm"
                    aria-label=${`Remove ${e.title} from library`}
                    onClick=${()=>S(e.id)}
                  >
                    Remove
                  </button>
                </div>
              `)}
            ${c.map(({item:e,artifact:s})=>t`
                <${b} key=${e.id} to=${p(e)} className="wb13-row">
                  <span className="wb13-row-icon"><${r} name="file" /></span>
                  <span>
                    <span className="wb13-row-title">${e.title||"Saved work"}</span>
                    <span className="wb13-row-copy"
                      >${s.title||s.filename||"Saved artifact"}</span
                    >
                  </span>
                  <span className="wb13-row-meta">open</span>
                <//>
              `)}
            ${k?t`<div className="wb13-empty">
                  ${a?`No saved work matches "${i.trim()}".`:"Nothing saved yet. Briefings and work you export are filed here."}
                  <button
                    type="button"
                    className="wb13-button is-sm"
                    onClick=${()=>y("home")}
                  >
                    Back to Work
                  </button>
                </div>`:null}
          </div>
        </div>
      </div>
    </main>
  `}export{T as LibraryView};
