import { React } from '../../../lib/html.js';
import { gateFromEvent } from './gates.js';
import {
  appendRunFailureMessage,
  applyProjectionItems,
  settleRun
} from './chat-event-projection.js';
import { toolCardFromActivity, toolCardFromPreview } from './history-messages.js';
import { ensureGateToolActivity, upsertToolActivityMessage } from './tool-activity-state.js';

// Handler factory for v2 `WebChatV2EventFrame` events.
//
// The current local-dev runtime ONLY emits `projection_snapshot` and
// `projection_update` over the WebUI stream (the typed `accepted` /
// `running` / `final_reply` / `gate` / `failed` variants are
// scaffolded in the schema but never published by the runtime-owned
// projection bridge today). The handler therefore drives the UI off
// the projection items rather than the typed variants — see
// `ironclaw_product_adapters::outbound::ProductProjectionItem` for
// the item shapes.
//
// Items are externally-tagged enums so each entry carries exactly
// one of `{ run_status, thinking, text, gate }` as a sub-object.
//
// Status mapping (from `RunStatus.status`):
//   "queued" | "running"           → processing
//   "completed" | "succeeded"      → stop, no error
//   "failed" | "cancelled"
//   | "recovery_required"          → stop, error / recovery state
//
// The typed branches are still handled for forwards-compat if the
// runtime starts emitting them.
export function useChatEvents({
  threadId,
  setMessages,
  setIsProcessing,
  setPendingGate,
  setActiveRun,
  activeRunRef,
  locallyResolvedGatesRef,
  toolActivityStateRef,
  onRunSettled,
  onRunCompleted,
  onRunFailed
}) {
  // Track which runIds we've already settled so that SSE replays
  // (reconnect with `last-event-id`, repeated snapshots) don't trigger
  // duplicate timeline refetches. A run settles on any terminal status,
  // not only success — every terminal run reloads the timeline so tool
  // input/output previews are recovered from the durable record even when
  // the run failed, was cancelled, or needs recovery.
  const settledRunsRef = React.useRef(new Set());
  // Last `run_status.run_id` we've observed, persisted across event
  // frames. Used by `applyProjectionItems` to correlate an `item.gate`
  // (which doesn't carry `run_id`) with the active run so resolveGate
  // can build its `/runs/{run_id}/gates/{gate_ref}/resolve` URL.
  const latestRunIdRef = React.useRef(null);
  const promptRunIdRef = React.useRef(null);

  return React.useCallback(
    (envelope) => {
      const { type, frame } = envelope || {};
      if (!type || !frame) return;

      switch (type) {
        case 'accepted': {
          handleAcceptedFrame({
            frame,
            threadId,
            setActiveRun,
            setIsProcessing,
            latestRunIdRef
          });
          return;
        }

        case 'running':
        case 'capability_progress': {
          handleRunningFrame({
            frame,
            threadId,
            setActiveRun,
            setIsProcessing,
            setPendingGate,
            latestRunIdRef,
            promptRunIdRef
          });
          return;
        }

        case 'capability_activity': {
          handleCapabilityActivityFrame({ frame, setMessages, toolActivityStateRef });
          return;
        }

        case 'capability_display_preview': {
          handleCapabilityDisplayPreviewFrame({ frame, setMessages, toolActivityStateRef });
          return;
        }

        case 'gate':
        case 'auth_required': {
          handleGateFrame({
            type,
            frame,
            threadId,
            setMessages,
            setIsProcessing,
            setPendingGate,
            setActiveRun,
            toolActivityStateRef
          });
          return;
        }

        case 'final_reply': {
          handleFinalReplyFrame({ frame, setMessages, setIsProcessing, setPendingGate });
          return;
        }

        case 'cancelled': {
          handleCancelledFrame({
            frame,
            setIsProcessing,
            setPendingGate,
            setActiveRun,
            activeRunRef,
            settledRunsRef,
            onRunSettled,
            onRunCompleted
          });
          return;
        }

        case 'failed': {
          handleFailedFrame({
            frame,
            setMessages,
            setIsProcessing,
            setPendingGate,
            setActiveRun,
            activeRunRef,
            settledRunsRef,
            onRunSettled,
            onRunCompleted,
            onRunFailed
          });
          return;
        }

        case 'projection_snapshot':
        case 'projection_update': {
          const items = frame.state?.items || [];
          applyProjectionItems({
            items,
            threadId,
            setMessages,
            setIsProcessing,
            setPendingGate,
            setActiveRun,
            onRunSettled,
            onRunCompleted,
            onRunFailed,
            settledRunsRef,
            latestRunIdRef,
            promptRunIdRef,
            activeRunRef,
            locallyResolvedGatesRef,
            toolActivityStateRef
          });
          return;
        }

        case 'keep_alive':
        default:
          return;
      }
    },
    [
      threadId,
      setMessages,
      setIsProcessing,
      setPendingGate,
      setActiveRun,
      activeRunRef,
      locallyResolvedGatesRef,
      toolActivityStateRef,
      onRunSettled,
      onRunCompleted,
      onRunFailed
    ]
  );
}

