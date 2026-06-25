import{e as c,u as l}from"./chunk-D5SGDLDR.js";import{a as m}from"./chunk-KN3NV7CC.js";import{a as o}from"./chunk-4INX7S4N.js";import{c as s}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";async function v(){let e=await l("/api/jarvis/summary");return{configured:!!(e&&e.configured),error:String(e&&e.error||""),projects:Array.isArray(e&&e.projects)?e.projects:[],outstanding:Array.isArray(e&&e.outstanding)?e.outstanding:[],commitments:Array.isArray(e&&e.commitments)?e.commitments:[]}}function u(e){let n=(Array.isArray(e)?e:[]).filter(t=>t&&t.state&&t.state!=="done"&&t.state!=="canceled"),r=t=>t.needsApproval||t.state==="needs_approval"?0:1;return n.slice().sort((t,d)=>r(t)-r(d))}function p(e){return{needs_approval:"Needs approval",todo:"To do",in_progress:"In progress",blocked:"Blocked",done:"Done",canceled:"Canceled"}[String(e||"")]||String(e||"").replace(/_/g," ")||"Open"}function w(e){return e.needsApproval||e.state==="needs_approval"?"is-decision":e.state==="blocked"?"is-blocked":e.state==="done"?"is-done":e.state==="in_progress"?"is-working":"is-reply"}function g(e){let a=String(e||"").trim();return a?`Due ${a.slice(0,10)}`:""}function N({commitment:e}){let a=[e.shortId,g(e.dueDate)].filter(Boolean).join(" \xB7 ");return s`
    <div className="wb13-card wb13-card-readable">
      <div className="wb13-card-main">
        <div className="wb13-card-status">
          <span className=${m("wb13-status-pill",w(e))}>
            ${p(e.state)}
          </span>
          ${a?s`<span className="wb13-card-when">${a}</span>`:null}
        </div>
        <div className="wb13-card-title">${e.title||"Untitled commitment"}</div>
      </div>
    </div>
  `}function b({items:e,testid:a}){return s`<div className="wb13-section wb13-list" data-testid=${a}>
    ${e.map(n=>s`<${N} key=${n.id||n.shortId} commitment=${n} />`)}
  </div>`}function S(){let e=c({queryKey:["workbench-jarvis-summary"],queryFn:v,staleTime:6e4,retry:1,throwOnError:!1}),a=e.data||{configured:!1,projects:[],outstanding:[],commitments:[]},n=e.isLoading,r=a.outstanding||[],t=u(a.commitments),d=a.projects||[];return s`
    <main className="wb13-main">
      <div className="wb13-page">
        <div className="wb13-wrap">
          <div className="wb13-triage-head">
            <h2>Projects</h2>
            <span className="count">jarvis · pm-backend</span>
          </div>

          ${n?s`<div className="wb13-section wb13-list" data-testid="workbench-jarvis-skeleton">
                ${[0,1,2].map(i=>s`<div key=${i} className="wb13-card wb13-skel-card">
                      <div className="wb13-card-main">
                        <div className="wb13-skel-line is-pill"></div>
                        <div className="wb13-skel-line is-title"></div>
                      </div>
                    </div>`)}
              </div>`:a.configured?a.error?s`<div className="wb13-reader-note is-error" role="alert">
                    <${o} name="flag" /><span>jarvis could not be reached: ${a.error}</span>
                  </div>`:s`
                    <div className="wb13-section-label">
                      <${o} name="check" /> Owed to you
                      <span className="wb13-section-count">${r.length}</span>
                    </div>
                    ${r.length?s`<${b}
                          items=${r}
                          testid="workbench-jarvis-outstanding"
                        />`:s`<div className="wb13-allclear">
                          Nobody owes you an open commitment right now.
                        </div>`}

                    <div className="wb13-section-label">
                      <${o} name="spark" /> Your commitments
                      <span className="wb13-section-count">${t.length}</span>
                    </div>
                    ${t.length?s`<${b}
                          items=${t}
                          testid="workbench-jarvis-commitments"
                        />`:s`<div className="wb13-allclear">
                          No open commitments assigned to you.
                        </div>`}

                    <div className="wb13-section-label">
                      <${o} name="folder" /> Projects
                      <span className="wb13-section-count">${d.length}</span>
                    </div>
                    <div className="wb13-section wb13-list" data-testid="workbench-jarvis-projects">
                      ${d.map(i=>s`<div key=${i.id||i.slug} className="wb13-card wb13-card-readable">
                            <div className="wb13-card-main">
                              <div className="wb13-card-title">${i.name||i.slug}</div>
                              <div className="wb13-card-copy">
                                ${[i.lead?`Lead: ${i.lead}`:"",i.openIssueCount?`${i.openIssueCount} open`:""].filter(Boolean).join(" \xB7 ")||"Active project"}
                              </div>
                            </div>
                          </div>`)}
                    </div>
                  `:s`<div className="wb13-allclear" data-testid="workbench-jarvis-unconfigured">
                  jarvis is not connected yet. Add the jarvis credential to surface your
                  commitments, projects, and decisions here.
                </div>`}
        </div>
      </div>
    </main>
  `}export{S as JarvisView};
