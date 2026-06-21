import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { Icon } from '../../../design-system/icons.js';
import { fetchTimeline } from '../../../lib/api.js';
import { React, html } from '../../../lib/html.js';
import { cn } from '../../../utils/cn.js';
import { messagesFromTimeline } from '../../chat/lib/history-messages.js';
import { actionRows, outputHint } from '../lib/workbench-scenes-registry.js';
import { WorkbenchRunTimeline } from './workbench-run-timeline.js';

function cleanText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function SceneSummary({ work }) {
  return html`
    <div className=${cn('wb13-scene-summary', `is-${work.scene.id}`)}>
      <div className="wb13-scene-mark"><${Icon} name="pulse" /></div>
      <div>
        <div className="wb13-scene-kicker">${work.scene.label}</div>
        <h2>${work.scene.title}</h2>
        <p>${work.scene.detail}</p>
      </div>
      <${Link}
        to=${`/chat/${encodeURIComponent(work.threadId)}`}
        className="wb13-button is-primary"
      >
        Open live thread
      <//>
    </div>
  `;
}

function SceneActionRows({ sceneId }) {
  return html`
    <div className="wb13-scene-rows">
      ${actionRows(sceneId).map(
        ([title, detail, state]) => html`
          <div key=${title} className="wb13-scene-row">
            <span className="wb13-row-icon"
              ><${Icon}
                name=${state === 'Blocked' ? 'flag' : state === 'Scheduled' ? 'clock' : 'shield'}
            /></span>
            <span>
              <span className="wb13-row-title">${title}</span>
              <span className="wb13-row-copy">${detail}</span>
            </span>
            <span
              className=${cn(
                'wb13-scene-state',
                state === 'Blocked' && 'is-blocked',
                state === 'Approval' && 'is-approval'
              )}
            >
              ${state}
            </span>
          </div>
        `
      )}
    </div>
  `;
}

function preferenceRows(work) {
  const preferences = work?.preferences || {};
  return [
    ['Model', preferences.model || 'Active NEAR AI Cloud model'],
    ['Effort', preferences.effort || 'Standard'],
    ['Sources', preferences.sources || 'Auto sources'],
    ['Timing', preferences.timing || 'Not specified']
  ];
}

function latestMessage(messages, role) {
  return [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find((message) => message?.role === role && cleanText(message.content));
}

function hasRenderableRun(messages) {
  return (Array.isArray(messages) ? messages : []).some((message) => {
    if (!message) return false;
    if (message.role === 'tool_activity') return true;
    if (message.role === 'user' || message.role === 'assistant') {
      return Boolean(String(message.content || '').trim());
    }
    return false;
  });
}

function TimelinePreview({ work, timelineQuery }) {
  const messages = React.useMemo(
    () => messagesFromTimeline(timelineQuery.data?.messages || [], []),
    [timelineQuery.data]
  );
  const user = latestMessage(messages, 'user');

  if (hasRenderableRun(messages)) {
    const running = !latestMessage(messages, 'assistant');
    return html`
      <div className="wb13-runtime-preview" data-testid="workbench-live-thread-preview">
        <div className="wb13-runtime-preview-head">
          <${Icon} name="pulse" />
          <span>Live run</span>
          ${running
            ? html`<span className="wb13-run-live" data-testid="workbench-run-live">Working…</span>`
            : null}
        </div>
        <${WorkbenchRunTimeline} messages=${messages} />
        <${Link} to=${`/chat/${encodeURIComponent(work.threadId)}`} className="wb13-button is-sm">
          Review full thread
        <//>
      </div>
    `;
  }

  if (timelineQuery.isError) {
    return html`
      <div className="wb13-runtime-state is-warning">
        <${Icon} name="flag" />
        <span>
          <strong>Live preview unavailable.</strong>
          Open the live thread to inspect the run. Workbench will not invent a draft without the
          timeline.
        </span>
      </div>
    `;
  }

  return html`
    <div className="wb13-runtime-state">
      <${Icon} name="shield" />
      <span>
        <strong>${user ? 'Runtime accepted the request.' : 'Waiting on the live thread.'}</strong>
        ${user
          ? 'The request is in the registered Chat timeline. Assistant output will appear here when it lands.'
          : `When the thread returns ${outputHint(work.scene.id)}, they will appear here for review.`}
      </span>
    </div>
  `;
}

function RuntimeWorkspace({ work, timelineQuery }) {
  return html`
    <div className="wb13-scene-grid">
      <div className="wb13-scene-panel">
        <div className="wb13-scene-title">Current request</div>
        <p className="wb13-scene-copy">${cleanText(work.title, 'Workbench request')}</p>
        <${TimelinePreview} work=${work} timelineQuery=${timelineQuery} />
        <div className="wb13-source-card is-hold">
          <${Icon} name="shield" />
          <strong>External actions still need approval.</strong>
          <p>
            Sending, posting, filing, or changing another system remains owned by the live approval
            gate.
          </p>
          <span>Workbench mirrors live outputs only after the Chat timeline records them.</span>
        </div>
      </div>
      <div className="wb13-scene-panel">
        <div className="wb13-scene-title">Preferences sent</div>
        <div className="wb13-pref-list">
          ${preferenceRows(work).map(
            ([label, value]) => html`
              <div key=${label} className="wb13-pref-row">
                <span>${label}</span>
                <strong>${value}</strong>
              </div>
            `
          )}
        </div>
        <${Link} to=${`/chat/${encodeURIComponent(work.threadId)}`} className="wb13-button is-sm">
          Continue in live thread
        <//>
      </div>
    </div>
  `;
}

function SceneBody({ work, timelineQuery }) {
  return html`<${RuntimeWorkspace} work=${work} timelineQuery=${timelineQuery} />`;
}

export function WorkbenchSceneWorkspace({ work }) {
  const threadId = work?.threadId || '';
  const timelineQuery = useQuery({
    queryKey: ['workbench-live-thread-preview', threadId],
    queryFn: () => fetchTimeline({ threadId, limit: 20 }),
    enabled: Boolean(threadId),
    staleTime: 2_000,
    refetchInterval: 5_000,
    retry: 1
  });

  if (!work) return null;

  return html`
    <section className="wb13-section wb13-scene" data-testid="workbench-scene-workspace">
      <${SceneSummary} work=${work} />
      <${SceneActionRows} sceneId=${work.scene.id} />
      <${SceneBody} work=${work} timelineQuery=${timelineQuery} />
    </section>
  `;
}
