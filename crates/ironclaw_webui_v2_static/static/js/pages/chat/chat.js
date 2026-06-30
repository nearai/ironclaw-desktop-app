import { React, html } from '../../lib/html.js';
import {
  THREAD_STATE,
  clearThreadState,
  setThreadState,
  useThreadStates
} from '../../lib/thread-state.js';
import {
  clearThreadAttentionDetail,
  setThreadAttentionDetail,
  threadAttentionDetailFromGate
} from '../../lib/thread-attention-details.js';
import { ApprovalCard } from './components/approval-card.js';
import { AuthGenericCard } from './components/auth-generic-card.js';
import { AuthOauthCard } from './components/auth-oauth-card.js';
import { AuthTokenCard } from './components/auth-token-card.js';
import { ChannelConnectCard } from './components/channel-connect-card.js';
import { ChatInput } from './components/chat-input.js';
import { ConnectionStatus } from './components/connection-status.js';
import { EmptyState } from './components/empty-state.js';
import { KeyboardShortcuts } from './components/keyboard-shortcuts.js';
import { MessageList } from './components/message-list.js';
import { RecoveryNotice } from './components/recovery-notice.js';
import { TypingIndicator } from './components/typing-indicator.js';
import { useChat } from './hooks/useChat.js';
import { NEW_DRAFT_KEY } from './lib/draft-store.js';
import { buildRuntimeContext } from './lib/runtime-context.js';

// Retry is intentionally not wired. Re-sending a failed turn cannot honestly
// restore its attachment bytes (the error row keeps only chip metadata) and the
// gateway exposes no resend endpoint, so a Retry button would be a dead
// affordance — which the design laws forbid. message-bubble renders the button
// only when onRetry is provided, so passing null keeps it hidden until a real
// content+attachment-preserving retry exists.
const RETRY_NOT_WIRED = null;
const THREAD_STATE_CLEAR_GRACE_MS = 1500;

