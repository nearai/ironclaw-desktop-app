import{a as c}from"./chunk-4INX7S4N.js";import{b as w,c as a}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";function u(e={}){let t=[],n=Number(e.awaitingReply)||0,i=Number(e.flagged)||0,s=Number(e.weeklySignals)||0;return n&&t.push(`${n} awaiting your reply`),i&&t.push(`${i} flagged for you`),s&&t.push(`${s} weekly ${s===1?"signal":"signals"}`),t.length?t.join(" \xB7 "):"You're all clear \u2014 nothing needs you right now."}function p({items:e}){let t=(Array.isArray(e)?e:[]).filter(Boolean);return t.length?a`<span className="wb13-brief-rowmeta">${t.join(" \xB7 ")}</span>`:null}function f(e){let t=String(e||"");try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).catch(()=>{});return}}catch{}try{let n=document.createElement("textarea");n.value=t,n.setAttribute("readonly",""),n.style.position="absolute",n.style.left="-9999px",document.body.appendChild(n),n.select(),document.execCommand("copy"),document.body.removeChild(n)}catch{}}function $({item:e,onDraftReply:t}){let[n,i]=w.default.useState(e.suggestedReply||""),s=!!(e.suggestedReply||"").trim(),o=e.source==="Slack",b=o?[e.channel?`#${e.channel}`:"Slack",e.sender].filter(Boolean).join(" \xB7 "):[e.source,e.sender].filter(Boolean).join(" \xB7 ");return a`
    <div className="wb13-brief-row wb13-brief-needsyou" data-testid="workbench-brief-needsyou-item">
      <div className="wb13-brief-rowmain wb13-brief-needsyou-main">
        <span className="wb13-brief-rowtitle">${b||"Needs you"}</span>
        <${p} items=${e.badges} />
        ${e.context?a`<span className="wb13-brief-rowmeta">${e.context}</span>`:null}
        ${s?a`<textarea
                aria-label="Suggested reply"
                className="wb13-approve-textarea wb13-brief-reply"
                data-testid="workbench-brief-reply"
                rows="3"
                value=${n}
                onInput=${r=>i(r.currentTarget.value)}
              ></textarea>
              <div className="wb13-brief-replyactions">
                ${o?a`${e.replyHref?a`<a
                            className="wb13-button is-primary is-sm"
                            data-testid="workbench-brief-replyslack"
                            href=${e.replyHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Opens the Slack thread. Nothing is posted."
                          >
                            Reply in Slack
                          </a>`:null}
                      <button
                        type="button"
                        className="wb13-button is-sm"
                        data-testid="workbench-brief-copyreply"
                        title="Copies the suggested reply. Nothing is posted."
                        onClick=${()=>f(n)}
                      >
                        Copy reply
                      </button>`:typeof t=="function"?a`<button
                        type="button"
                        className="wb13-button is-primary is-sm"
                        data-testid="workbench-brief-savedraft"
                        title="Opens a reviewable Gmail draft. Nothing is sent."
                        onClick=${()=>t({item:e,body:n})}
                      >
                        Save as draft
                      </button>`:null}
                ${e.bestWindow?a`<span className="wb13-brief-rowmeta">Best: ${e.bestWindow}</span>`:null}
              </div>`:null}
      </div>
      ${e.replyHref&&!o?a`<a
            className="wb13-brief-rowlink"
            href=${e.replyHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open to reply"
            title="Open to reply"
          >
            <${c} name="external" />
          </a>`:null}
    </div>
  `}function y({item:e}){let t=[e.channel?`#${e.channel}`:"","you weren\u2019t tagged"].filter(Boolean).join(" \xB7 "),n=a`
    <span className="wb13-brief-rowtitle">${e.title}</span>
    ${t?a`<span className="wb13-brief-rowmeta">${t}</span>`:null}
    ${e.whyYours?a`<span className="wb13-brief-rowmeta">Why yours: ${e.whyYours}</span>`:null}
    ${e.myTake?a`<span className="wb13-brief-rowmeta">Take (pressure-test): ${e.myTake}</span>`:null}
    ${Number.isFinite(e.confidence)?a`<span className="wb13-brief-rowmeta">confidence ${e.confidence}%</span>`:null}
  `;return e.link?a`<a
      className="wb13-brief-row wb13-brief-row-static"
      data-testid="workbench-brief-weighin"
      href=${e.link}
      target="_blank"
      rel="noopener noreferrer"
      >${n}<span className="wb13-brief-rowlink"><${c} name="external" /></span
    ></a>`:a`<div
    className="wb13-brief-row wb13-brief-row-static"
    data-testid="workbench-brief-weighin"
  >
    ${n}
  </div>`}function h({item:e}){return a`<div
    className="wb13-brief-row wb13-brief-row-static"
    data-testid="workbench-brief-week"
  >
    <span className="wb13-brief-rowtitle">
      ${e.priority==="high"?a`<span className="wb13-brief-prio" aria-hidden="true"></span>`:null}
      ${e.title}
    </span>
    ${e.yourMove?a`<span className="wb13-brief-rowmeta">Your move: ${e.yourMove}</span>`:null}
  </div>`}function m({item:e}){let t=[e.person,e.window].filter(Boolean).join(" \u2014 ");return a`<div
    className="wb13-brief-row wb13-brief-row-static"
    data-testid="workbench-brief-besttime"
  >
    <span className="wb13-brief-rowtitle">${t}</span>
  </div>`}function d({icon:e,title:t,count:n,testid:i,children:s}){return a`
    <div className="wb13-brief-section" data-testid=${i}>
      <div className="wb13-brief-sectiontitle">
        <${c} name=${e} />
        <span>${t}</span>
        ${n?a`<span className="wb13-brief-sectioncount">${n}</span>`:null}
      </div>
      ${s}
    </div>
  `}function N({briefing:e,onDraftReply:t,onDismiss:n}){if(!e||typeof e!="object")return null;let i=Array.isArray(e.needsYou)?e.needsYou:[],s=Array.isArray(e.worthWeighingIn)?e.worthWeighingIn:[],o=Array.isArray(e.thisWeek)?e.thisWeek:[],b=Array.isArray(e.bestTimes)?e.bestTimes:[];return a`
    <section
      className="wb13-brief wb13-brief-rich"
      data-testid="workbench-brief"
      aria-label="Daily briefing"
    >
      <div className="wb13-brief-head">
        <div className="wb13-brief-icon"><${c} name="spark" /></div>
        <div className="wb13-brief-headline">
          <div className="wb13-brief-eyebrow">Daily briefing · updated just now</div>
          <h2>${u(e.summary)}</h2>
          ${e.intro?a`<div className="wb13-brief-intro wb13-brief-rowmeta">${e.intro}</div>`:null}
        </div>
        ${typeof n=="function"?a`<button
              type="button"
              className="wb13-brief-dismiss"
              aria-label="Dismiss briefing"
              onClick=${n}
            >
              <${c} name="close" />
            </button>`:null}
      </div>

      <div className="wb13-brief-grid">
        ${i.length?a`<${d}
              icon="mail"
              title="Needs you"
              count=${i.length}
              testid="workbench-brief-needsyou"
            >
              ${i.map((r,l)=>a`<${$}
                    key=${r.id||l}
                    item=${r}
                    onDraftReply=${t}
                  />`)}
            <//>`:null}
        ${s.length?a`<${d}
              icon="spark"
              title="Worth weighing in"
              count=${s.length}
              testid="workbench-brief-weighin-section"
            >
              ${s.map((r,l)=>a`<${y} key=${r.id||l} item=${r} />`)}
            <//>`:null}
        ${o.length?a`<${d}
              icon="calendar"
              title="This week"
              count=${o.length}
              testid="workbench-brief-week-section"
            >
              ${o.map((r,l)=>a`<${h} key=${r.id||l} item=${r} />`)}
            <//>`:null}
        ${b.length?a`<${d}
              icon="clock"
              title="Best times"
              testid="workbench-brief-besttimes-section"
            >
              ${b.map((r,l)=>a`<${m} key=${l} item=${r} />`)}
            <//>`:null}
      </div>

      <div className="wb13-brief-foot">
        <${c} name="shield" />
        <span>Synthesized from your connected tools. Reads stay private — nothing was sent.</span>
      </div>
    </section>
  `}export{N as WorkbenchBrief,u as briefSummaryLine};
