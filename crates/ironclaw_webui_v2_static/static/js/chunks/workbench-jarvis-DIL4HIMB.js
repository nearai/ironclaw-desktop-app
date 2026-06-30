import{a as v}from"./chunk-KN3NV7CC.js";import{e as l}from"./chunk-VNXJL75V.js";import{n as m}from"./chunk-TJ6FHPGI.js";import{a as o}from"./chunk-4INX7S4N.js";import{c as a}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";async function p(){let e=await m("/api/jarvis/summary");return{configured:!!(e&&e.configured),error:String(e&&e.error||""),projects:Array.isArray(e&&e.projects)?e.projects:[],outstanding:Array.isArray(e&&e.outstanding)?e.outstanding:[],commitments:Array.isArray(e&&e.commitments)?e.commitments:[]}}function u(e){let r=(Array.isArray(e)?e:[]).filter(t=>t&&t.state&&t.state!=="done"&&t.state!=="canceled"),n=t=>t.needsApproval||t.state==="needs_approval"?0:1;return r.slice().sort((t,c)=>n(t)-n(c))}function b(e){return{needs_approval:"Needs approval",todo:"To do",in_progress:"In progress",blocked:"Blocked",done:"Done",canceled:"Canceled"}[String(e||"")]||String(e||"").replace(/_/g," ")||"Open"}function $(e){return e.needsApproval||e.state==="needs_approval"?"is-decision":e.state==="blocked"?"is-blocked":e.state==="done"?"is-done":e.state==="in_progress"?"is-working":"is-reply"}function f(e){let s=String(e||"").trim();return s?`Due ${s.slice(0,10)}`:""}function N({commitment:e}){let s=[e.shortId,f(e.dueDate)].filter(Boolean).join(" \xB7 ");return a`
    <div className="wb13-card wb13-card-readable">
      <div className="wb13-card-main">
        <div className="wb13-card-status">
          <span className=${v("wb13-status-pill",$(e))}>
            ${b(e.state)}
          </span>
          ${s?a`<span className="wb13-card-when">${s}</span>`:null}
        </div>
        <div className="wb13-card-title">${e.title||"Untitled commitment"}</div>
      </div>
    </div>
  `}function w({items:e,testid:s}){return a`<div className="wb13-section wb13-list" data-testid=${s}>
    ${e.map((r,n)=>a`<${N} key=${r.id||r.shortId||`c-${n}`} commitment=${r} />`)}
  </div>`}function I(){let e=l({queryKey:["workbench-jarvis-summary"],queryFn:p,staleTime:6e4,retry:1,throwOnError:!1}),s=e.data||{configured:!1,projects:[],outstanding:[],commitments:[]},r=e.isLoading,n=e.isError,t=s.outstanding||[],c=u(s.commitments),d=s.projects||[];return a`
    <main className="wb13-main">
      <div className="wb13-page">
        <div className="wb13-wrap">
          <div className="wb13-triage-head">
            <h2>Projects</h2>
            <span className="count">jarvis · pm-backend</span>
          </div>

          ${r?a`<div className="wb13-section wb13-list" data-testid="workbench-jarvis-skeleton">
                ${[0,1,2].map(i=>a`<div key=${i} className="wb13-card wb13-skel-card">
                      <div className="wb13-card-main">
                        <div className="wb13-skel-line is-pill"></div>
                        <div className="wb13-skel-line is-title"></div>
                      </div>
                    </div>`)}
              </div>`:n?a`<div className="wb13-reader-note is-error" role="alert">
                  <${o} name="flag" /><span
                    >jarvis could not be reached. Check the connection and try again.</span
                  >
                </div>`:s.configured?s.error?a`<div className="wb13-reader-note is-error" role="alert">
                      <${o} name="flag" /><span>jarvis could not be reached: ${s.error}</span>
                    </div>`:a`
                      <div className="wb13-section-label">
                        <${o} name="check" /> Owed to you
                        <span className="wb13-section-count">${t.length}</span>
                      </div>
                      ${t.length?a`<${w}
                            items=${t}
                            testid="workbench-jarvis-outstanding"
                          />`:a`<div className="wb13-allclear">
                            Nobody owes you an open commitment right now.
                          </div>`}

                      <div className="wb13-section-label">
                        <${o} name="spark" /> Your commitments
                        <span className="wb13-section-count">${c.length}</span>
                      </div>
                      ${c.length?a`<${w}
                            items=${c}
                            testid="workbench-jarvis-commitments"
                          />`:a`<div className="wb13-allclear">
                            No open commitments assigned to you.
                          </div>`}

                      <div className="wb13-section-label">
                        <${o} name="folder" /> Projects
                        <span className="wb13-section-count">${d.length}</span>
                      </div>
                      <div
                        className="wb13-section wb13-list"
                        data-testid="workbench-jarvis-projects"
                      >
                        ${d.map((i,g)=>a`<div
                              key=${i.id||i.slug||`p-${g}`}
                              className="wb13-card wb13-card-readable"
                            >
                              <div className="wb13-card-main">
                                <div className="wb13-card-title">${i.name||i.slug}</div>
                                <div className="wb13-card-copy">
                                  ${[i.lead?`Lead: ${i.lead}`:"",i.openIssueCount?`${i.openIssueCount} open`:""].filter(Boolean).join(" \xB7 ")||"Active project"}
                                </div>
                              </div>
                            </div>`)}
                      </div>
                    `:a`<div className="wb13-allclear" data-testid="workbench-jarvis-unconfigured">
                    jarvis is not connected yet. Add the jarvis credential to surface your
                    commitments, projects, and decisions here.
                  </div>`}
        </div>
      </div>
    </main>
  `}export{I as JarvisView};
