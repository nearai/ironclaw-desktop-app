import { gateFromProjection } from './gates.js';
import { failureMessageForRunStatus } from './failureMessages.js';
import { toolCardFromActivity } from './history-messages.js';
import { upsertRunFailureMessage } from './message-upsert.js';
import { upsertToolActivityMessage } from './tool-activity-state.js';

const TERMINAL_RUN_STATUSES = new Set([
  'completed',
  'succeeded',
  'failed',
  'cancelled',
  'recovery_required'
]);

const SUCCESS_RUN_STATUSES = new Set(['completed', 'succeeded']);
const PROMPT_RUN_STATUSES = new Set(['blocked_auth', 'blocked_approval', 'blocked_resource']);

export function settleRun({ settledRunsRef, onRunSettled, onRunCompleted, runId, success }) {
  if (!runId || !settledRunsRef?.current) return;
  if (settledRunsRef.current.has(runId)) return;
  settledRunsRef.current.add(runId);
  onRunSettled?.(runId, { success });
  if (success) onRunCompleted?.(runId);
}

export function applyProjectionItems({
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
}) {
  const context = {
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
  };
  // Snapshot the run_id surfaced by the most recent `run_status` item
  // we've seen; gate projection items do not carry a run_id, but the
  // resolve URL needs both run_id and gate_ref.
  let activeRunId = latestRunIdRef?.current ?? null;
  for (const item of items) {
    const runStatusResult = applyProjectionRunStatus(item.run_status, activeRunId, context);
    activeRunId = runStatusResult.activeRunId;
    if (runStatusResult.skipItem) continue;

    applyProjectionText(item.text, context);
    applyProjectionThinking(item.thinking, context);
    applyProjectionCapabilityActivity(item.capability_activity, context);
    applyProjectionGate(item.gate, activeRunId, context);
    applyProjectionSkillActivation(item.skill_activation, context);
  }
  if (latestRunIdRef && activeRunId) {
    latestRunIdRef.current = activeRunId;
  }
}

function applyProjectionRunStatus(runStatus, activeRunId, context) {
  if (!runStatus) return projectionResult(activeRunId);

  const details = describeProjectionRunStatus(runStatus, activeRunId, context);
  if (details.isStaleLocalRunStatus) {
    return projectionResult(activeRunId, true);
  }
  if (details.isStaleTerminalStatus) {
    return applyStaleTerminalRunStatus(details, activeRunId, context);
  }
  if (details.locallyResolvedPromptState) {
    return applyLocallyResolvedPromptRunStatus(details, context);
  }
  return applyCurrentProjectionRunStatus(details, activeRunId, context);
}

function describeProjectionRunStatus(runStatus, activeRunId, context) {
  const { activeRunRef, latestRunIdRef, locallyResolvedGatesRef } = context;
  const {
    run_id: runId,
    status,
    failure_category: failureCategory,
    failure_summary: failureSummary
  } = runStatus;
  const isTerminalStatus = TERMINAL_RUN_STATUSES.has(status);
  const locallyPinnedRunId =
    activeRunRef?.current?.source === 'local' ? activeRunRef.current.runId : null;
  const streamActiveRunId = activeRunId ?? latestRunIdRef?.current ?? null;
  return {
    runId,
    status,
    failureCategory,
    failureSummary,
    isTerminalStatus,
    isPromptStatus: PROMPT_RUN_STATUSES.has(status),
    isStaleLocalRunStatus: Boolean(runId && locallyPinnedRunId && locallyPinnedRunId !== runId),
    isStaleTerminalStatus: Boolean(
      isTerminalStatus && runId && streamActiveRunId && streamActiveRunId !== runId
    ),
    locallyResolvedPromptState:
      runId && PROMPT_RUN_STATUSES.has(status)
        ? locallyResolvedStateForRun(locallyResolvedGatesRef, runId)
        : null
  };
}

function applyStaleTerminalRunStatus(details, activeRunId, context) {
  const {
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
    locallyResolvedGatesRef
  } = context;
  const activePromptRunId = activeRunRef?.current?.runId;
  const activeResolvedPromptState = locallyResolvedStateForRun(
    locallyResolvedGatesRef,
    activePromptRunId
  );
  if (activeResolvedPromptState?.outcome !== 'resumed') {
    return projectionResult(activeRunId, true);
  }
  settleTerminalRunAfterResolvedPrompt({
    runId: details.runId,
    activePromptRunId,
    success: SUCCESS_RUN_STATUSES.has(details.status),
    status: details.status,
    failureCategory: details.failureCategory,
    failureSummary: details.failureSummary,
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
    locallyResolvedGatesRef
  });
  return projectionResult(null, true);
}

