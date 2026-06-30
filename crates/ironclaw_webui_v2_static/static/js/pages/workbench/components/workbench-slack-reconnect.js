import { Icon } from '../../../design-system/icons.js';
import { html } from '../../../lib/html.js';

// Honest "Reconnect Slack" card. Shown when a Slack account is on file but no longer ACTIVE, so
// Slack threads aren't being read — instead of leaving the Slack sections silently empty (which
// reads as "nothing happening"), this names the real cause and offers the reconnect flow. The CTA
// opens the existing sources panel; no token handling happens in the browser.
export function WorkbenchSlackReconnect({ onReconnect }) {
  return html`
    <div className="wb13-reconnect" data-testid="workbench-slack-reconnect" role="status">
      <style>
        .wb13-reconnect {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          max-width: 560px;
          margin: 4px 0;
          padding: 14px 16px;
          border: 1px solid var(--wb-warn-line, var(--wb-line));
          border-radius: 14px;
          background: var(--wb-warn-soft, var(--wb-surface));
        }
        .wb13-reconnect-icon {
          width: 20px;
          height: 20px;
          flex: none;
          color: var(--wb-warn-text, var(--wb-muted));
          margin-top: 1px;
        }
        .wb13-reconnect-body {
          flex: 1;
          min-width: 0;
        }
        .wb13-reconnect-title {
          font-weight: 650;
          font-size: 14px;
          color: var(--wb-ink);
          margin-bottom: 3px;
        }
        .wb13-reconnect-sub {
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--wb-muted);
        }
        .wb13-reconnect button {
          flex: none;
          align-self: center;
        }
      </style>
      <span className="wb13-reconnect-icon" aria-hidden="true"><${Icon} name="chat" /></span>
      <div className="wb13-reconnect-body">
        <div className="wb13-reconnect-title">Slack needs reconnecting</div>
        <div className="wb13-reconnect-sub">
          Your Slack connection expired, so Slack threads aren't being read right now. Reconnect to
          bring them back.
        </div>
      </div>
      <button
        type="button"
        className="wb13-button is-sm"
        data-testid="workbench-slack-reconnect-cta"
        onClick=${onReconnect}
      >
        Reconnect Slack
      </button>
    </div>
  `;
}
