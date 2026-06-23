import{a as l}from"./chunk-FOJK5G5S.js";import{i as d,j as a}from"./chunk-NLGAQ5GP.js";function f(e={}){let n=[],r=Number(e.awaitingReply)||0,t=Number(e.flagged)||0,s=Number(e.weeklySignals)||0;return r&&n.push(`${r} awaiting your reply`),t&&n.push(`${t} flagged for you`),s&&n.push(`${s} weekly ${s===1?"signal":"signals"}`),n.length?n.join(" \xB7 "):"You're all clear \u2014 nothing needs you right now."}function u({items:e}){let n=(Array.isArray(e)?e:[]).filter(Boolean);return n.length?a`<span className="wb13-brief-rowmeta">${n.join(" \xB7 ")}</span>`:null}function p({item:e,onDraftReply:n}){let[r,t]=d.default.useState(e.suggestedReply||""),s=!!(e.suggestedReply||"").trim(),b=[e.source,e.sender].filter(Boolean).join(" \xB7 ");return a`
    <div className="wb13-brief-row wb13-brief-needsyou" data-testid="workbench-brief-needsyou-item">
      <div className="wb13-brief-rowmain wb13-brief-needsyou-main">
        <span className="wb13-brief-rowtitle">${b||"Needs you"}</span>
        <${u} items=${e.badges} />
        ${e.context?a`<span className="wb13-brief-rowmeta">${e.context}</span>`:null}
        ${s?a`<textarea
                aria-label="Suggested reply"
                className="wb13-approve-textarea wb13-brief-reply"
                data-testid="workbench-brief-reply"
                rows="3"
                value=${r}
                onInput=${c=>t(c.currentTarget.value)}
              ></textarea>
              <div className="wb13-brief-replyactions">
                ${typeof n=="function"?a`<button
                      type="button"
                      className="wb13-button is-primary is-sm"
                      data-testid="workbench-brief-savedraft"
                      title="Opens a reviewable Gmail draft. Nothing is sent."
                      onClick=${()=>n({item:e,body:r})}
                    >
                      Save as draft
                    </button>`:null}
                ${e.bestWindow?a`<span className="wb13-brief-rowmeta">Best: ${e.bestWindow}</span>`:null}
              </div>`:null}
      </div>
      ${e.replyHref?a`<a
            className="wb13-brief-rowlink"
            href=${e.replyHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open to reply"
            title="Open to reply"
          >
            <${l} name="external" />
          </a>`:null}
    </div>
  `}function $({item:e}){let n=[e.channel?`#${e.channel}`:"","you weren\u2019t tagged"].filter(Boolean).join(" \xB7 "),r=a`
    <span className="wb13-brief-rowtitle">${e.title}</span>
    ${n?a`<span className="wb13-brief-rowmeta">${n}</span>`:null}
    ${e.whyYours?a`<span className="wb13-brief-rowmeta">Why yours: ${e.whyYours}</span>`:null}
    ${e.myTake?a`<span className="wb13-brief-rowmeta">My take: ${e.myTake}</span>`:null}
    ${Number.isFinite(e.confidence)?a`<span className="wb13-brief-rowmeta">confidence ${e.confidence}%</span>`:null}
  `;return e.link?a`<a
      className="wb13-brief-row wb13-brief-row-static"
      data-testid="workbench-brief-weighin"
      href=${e.link}
      target="_blank"
      rel="noopener noreferrer"
      >${r}<span className="wb13-brief-rowlink"><${l} name="external" /></span
    ></a>`:a`<div
    className="wb13-brief-row wb13-brief-row-static"
    data-testid="workbench-brief-weighin"
  >
    ${r}
  </div>`}function h({item:e}){return a`<div
    className="wb13-brief-row wb13-brief-row-static"
    data-testid="workbench-brief-week"
  >
    <span className="wb13-brief-rowtitle">
      ${e.priority==="high"?a`<span className="wb13-brief-prio" aria-hidden="true"></span>`:null}
      ${e.title}
    </span>
    ${e.yourMove?a`<span className="wb13-brief-rowmeta">Your move: ${e.yourMove}</span>`:null}
  </div>`}function y({item:e}){let n=[e.person,e.window].filter(Boolean).join(" \u2014 ");return a`<div
    className="wb13-brief-row wb13-brief-row-static"
    data-testid="workbench-brief-besttime"
  >
    <span className="wb13-brief-rowtitle">${n}</span>
  </div>`}function w({icon:e,title:n,count:r,testid:t,children:s}){return a`
    <div className="wb13-brief-section" data-testid=${t}>
      <div className="wb13-brief-sectiontitle">
        <${l} name=${e} />
        <span>${n}</span>
        ${r?a`<span className="wb13-brief-sectioncount">${r}</span>`:null}
      </div>
      ${s}
    </div>
  `}function g({briefing:e,onDraftReply:n,onDismiss:r}){if(!e||typeof e!="object")return null;let t=Array.isArray(e.needsYou)?e.needsYou:[],s=Array.isArray(e.worthWeighingIn)?e.worthWeighingIn:[],b=Array.isArray(e.thisWeek)?e.thisWeek:[],c=Array.isArray(e.bestTimes)?e.bestTimes:[];return a`
    <section
      className="wb13-brief wb13-brief-rich"
      data-testid="workbench-brief"
      aria-label="Daily briefing"
    >
      <div className="wb13-brief-head">
        <div className="wb13-brief-icon"><${l} name="spark" /></div>
        <div className="wb13-brief-headline">
          <div className="wb13-brief-eyebrow">Daily briefing · updated just now</div>
          <h2>${f(e.summary)}</h2>
        </div>
        ${typeof r=="function"?a`<button
              type="button"
              className="wb13-brief-dismiss"
              aria-label="Dismiss briefing"
              onClick=${r}
            >
              <${l} name="close" />
            </button>`:null}
      </div>

      <div className="wb13-brief-grid">
        ${t.length?a`<${w}
              icon="mail"
              title="Needs you"
              count=${t.length}
              testid="workbench-brief-needsyou"
            >
              ${t.map((i,o)=>a`<${p}
                    key=${i.id||o}
                    item=${i}
                    onDraftReply=${n}
                  />`)}
            <//>`:null}
        ${s.length?a`<${w}
              icon="spark"
              title="Worth weighing in"
              count=${s.length}
              testid="workbench-brief-weighin-section"
            >
              ${s.map((i,o)=>a`<${$} key=${i.id||o} item=${i} />`)}
            <//>`:null}
        ${b.length?a`<${w}
              icon="calendar"
              title="This week"
              count=${b.length}
              testid="workbench-brief-week-section"
            >
              ${b.map((i,o)=>a`<${h} key=${i.id||o} item=${i} />`)}
            <//>`:null}
        ${c.length?a`<${w}
              icon="clock"
              title="Best times"
              testid="workbench-brief-besttimes-section"
            >
              ${c.map((i,o)=>a`<${y} key=${o} item=${i} />`)}
            <//>`:null}
      </div>

      <div className="wb13-brief-foot">
        <${l} name="shield" />
        <span>Synthesized from your connected tools. Reads stay private — nothing was sent.</span>
      </div>
    </section>
  `}export{g as WorkbenchBrief,f as briefSummaryLine};