function applyLocallyResolvedPromptRunStatus(details, context) {
  const {
    threadId,
    setIsProcessing,
    setPendingGate,
    setActiveRun,
    latestRunIdRef,
    promptRunIdRef,
    activeRunRef
  } = context;
  const { runId, locallyResolvedPromptState } = details;
  clearPendingGateForRun(setPendingGate, runId, promptRunIdRef);
  if (locallyResolvedPromptState.outcome === 'resumed') {
    setIsProcessing(true);
    setActiveRun?.((current) =>
      current && current.runId === runId
        ? {
            ...current,
            status: current.status === 'awaiting_gate' ? 'queued' : current.status || 'queued'
          }
        : { runId, threadId, status: 'queued' }
    );
    if (latestRunIdRef) latestRunIdRef.current = runId;
    return projectionResult(runId, true);
  }

  setIsProcessing(false);
  if (activeRunRef?.current?.runId === runId) {
    setActiveRun?.(null);
  }
  if (latestRunIdRef?.current === runId) latestRunIdRef.current = null;
  return projectionResult(null, true);
}

function applyCurrentProjectionRunStatus(details, activeRunId, context) {
  const {
    threadId,
    setIsProcessing,
    setPendingGate,
    setActiveRun,
    latestRunIdRef,
    promptRunIdRef,
    locallyResolvedGatesRef
  } = context;
  const { runId, status, isTerminalStatus, isPromptStatus } = details;
  let nextActiveRunId = activeRunId;

  if (runId) {
    nextActiveRunId = runId;
    if (!isTerminalStatus && latestRunIdRef) {
      latestRunIdRef.current = runId;
    }
    setActiveRun?.((current) =>
      current && current.runId === runId ? { ...current, status } : { runId, threadId, status }
    );
  }

  trackPromptRunStatus(runId, isPromptStatus, promptRunIdRef);

  if (isTerminalStatus) {
    return finishTerminalProjectionRun(details, context);
  }
  if (!isPromptStatus) {
    clearPendingGateForRun(setPendingGate, runId, promptRunIdRef);
    clearLocallyResolvedRun(locallyResolvedGatesRef, runId);
    setIsProcessing(true);
  }
  return projectionResult(nextActiveRunId);
}

function trackPromptRunStatus(runId, isPromptStatus, promptRunIdRef) {
  if (runId && isPromptStatus) {
    if (promptRunIdRef) promptRunIdRef.current = runId;
  } else if (runId && promptRunIdRef?.current === runId) {
    promptRunIdRef.current = null;
  }
}

function finishTerminalProjectionRun(details, context) {
  const {
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
    locallyResolvedGatesRef
  } = context;
  const { runId, status, failureCategory, failureSummary } = details;
  setIsProcessing(false);
  setPendingGate(null);
  setActiveRun?.(null);
  clearLocallyResolvedRun(locallyResolvedGatesRef, runId);
  if (latestRunIdRef) latestRunIdRef.current = null;
  if (runId && promptRunIdRef?.current === runId) {
    promptRunIdRef.current = null;
  }
  settleRun({
    settledRunsRef,
    onRunSettled,
    onRunCompleted,
    runId,
    success: SUCCESS_RUN_STATUSES.has(status)
  });
  if (status === 'failed' || status === 'recovery_required') {
    appendRunFailureMessage(setMessages, onRunFailed, {
      runId,
      status,
      failureCategory,
      failureSummary
    });
  }
  return projectionResult(null);
}

function applyProjectionText(text, { setMessages, setIsProcessing }) {
  if (!text) return;
  upsertProjectionMessage(setMessages, {
    id: `text-${text.id}`,
    role: 'assistant',
    content: text.body || '',
    timestamp: new Date().toISOString(),
    isFinalReply: true
  });
  setIsProcessing(false);
}

function applyProjectionThinking(thinking, { setMessages }) {
  if (!thinking) return;
  upsertProjectionMessage(setMessages, {
    id: `thinking-${thinking.id}`,
    role: 'thinking',
    content: thinking.body || '',
    timestamp: new Date().toISOString(),
    turnRunId: thinking.run_id || null
  });
}

function applyProjectionCapabilityActivity(activity, { setMessages, toolActivityStateRef }) {
  if (!activity?.invocation_id) return;
  upsertToolActivityMessage(setMessages, toolCardFromActivity(activity), toolActivityStateRef);
}