function handleAcceptedFrame({ frame, threadId, setActiveRun, setIsProcessing, latestRunIdRef }) {
  const ack = frame.ack || {};
  if (ack.run_id) latestRunIdRef.current = ack.run_id;
  setActiveRun?.({
    runId: ack.run_id || null,
    threadId: ack.thread_id || threadId,
    status: ack.status || null
  });
  setIsProcessing(true);
}

function handleRunningFrame({
  frame,
  threadId,
  setActiveRun,
  setIsProcessing,
  setPendingGate,
  latestRunIdRef,
  promptRunIdRef
}) {
  const progress = frame.progress || {};
  if (progress.turn_run_id) {
    latestRunIdRef.current = progress.turn_run_id;
    setActiveRun?.((current) =>
      current && current.runId === progress.turn_run_id
        ? current
        : { runId: progress.turn_run_id, threadId, status: 'running' }
    );
    clearPendingNonAuthGateForRun(setPendingGate, progress.turn_run_id, promptRunIdRef);
  }
  setIsProcessing(true);
}

function handleCapabilityActivityFrame({ frame, setMessages, toolActivityStateRef }) {
  // Lifecycle metadata for a capability invocation. Used to render a
  // "running" placeholder card before a richer display preview arrives.
  const activity = frame.activity;
  if (!activity || !activity.invocation_id) return;
  upsertToolActivityMessage(setMessages, toolCardFromActivity(activity), toolActivityStateRef);
}

function handleCapabilityDisplayPreviewFrame({ frame, setMessages, toolActivityStateRef }) {
  // Final sanitized display artifact for a capability invocation.
  const preview = frame.preview;
  if (!preview || !preview.invocation_id) return;
  upsertToolActivityMessage(setMessages, toolCardFromPreview(preview), toolActivityStateRef);
}

function handleGateFrame({
  type,
  frame,
  threadId,
  setMessages,
  setIsProcessing,
  setPendingGate,
  setActiveRun,
  toolActivityStateRef
}) {
  const pending = gateFromEvent(type, frame.prompt);
  if (pending) {
    ensureGateToolActivity(setMessages, pending, toolActivityStateRef);
    setPendingGate(pending);
    setActiveRun?.({
      runId: pending.runId,
      threadId,
      status: 'awaiting_gate'
    });
  }
  setIsProcessing(false);
}

function handleFinalReplyFrame({ frame, setMessages, setIsProcessing, setPendingGate }) {
  const reply = frame.reply || {};
  setMessages((prev) => [
    ...prev,
    {
      id: `reply-${reply.turn_run_id || Date.now()}`,
      role: 'assistant',
      content: reply.text || '',
      timestamp: reply.generated_at || new Date().toISOString(),
      turnRunId: reply.turn_run_id,
      isFinalReply: true
    }
  ]);
  setPendingGate(null);
  setIsProcessing(false);
}

function handleCancelledFrame({
  frame,
  setIsProcessing,
  setPendingGate,
  setActiveRun,
  activeRunRef,
  settledRunsRef,
  onRunSettled,
  onRunCompleted
}) {
  const runId = frame.run_state?.run_id || activeRunRef?.current?.runId || null;
  setPendingGate(null);
  setIsProcessing(false);
  setActiveRun?.(null);
  settleRun({ settledRunsRef, onRunSettled, onRunCompleted, runId, success: false });
}

function handleFailedFrame({
  frame,
  setMessages,
  setIsProcessing,
  setPendingGate,
  setActiveRun,
  activeRunRef,
  settledRunsRef,
  onRunSettled,
  onRunCompleted,
  onRunFailed
}) {
  const runState = frame.run_state || {};
  const runId = runState.run_id || activeRunRef?.current?.runId || null;
  setPendingGate(null);
  setIsProcessing(false);
  setActiveRun?.(null);
  appendRunFailureMessage(setMessages, onRunFailed, {
    runId,
    status: runState.status || 'failed',
    failureCategory: failureCategoryFromRunState(runState),
    failureSummary: null
  });
  settleRun({ settledRunsRef, onRunSettled, onRunCompleted, runId, success: false });
}

function clearPendingNonAuthGateForRun(setPendingGate, runId, promptRunIdRef) {
  if (!runId) return;
  setPendingGate((current) => {
    if (current?.runId !== runId || current.kind === 'auth_required') {
      return current;
    }
    if (promptRunIdRef?.current === runId) {
      promptRunIdRef.current = null;
    }
    return null;
  });
}

function failureCategoryFromRunState(runState) {
  const failure = runState?.failure;
  if (typeof failure === 'string' && failure.trim()) return failure.trim();
  if (
    failure &&
    typeof failure === 'object' &&
    typeof failure.category === 'string' &&
    failure.category.trim()
  ) {
    return failure.category.trim();
  }
  return null;
}
