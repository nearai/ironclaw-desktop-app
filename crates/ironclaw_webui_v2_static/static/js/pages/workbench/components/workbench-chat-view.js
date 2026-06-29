import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';
import { WorkbenchSceneWorkspace } from './workbench-scenes.js';

// A dedicated conversation surface. Asking in the Work tab — or reopening a thread from
// History — opens the conversation HERE, as its own full-width surface, instead of the
// cramped inline strip the run used to render below triage. The surface is a pure
// function of work.threadId, so reopening from History rehydrates the real timeline.
// Honest empty state when nothing is open: never a blank page, and it points at the two
// ways a conversation starts (ask in Work / pick one up from History).
export function ChatView({ work, onView }) {
  const hasWork = Boolean(work && work.threadId);
  const go = (target) => typeof onView === 'function' && onView(target);
  return html`
    <main className="wb13-main">
      <div className="wb13-page">
        <div className=${hasWork ? 'wb13-wrap is-wide' : 'wb13-wrap'}>
          ${hasWork
            ? html`<${WorkbenchSceneWorkspace} work=${work} />`
            : html`
                <div className="wb13-head"><h1>Chat</h1></div>
                <div className="wb13-allclear" data-testid="workbench-chat-empty">
                  No conversation open yet. Ask IronClaw anything from the Work tab — it opens here
                  as a full conversation, and everything you ask is saved to History.
                  <div className="wb13-allclear-cta">
                    <button
                      type="button"
                      className="wb13-button is-sm is-primary"
                      onClick=${() => go('home')}
                    >
                      <${Icon} name="folder" /> Go to Work
                    </button>
                    <button
                      type="button"
                      className="wb13-button is-sm"
                      onClick=${() => go('history')}
                    >
                      <${Icon} name="pulse" /> History
                    </button>
                  </div>
                </div>
              `}
        </div>
      </div>
    </main>
  `;
}
