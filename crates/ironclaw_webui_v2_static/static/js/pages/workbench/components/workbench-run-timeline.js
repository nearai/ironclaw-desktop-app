import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';
import { MarkdownRenderer } from '../../chat/components/markdown-renderer.js';

// Workbench-native run timeline: renders the REAL ordered run on the Workbench
// itself — the prompt, each tool step, and the assistant output — instead of
// only the latest reply with a "open in chat" punt. Rows are backed by the
// durable thread timeline for user/assistant text and by the same replayable
// SSE projection Chat uses for capability activity while /timeline catches up.
// Nothing here is fabricated; an empty or error timeline is handled by the
// caller, not invented into rows.

function cleanText(value) {
  return String(value || '').trim();
}

// A tool step can be running, done, or failed. The status drives a small pill
// tone (the same vocabulary the rest of the Workbench uses: run / good / danger).
function toolStatusMeta(status) {
  if (status === 'success') return { label: 'Done', tone: 'good' };
  if (status === 'error') return { label: 'Failed', tone: 'danger' };
  return { label: 'Running', tone: 'run' };
}

function RunUserRow({ message }) {
  return html`
    <li className="wb13-run-row is-user">
      <span className="wb13-run-marker" aria-hidden="true"><${Icon} name="spark" /></span>
      <div className="wb13-run-body">
        <div className="wb13-run-role">You asked</div>
        <p className="wb13-run-text">${cleanText(message.content)}</p>
      </div>
    </li>
  `;
}

function RunToolRow({ message }) {
  const meta = toolStatusMeta(message.toolStatus);
  const detail = cleanText(message.toolDetail) || cleanText(message.toolParameters);
  const result = message.toolError
    ? cleanText(message.toolError)
    : cleanText(message.toolResultPreview);
  return html`
    <li className=${cn('wb13-run-row is-tool', message.toolError && 'is-failed')}>
      <span className="wb13-run-marker" aria-hidden="true"><${Icon} name="tool" /></span>
      <div className="wb13-run-body">
        <div className="wb13-run-tool">
          <span className="wb13-run-tool-name">${message.toolName || 'tool'}</span>
          <span className=${cn('wb13-run-status', `is-${meta.tone}`)}>${meta.label}</span>
        </div>
        ${detail ? html`<p className="wb13-run-text is-meta">${detail}</p>` : null}
        ${result ? html`<p className="wb13-run-text is-result">${result}</p>` : null}
      </div>
    </li>
  `;
}

function RunAssistantRow({ message }) {
  return html`
    <li className="wb13-run-row is-assistant">
      <span className="wb13-run-marker" aria-hidden="true"><${Icon} name="pulse" /></span>
      <div className="wb13-run-body">
        <div className="wb13-run-role">IronClaw</div>
        <${MarkdownRenderer} content=${cleanText(message.content)} className="wb13-run-text" />
      </div>
    </li>
  `;
}

// Keep only rows that carry something real to show: tool steps always render
// (the name + status is the signal); message rows need text.
function isRenderableRow(message) {
  if (!message) return false;
  if (message.role === 'tool_activity') return true;
  if (message.role === 'user' || message.role === 'assistant') {
    return Boolean(cleanText(message.content));
  }
  return false;
}

export function WorkbenchRunTimeline({ messages }) {
  const rows = (Array.isArray(messages) ? messages : []).filter(isRenderableRow);
  if (!rows.length) return null;

  return html`
    <ol className="wb13-run" data-testid="workbench-run-timeline">
      ${rows.map((message) => {
        if (message.role === 'tool_activity') {
          return html`<${RunToolRow} key=${message.id} message=${message} />`;
        }
        if (message.role === 'user') {
          return html`<${RunUserRow} key=${message.id} message=${message} />`;
        }
        return html`<${RunAssistantRow} key=${message.id} message=${message} />`;
      })}
    </ol>
  `;
}