export function Chat({
  threads,
  activeThreadId,
  onSelectThread,
  isCreatingThread,
  composerDraft = '',
  composerResetKey = '',
  draftKeyScope = '',
  gatewayStatus,
  onRunSnapshot
}) {
  const {
    messages,
    isProcessing,
    pendingGate,
    channelConnectAction,
    sseStatus,
    historyLoading,
    hasMore,
    cooldownSeconds,
    recoveryNotice,
    activeRun,
    send,
    cancelRun,
    approve,
    recoverHistory,
    loadMore,
    submitAuthToken,
    dismissChannelConnectAction
  } = useChat(activeThreadId);
  const threadStates = useThreadStates();

  const activeThread = React.useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || null,
    [threads, activeThreadId]
  );
  const runtimeContext = React.useMemo(
    () => buildRuntimeContext({ gatewayStatus, activeThread }),
    [gatewayStatus, activeThread]
  );
  const hasMessages =
    messages.length > 0 || isProcessing || Boolean(pendingGate) || Boolean(channelConnectAction);
  const showLanding = !historyLoading && !hasMessages;
  const composerDisabled = (isProcessing && !pendingGate) || cooldownSeconds > 0;
  const composerStatusText = cooldownSeconds > 0 ? `Retry in ${cooldownSeconds}s` : undefined;
  const composerDraftKey =
    activeThreadId || (draftKeyScope ? `${NEW_DRAFT_KEY}:${draftKeyScope}` : NEW_DRAFT_KEY);
  const canCancelRun = Boolean(
    activeThreadId &&
    activeRun?.runId &&
    activeRun.threadId === activeThreadId &&
    isProcessing &&
    !pendingGate
  );

  const handleSend = React.useCallback(
    async (content, { images = [], attachments = [] } = {}) => {
      const response = await send(content, {
        images,
        attachments,
        threadId: activeThreadId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      const responseThreadId = response?.thread_id || activeThreadId;
      if (!activeThreadId && responseThreadId && onSelectThread) {
        onSelectThread(responseThreadId, { replace: true });
      }
      return response;
    },
    [activeThreadId, onSelectThread, send]
  );

  const handleCancelRun = React.useCallback(() => cancelRun('user_requested'), [cancelRun]);

  React.useEffect(() => {
    if (!onRunSnapshot) return;
    const runId = activeRun?.runId || null;
    const status = pendingGate
      ? 'needs_attention'
      : isProcessing
        ? 'running'
        : historyLoading
          ? 'loading'
          : 'idle';
    onRunSnapshot({
      threadId: activeThreadId || null,
      status,
      isProcessing,
      pendingGate: Boolean(pendingGate),
      historyLoading,
      runId,
      taskName: pendingGate ? 'Approval gate' : isProcessing ? 'Chat turn' : null,
      sidecarName: 'Reborn sidecar',
      sseStatus,
      canCancel: canCancelRun,
      cancelRun: canCancelRun ? handleCancelRun : null,
      lastEvent: pendingGate
        ? 'Waiting for your decision'
        : isProcessing
          ? runId
            ? `Run ${runId.slice(0, 8)} is active`
            : 'Turn is running'
          : historyLoading
            ? 'Loading thread history'
            : null,
      updatedAt: new Date().toISOString()
    });
  }, [
    activeRun?.runId,
    activeThreadId,
    canCancelRun,
    handleCancelRun,
    historyLoading,
    isProcessing,
    onRunSnapshot,
    pendingGate,
    sseStatus
  ]);

  React.useEffect(() => () => onRunSnapshot?.(null), [onRunSnapshot]);

  /* Mirror the active thread's lifecycle into the per-thread state store
   * so the sidebar row reflects what's happening on the open thread:
   *
   *   pendingGate                   → NEEDS_ATTENTION (amber)
   *   isProcessing && !pendingGate  → RUNNING (green)
   *   neither                       → clear (idle)
   *
   * Priority is pendingGate-first because a gate logically subsumes
   * processing — the run is paused waiting on the user, not actively
   * working.
   *
   * Clearing is deferred briefly: opening a thread resets pendingGate before
   * SSE rehydrates it, so an immediate clear would wipe a persisted attention
   * badge and restore it a beat later. Incoming gate/run state cancels the
   * pending clear; genuinely idle threads still clear promptly.
   *
   * Coverage gap (writer is per-active-thread only): this seam only
   * flags whichever thread the user is currently viewing. Cross-thread
   * visibility — the green/amber dot appearing on background threads
   * — requires either a user-scoped SSE channel or list_threads state
   * enrichment. Both are deferred follow-ups; see
   * docs/webui-v2-followup-picks-02-05.md. */
  React.useEffect(() => {
    if (!activeThreadId) return undefined;
    if (pendingGate) {
      setThreadState(activeThreadId, THREAD_STATE.NEEDS_ATTENTION);
      setThreadAttentionDetail(activeThreadId, threadAttentionDetailFromGate(pendingGate));
      return undefined;
    }
    if (isProcessing) {
      setThreadState(activeThreadId, THREAD_STATE.RUNNING);
      clearThreadAttentionDetail(activeThreadId);
      return undefined;
    }
    const timer = setTimeout(() => {
      clearThreadState(activeThreadId);
      clearThreadAttentionDetail(activeThreadId);
    }, THREAD_STATE_CLEAR_GRACE_MS);
    return () => clearTimeout(timer);
  }, [activeThreadId, pendingGate, isProcessing]);

  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  React.useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShortcutsOpen(false);
        return;
      }
      if (event.key !== '?') return;
      const target = event.target;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      event.preventDefault();
      setShortcutsOpen((open) => !open);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return html`
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <${ConnectionStatus} status=${sseStatus} />

        ${showLanding &&
        html`
          <${EmptyState}
            threads=${threads}
            threadStates=${threadStates}
            onSend=${handleSend}
            disabled=${composerDisabled}
            initialText=${composerDraft}
            resetKey=${composerResetKey}
            draftKey=${composerDraftKey}
            context=${runtimeContext}
            statusText=${composerStatusText}
            canCancel=${canCancelRun}
            onCancel=${handleCancelRun}
          />
        `}
        ${!showLanding &&
        html`
          <${MessageList}
            messages=${messages}
            isLoading=${historyLoading}
            hasMore=${hasMore}
            onLoadMore=${loadMore}
            onRetryMessage=${RETRY_NOT_WIRED}
            threadId=${activeThreadId}
          >
            ${recoveryNotice &&
            html` <${RecoveryNotice} notice=${recoveryNotice} onRecover=${recoverHistory} /> `}
            ${isProcessing && !pendingGate && html`<${TypingIndicator} />`}
            ${channelConnectAction &&
            html`
              <${ChannelConnectCard}
                connectAction=${channelConnectAction}
                onDismiss=${dismissChannelConnectAction}
              />
            `}
            ${pendingGate &&
            (pendingGate.kind === 'auth_required'
              ? pendingGate.challengeKind === 'oauth_url'
                ? html`
                    <${AuthOauthCard}
                      gate=${pendingGate}
                      onCancel=${() => approve(pendingGate.requestId, 'cancel', pendingGate.kind)}
                    />
                  `
                : pendingGate.challengeKind === 'manual_token'
                  ? html`
                      <${AuthTokenCard}
                        gate=${pendingGate}
                        onSubmit=${submitAuthToken}
                        onCancel=${() => approve(pendingGate.requestId, 'cancel', pendingGate.kind)}
                      />
                    `
                  : html`
                      <${AuthGenericCard}
                        gate=${pendingGate}
                        onCancel=${() => approve(pendingGate.requestId, 'cancel', pendingGate.kind)}
                      />
                    `
              : html`
                  <${ApprovalCard}
                    gate=${pendingGate}
                    onApprove=${() => approve(pendingGate.requestId, 'approve', pendingGate.kind)}
                    onDeny=${() => approve(pendingGate.requestId, 'deny', pendingGate.kind)}
                    onAlways=${() => approve(pendingGate.requestId, 'always', pendingGate.kind)}
                  />
                `)}
          <//>

          <${ChatInput}
            onSend=${handleSend}
            disabled=${composerDisabled}
            initialText=${composerDraft}
            resetKey=${composerResetKey}
            draftKey=${composerDraftKey}
            context=${runtimeContext}
            statusText=${composerStatusText}
            canCancel=${canCancelRun}
            onCancel=${handleCancelRun}
          />
        `}
      </div>
      <${KeyboardShortcuts} open=${shortcutsOpen} onClose=${() => setShortcutsOpen(false)} />
    </div>
  `;
}