function applyProjectionGate(
  gate,
  activeRunId,
  { setIsProcessing, setPendingGate, promptRunIdRef, locallyResolvedGatesRef }
) {
  if (!gate) return;
  if (
    activeRunId &&
    promptRunIdRef?.current === activeRunId &&
    !isLocallyResolvedGate(locallyResolvedGatesRef, activeRunId, gate.gate_ref)
  ) {
    const pending = gateFromProjection(activeRunId, gate);
    if (pending) setPendingGate((current) => current || pending);
    setIsProcessing(false);
  }
}

function applyProjectionSkillActivation(skillActivation, { setMessages }) {
  if (!skillActivation) return;
  const { id, skill_names: skillNames = [], feedback = [] } = skillActivation;
  if (!skillNames.length && !feedback.length) return;
  const messageId = `skill-${id || skillNames.join('-') || 'activation'}`;
  const content = [
    skillNames.length ? `Skill activated: ${skillNames.join(', ')}` : '',
    ...feedback
  ]
    .filter(Boolean)
    .join('\n');
  setMessages((prev) => {
    if (prev.some((message) => message.id === messageId)) return prev;
    return [
      ...prev,
      {
        id: messageId,
        role: 'system',
        content,
        timestamp: new Date().toISOString()
      }
    ];
  });
}

function upsertProjectionMessage(setMessages, next) {
  setMessages((prev) => {
    const existing = prev.findIndex((message) => message.id === next.id);
    if (existing >= 0) {
      const copy = [...prev];
      copy[existing] = next;
      return copy;
    }
    return [...prev, next];
  });
}

function settleTerminalRunAfterResolvedPrompt({
  runId,
  activePromptRunId,
  success,
  status,
  failureCategory,
  failureSummary,
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
  locallyResolvedGatesRef
}) {
  setIsProcessing(false);
  setPendingGate(null);
  setActiveRun?.(null);
  clearLocallyResolvedRun(locallyResolvedGatesRef, activePromptRunId);
  if (latestRunIdRef) latestRunIdRef.current = null;
  if (promptRunIdRef?.current === activePromptRunId) {
    promptRunIdRef.current = null;
  }
  settleRun({ settledRunsRef, onRunSettled, onRunCompleted, runId, success });
  if (status === 'failed' || status === 'recovery_required') {
    appendRunFailureMessage(setMessages, onRunFailed, {
      runId,
      status,
      failureCategory,
      failureSummary
    });
  }
}

export function appendRunFailureMessage(
  setMessages,
  onRunFailed,
  { runId, status, failureCategory, failureSummary }
) {
  const content = failureMessageForRunStatus({
    status,
    failureCategory,
    failureSummary
  });
  upsertRunFailureMessage(setMessages, {
    runId,
    content,
    source: 'run_status',
    timestamp: new Date().toISOString()
  });
  onRunFailed?.({ runId, status, failureCategory, failureSummary, content });
}

function clearPendingGateForRun(setPendingGate, runId, promptRunIdRef) {
  if (!runId) return;
  if (promptRunIdRef?.current === runId) {
    promptRunIdRef.current = null;
  }
  setPendingGate((current) => (current?.runId === runId ? null : current));
}

function locallyResolvedStateForRun(locallyResolvedGatesRef, runId) {
  if (!runId) return null;
  const resolved = locallyResolvedGatesRef?.current;
  if (!resolved) return null;
  for (const [key, value] of resolved.entries()) {
    if (!key.startsWith(`${runId}\n`)) continue;
    return normalizeLocallyResolvedState(value);
  }
  return null;
}

function normalizeLocallyResolvedState(value) {
  if (value && typeof value === 'object') {
    return {
      resolution: value.resolution || null,
      outcome: value.outcome || null
    };
  }
  return { resolution: value || null, outcome: null };
}

function clearLocallyResolvedRun(locallyResolvedGatesRef, runId) {
  if (!runId) return;
  const resolved = locallyResolvedGatesRef?.current;
  if (!resolved) return;
  for (const key of Array.from(resolved.keys())) {
    if (key.startsWith(`${runId}\n`)) resolved.delete(key);
  }
}

function isLocallyResolvedGate(locallyResolvedGatesRef, runId, gateRef) {
  if (!runId || !gateRef) return false;
  return Boolean(locallyResolvedGatesRef?.current?.has(`${runId}\n${gateRef}`));
}

function projectionResult(activeRunId, skipItem = false) {
  return { activeRunId, skipItem };
}
