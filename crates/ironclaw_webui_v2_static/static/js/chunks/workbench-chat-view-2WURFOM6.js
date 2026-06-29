import{d as T,h as y,j as S,l as g,m as A,o as x,p as C,q as W}from"./chunk-A5SZBTKI.js";import{a as w}from"./chunk-KN3NV7CC.js";import{e as v,y as N,z as R}from"./chunk-UB2NMU7V.js";import{a as s}from"./chunk-4INX7S4N.js";import{b as u,c as a}from"./chunk-IG4LZQG4.js";import"./chunk-NAT75VSJ.js";function p(e){return String(e||"").trim()}function D(e){return e==="success"?{label:"Done",tone:"good"}:e==="error"?{label:"Failed",tone:"danger"}:{label:"Running",tone:"run"}}function K({message:e}){return a`
    <li className="wb13-run-row is-user">
      <span className="wb13-run-marker" aria-hidden="true"><${s} name="spark" /></span>
      <div className="wb13-run-body">
        <div className="wb13-run-role">You asked</div>
        <p className="wb13-run-text">${p(e.content)}</p>
      </div>
    </li>
  `}function U({message:e}){let t=D(e.toolStatus),n=p(e.toolDetail)||p(e.toolParameters),o=e.toolError?p(e.toolError):p(e.toolResultPreview);return a`
    <li className=${w("wb13-run-row is-tool",e.toolError&&"is-failed")}>
      <span className="wb13-run-marker" aria-hidden="true"><${s} name="tool" /></span>
      <div className="wb13-run-body">
        <div className="wb13-run-tool">
          <span className="wb13-run-tool-name">${e.toolName||"tool"}</span>
          <span className=${w("wb13-run-status",`is-${t.tone}`)}>${t.label}</span>
        </div>
        ${n?a`<p className="wb13-run-text is-meta">${n}</p>`:null}
        ${o?a`<p className="wb13-run-text is-result">${o}</p>`:null}
      </div>
    </li>
  `}function q({message:e}){return a`
    <li className="wb13-run-row is-assistant">
      <span className="wb13-run-marker" aria-hidden="true"><${s} name="pulse" /></span>
      <div className="wb13-run-body">
        <div className="wb13-run-role">IronClaw</div>
        <${S} content=${p(e.content)} className="wb13-run-text" />
      </div>
    </li>
  `}function P(e){return e?e.role==="tool_activity"?!0:e.role==="user"||e.role==="assistant"?!!p(e.content):!1:!1}function I({messages:e}){let t=(Array.isArray(e)?e:[]).filter(P);return t.length?a`
    <ol className="wb13-run" data-testid="workbench-run-timeline">
      ${t.map(n=>n.role==="tool_activity"?a`<${U} key=${n.id} message=${n} />`:n.role==="user"?a`<${K} key=${n.id} message=${n} />`:a`<${q} key=${n.id} message=${n} />`)}
    </ol>
  `:null}function k(e,t=""){return String(e||"").trim()||t}function G(e,t){return[...Array.isArray(e)?e:[]].reverse().find(n=>n?.role===t&&k(n.content))}function Q(e){return(Array.isArray(e)?e:[]).some(t=>t?t.role==="tool_activity"?!0:t.role==="user"||t.role==="assistant"?!!String(t.content||"").trim():!1:!1)}function H(e){return e?e.role==="tool_activity"?`tool:${e.invocationId||e.callId||e.id||""}`:e.id||`${e.role||"message"}:${e.sequence||""}:${e.content||""}`:""}function M(e){return e?e.role==="user"?10:e.role==="thinking"?20:e.role==="tool_activity"?30:e.role==="assistant"?40:e.role==="error"?50:90:99}function E(e){let t=Date.parse(e?.updatedAt||e?.timestamp||"");return Number.isFinite(t)?t:null}function L(e,t){let n=y(e?.toolStatus),o=y(t?.toolStatus);if(n&&!o)return e;if(o&&!n)return{...e,...t,id:e.id||t.id};let r=E(e),i=E(t);return r!==null&&i!==null&&r>i?e:{...e,...t,id:e.id||t.id}}function O(e=[],t=[]){let n=[],o=new Map;for(let r of[...e,...t]){let i=H(r);if(i&&o.has(i)){let l=o.get(i);n[l]=r?.role==="tool_activity"?L(n[l],r):n[l];continue}i&&o.set(i,n.length),n.push(r)}return n.map((r,i)=>({message:r,index:i})).sort((r,i)=>M(r.message)-M(i.message)||r.index-i.index).map(({message:r})=>r)}function Y(e,t){let n=k(t);if(!n)return e;let o=!1;return e.map(r=>!o&&r&&r.role==="user"?(o=!0,{...r,content:n}):r)}function $({attention:e=!1}){return e?a`<div
      className="wb13-chat-working is-attention"
      data-testid="workbench-run-attention"
    >
      <${s} name="flag" />
      <span>A step needs your attention — reply below to steer it.</span>
    </div>`:a`<div className="wb13-chat-working" data-testid="workbench-run-live">
    <span className="wb13-typing" aria-hidden="true"><i></i><i></i><i></i></span>
    <span>Thinking…</span>
  </div>`}function z({work:e,timelineQuery:t,liveMessages:n}){let o=u.default.useMemo(()=>{let i=T(t.data?.messages||[],[]),l=O(i,n);return Y(l,e?.title)},[t.data,n,e]);if(Q(o)){let i=G(o,"assistant"),l=o.some(d=>d&&d.role==="tool_activity"&&(d.toolError||d.toolStatus==="error"));return a`
      <div className="wb13-chat-thread" data-testid="workbench-live-thread-preview">
        <${I} messages=${o} />
        ${!i&&!l?a`<${$} />`:null}
        ${l&&!i?a`<${$} attention=${!0} />`:null}
      </div>
    `}if(t.isError)return a`
      <div className="wb13-runtime-state is-warning">
        <${s} name="flag" />
        <span>
          <strong>Live preview unavailable.</strong>
          The run is still attached; the reply appears here the moment the timeline returns.
        </span>
      </div>
    `;let r=k(e?.title);return a`
    <div className="wb13-chat-thread" data-testid="workbench-live-thread-preview">
      ${r?a`<ol className="wb13-run">
            <li className="wb13-run-row is-user">
              <span className="wb13-run-marker" aria-hidden="true"><${s} name="spark" /></span>
              <div className="wb13-run-body">
                <div className="wb13-run-role">You asked</div>
                <p className="wb13-run-text">${r}</p>
              </div>
            </li>
          </ol>`:null}
      <${$} />
    </div>
  `}function Z({approvals:e}){let t=Array.isArray(e)?e:[];return t.length?a`
    <div className="wb13-run-gates" data-testid="workbench-run-approvals">
      <div className="wb13-run-gates-head">
        <${s} name="shield" />
        <span>Waiting on your approval</span>
        <span className="wb13-run-gates-count">${t.length}</span>
      </div>
      ${t.map(n=>a`
          <div key=${n.id} className="wb13-run-gate">
            <span className="wb13-run-gate-icon"><${s} name=${n.icon||"shield"} /></span>
            <div className="wb13-run-gate-body">
              <div className="wb13-run-gate-title">${n.title}</div>
              ${n.detail?a`<div className="wb13-run-gate-detail">${n.detail}</div>`:null}
            </div>
          </div>
        `)}
    </div>
  `:null}function j({threadId:e,onSent:t}){let[n,o]=u.default.useState(""),[r,i]=u.default.useState(!1),[l,f]=u.default.useState(""),d=async()=>{let c=n.trim();if(!(!c||r||!e)){i(!0),f("");try{let b="UTC";try{b=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}catch{b="UTC"}await N({threadId:e,content:c,timezone:b}),o(""),typeof t=="function"&&t()}catch{f("Could not send that. Try again.")}finally{i(!1)}}};return a`
    <form
      className="wb13-run-composer"
      onSubmit=${c=>{c.preventDefault(),d()}}
    >
      <textarea
        className="wb13-approve-textarea"
        rows="2"
        data-testid="workbench-run-composer"
        aria-label="Continue this conversation"
        placeholder="Reply or ask a follow-up — it stays here in the Workbench."
        value=${n}
        onInput=${c=>o(c.currentTarget.value)}
        onKeyDown=${c=>{c.key==="Enter"&&(c.metaKey||c.ctrlKey)&&(c.preventDefault(),d())}}
      ></textarea>
      <div className="wb13-run-composer-row">
        <span className="x">⌘↵ to send · stays in the Workbench</span>
        <button
          type="submit"
          className="wb13-button is-primary is-sm"
          data-testid="workbench-run-send"
          disabled=${!n.trim()||r}
        >
          ${r?"Sending\u2026":"Send"}
        </button>
      </div>
      ${l?a`<div className="wb13-reader-note is-error" role="alert">
            <${s} name="flag" /><span>${l}</span>
          </div>`:null}
    </form>
  `}function _({work:e}){let t=e?.threadId||"",[n,o]=u.default.useState([]),r=u.default.useRef(null),i=u.default.useRef(null),l=u.default.useRef(new Map),f=u.default.useRef(g()),d=u.default.useCallback(()=>{},[]),c=u.default.useCallback(m=>{r.current=typeof m=="function"?m(r.current):m},[]),b=u.default.useCallback(m=>{i.current=typeof m=="function"?m(i.current):m},[]),h=v({queryKey:["workbench-live-thread-preview",t],queryFn:()=>R({threadId:t,limit:20}),enabled:!!t,staleTime:2e3,refetchInterval:5e3,retry:1}),F=x({threadId:t,setMessages:o,setIsProcessing:d,setPendingGate:b,setActiveRun:c,activeRunRef:r,locallyResolvedGatesRef:l,toolActivityStateRef:f,onRunSettled:()=>h.refetch(),onRunCompleted:()=>{},onRunFailed:()=>{}});u.default.useEffect(()=>{o([]),r.current=null,i.current=null,l.current=new Map,A(f)},[t]),C({threadId:t,onEvent:F,enabled:!!t});let B=v({queryKey:["workbench-run-approvals",t],queryFn:({signal:m})=>W({threadId:t,signal:m}),enabled:!!t,staleTime:2e3,refetchInterval:5e3,retry:1,throwOnError:!1});return e?a`
    <section className="wb13-section wb13-chat" data-testid="workbench-scene-workspace">
      <${z}
        work=${e}
        timelineQuery=${h}
        liveMessages=${n}
      />
      <${Z} approvals=${B.data||[]} />
      <${j} threadId=${t} onSent=${()=>h.refetch()} />
      <div className="wb13-chat-guard">
        <${s} name="shield" />
        <span
          >Reads and drafts stay here. Sending, posting, or changing another system needs your
          approval.</span
        >
      </div>
    </section>
  `:null}function we({work:e,onView:t}){let n=!!(e&&e.threadId),o=r=>typeof t=="function"&&t(r);return a`
    <main className="wb13-main">
      <div className="wb13-page">
        <div className=${n?"wb13-wrap is-wide":"wb13-wrap"}>
          ${n?a`<${_} work=${e} />`:a`
                <div className="wb13-chat-empty" data-testid="workbench-chat-empty">
                  <div className="wb13-chat-empty-mark" aria-hidden="true">
                    <${s} name="chat" />
                  </div>
                  <h1>Start a conversation</h1>
                  <p>
                    Ask IronClaw anything from the Work tab — it opens here as a full conversation,
                    and everything you ask is saved to History.
                  </p>
                  <div className="wb13-chat-empty-cta">
                    <button
                      type="button"
                      className="wb13-button is-sm is-primary"
                      onClick=${()=>o("home")}
                    >
                      <${s} name="folder" /> Go to Work
                    </button>
                    <button
                      type="button"
                      className="wb13-button is-sm"
                      onClick=${()=>o("history")}
                    >
                      <${s} name="pulse" /> History
                    </button>
                  </div>
                </div>
              `}
        </div>
      </div>
    </main>
  `}export{we as ChatView};
