import {
  cancelRun as cancelRunRequest,
  createThread as createThreadRequest,
  fetchTimeline,
  getRunState,
  resolveGate as resolveGateRequest,
  sendMessage,
  submitManualToken
} from '../../../lib/api.js';
import { queryClient } from '../../../lib/query-client.js';
import { React } from '../../../lib/html.js';
import { useChatEvents } from '../lib/useChatEvents.js';
import { failureMessageForApiError, failureMessageForRunStatus } from '../lib/failureMessages.js';
import { messagesFromTimeline, pendingMessagesAfterTimeline } from '../lib/history-messages.js';
import { useHistory } from './useHistory.js';
import { useSSE } from './useSSE.js';

const AUTH_TOKEN_FLOW_TIMEOUT_MS = 30000;
const AUTH_GATE_CREDENTIAL_STORED_ERROR = 'credential_stored_gate_resolution_failed';
const TIMELINE_POLL_DELAYS_MS = [300, 700, 1200, 2000, 3200, 5000];
const MISSING_ASSISTANT_REPLY_MESSAGE =
  'IronClaw accepted this turn, but no assistant result arrived from Reborn yet. The stream or run state did not report a completed reply. Your message and attachments are still preserved in this thread.';
const SUCCESS_RUN_STATE_STATUSES = new Set(['completed', 'succeeded']);
const FAILED_RUN_STATE_STATUSES = new Set(['failed', 'cancelled', 'recovery_required']);

async function withAuthTokenTimeout(task) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_TOKEN_FLOW_TIMEOUT_MS);
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

function credentialStoredGateResolutionError(cause) {
  const error = new Error('auth gate resolution failed after credential storage');
  error.safeAuthGateCode = AUTH_GATE_CREDENTIAL_STORED_ERROR;
  error.cause = cause;
  return error;
}

function submitResponseResumedTurnGate(response) {
  return response?.continuation?.type === 'turn_gate_resume';
}

// v2 chat hook. Differences from the fork's v1 hook:
// - No image / attachment plumbing — v2 SendMessage carries `content` only.
// - No /api/chat/approval — approvals fold into gate/resolve in v2.
// - resolveGate uses `runId` + `gateRef` from the live event stream, not
//   a v1-style `requestId`.
// - cancelRun is a first-class action and posts to the v2 cancel route.
export function useChat(threadId) {
  const pendingMessagesRef = React.useRef(new Map());
  const pendingSeqRef = React.useRef(1);
  const currentThreadIdRef = React.useRef(threadId);
  const pollingRunsRef = React.useRef(new Set());
  const [cooldownUntil, setCooldownUntil] = React.useState(0);
  const [now, setNow] = React.useState(Date.now());
  const [activeRun, setActiveRun] = React.useState(null);

  const getPendingMessages = React.useCallback(
    () => adoptPendingMessagesForThread(pendingMessagesRef.current, threadId || '__new__'),
    [threadId]
  );
  const setPendingMessages = React.useCallback(
    (messages) => {
      const key = threadId || '__new__';
      if (messages.length > 0) {
        pendingMessagesRef.current.set(key, messages);
      } else {
        pendingMessagesRef.current.delete(key);
      }
    },
    [threadId]
  );

  const {
    messages,
    hasMore,
    nextCursor,
    isLoading: historyLoading,
    loadHistory,
    setMessages
  } = useHistory(threadId, { getPendingMessages, setPendingMessages });

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [pendingGate, setPendingGate] = React.useState(null);
  const authTokenSubmitRef = React.useRef({
    gateKey: null,
    credentialRef: null,
    inFlight: false
  });

  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const pendingAuthGateKey =
    pendingGate?.runId && pendingGate?.gateRef
      ? `${pendingGate.runId}\n${pendingGate.gateRef}`
      : null;

  React.useEffect(() => {
    currentThreadIdRef.current = threadId;
  }, [threadId]);

  React.useEffect(() => {
    if (!cooldownUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  React.useEffect(() => {
    if (authTokenSubmitRef.current.gateKey !== pendingAuthGateKey) {
      authTokenSubmitRef.current = {
        gateKey: pendingAuthGateKey,
        credentialRef: null,
        inFlight: false
      };
    }
  }, [pendingAuthGateKey]);

  const loadTimelineForThread = React.useCallback(
    async (targetThreadId, { clearPending = false } = {}) => {
      if (!targetThreadId) return [];
      const data = await fetchTimeline({
        threadId: targetThreadId,
        limit: 50
      });
      const records = Array.isArray(data.messages) ? data.messages : data.records || [];
      const pendingMessages = pendingMessagesRef.current.get(targetThreadId) || [];
      const renderable = messagesFromTimeline(records, pendingMessages);
      if (clearPending) {
        const remainingPending = pendingMessagesAfterTimeline(records, pendingMessages);
        if (remainingPending.length > 0) {
          pendingMessagesRef.current.set(targetThreadId, remainingPending);
        } else {
          pendingMessagesRef.current.delete(targetThreadId);
        }
      }
      if (currentThreadIdRef.current === targetThreadId || currentThreadIdRef.current == null) {
        setMessages(renderable);
      }
      return records;
    },
    [setMessages]
  );

  const pollTimelineUntilReply = React.useCallback(
    async (targetThreadId, runId) => {
      if (!targetThreadId) return;
      for (const delay of TIMELINE_POLL_DELAYS_MS) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        try {
          const records = await loadTimelineForThread(targetThreadId);
          const hasAssistantReply = records.some(
            (record) =>
              (record.kind === 'assistant' || record.kind === 'assistant_message') &&
              (!runId || record.turn_run_id === runId)
          );
          if (hasAssistantReply) {
            await loadTimelineForThread(targetThreadId, { clearPending: true });
            setIsProcessing(false);
            setActiveRun(null);
            return;
          }
          if (runId) {
            const terminalRunState = await readTerminalRunState(targetThreadId, runId);
            if (terminalRunState) {
              const status = normalizedRunStatus(terminalRunState?.status);
              if (SUCCESS_RUN_STATE_STATUSES.has(status)) {
                await loadTimelineForThread(targetThreadId, { clearPending: true });
                setIsProcessing(false);
                setActiveRun(null);
                return;
              }
              if (FAILED_RUN_STATE_STATUSES.has(status)) {
                await loadTimelineForThread(targetThreadId, { clearPending: true });
                setMessages((prev) => upsertRunStateFailure(prev, runId, terminalRunState));
                setIsProcessing(false);
                setActiveRun(null);
                return;
              }
            }
          }
        } catch (err) {
          console.warn('Failed to poll timeline after send:', err);
        }
      }
      try {
        await loadTimelineForThread(targetThreadId, { clearPending: true });
      } catch (err) {
        console.warn('Failed final timeline refresh after send:', err);
      }
      if (runId) {
        try {
          const runState = await getRunState({ threadId: targetThreadId, runId });
          const status = normalizedRunStatus(runState?.status);
          if (SUCCESS_RUN_STATE_STATUSES.has(status)) {
            await loadTimelineForThread(targetThreadId, { clearPending: true });
            setIsProcessing(false);
            setActiveRun(null);
            return;
          }
          if (FAILED_RUN_STATE_STATUSES.has(status)) {
            setMessages((prev) => upsertRunStateFailure(prev, runId, runState));
            setIsProcessing(false);
            setActiveRun(null);
            return;
          }
          setActiveRun({
            runId,
            threadId: targetThreadId,
            status: runState?.status || 'unknown'
          });
        } catch (err) {
          console.warn('Failed to read run state after send:', err);
        }
      }
      setMessages((prev) => upsertMissingAssistantReply(prev, runId || targetThreadId));
      setIsProcessing(false);
      setActiveRun(null);
    },
    [loadTimelineForThread, setMessages]
  );

  const startRunPolling = React.useCallback(
    (targetThreadId, runId) => {
      if (!targetThreadId) return;
      const key = `${targetThreadId}\n${runId || 'no-run-id'}`;
      if (pollingRunsRef.current.has(key)) return;
      pollingRunsRef.current.add(key);
      void pollTimelineUntilReply(targetThreadId, runId || null).finally(() => {
        pollingRunsRef.current.delete(key);
      });
    },
    [pollTimelineUntilReply]
  );

  React.useEffect(() => {
    if (!threadId || !activeRun?.runId || activeRun.threadId !== threadId) return;
    startRunPolling(threadId, activeRun.runId);
  }, [threadId, activeRun?.runId, activeRun?.threadId, startRunPolling]);

  const handleEvent = useChatEvents({
    threadId,
    setMessages,
    setIsProcessing,
    setPendingGate,
    setActiveRun,
    // Reborn's projection bridge does not yet emit `Text` items for
    // assistant replies, so the SSE stream only delivers `run_status`.
    // On terminal success, refetch the timeline so the assistant
    // message that landed in the thread becomes visible in the UI.
    onRunCompleted: () => {
      if (threadId) {
        loadTimelineForThread(threadId, { clearPending: true });
      } else {
        loadHistory();
      }
    }
  });

  const { status: sseStatus } = useSSE({
    threadId,
    onEvent: handleEvent,
    enabled: Boolean(threadId)
  });

  // Accepts the fork's call shape `{ images, attachments, threadId,
  // timezone }`. Keep posting inline attachment payloads so Reborn can
  // persist durable attachment context instead of silently discarding files.
  //
  // v2 send-message requires `thread_id` as a path parameter — the
  // facade refuses to implicitly create a missing thread. When the
  // caller is on the landing screen (no active thread yet), we
  // eagerly POST `/threads` first and use the returned id. The
  // returned response carries `thread_id` so the chat.js navigation
  // hook can route to `/chat/<id>` after the first send.
  const send = React.useCallback(
    async (content, opts = {}) => {
      const { threadId: targetThreadId, images = [], attachments = [] } = opts;
      let sendThreadId = targetThreadId || threadId;

      if (!sendThreadId) {
        const created = await createThreadRequest();
        queryClient.invalidateQueries({ queryKey: ['threads'] });
        sendThreadId = created?.thread?.thread_id;
        if (!sendThreadId) {
          throw new Error('createThread returned no thread_id');
        }
      }

      const pendingKey = sendThreadId;
      const pendingRecord = {
        id: `pending-${pendingSeqRef.current++}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
        images: images.map((img) => img.dataUrl).filter(Boolean),
        attachments: attachments.map((att) => ({
          filename: att.filename,
          mime_type: att.mime_type,
          size_label: att.size ? `${att.size} bytes` : ''
        }))
      };
      addPending(pendingMessagesRef.current, pendingKey, pendingRecord);

      const optimisticId = pendingRecord.id;
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          role: 'user',
          content,
          timestamp: pendingRecord.timestamp,
          isOptimistic: true
        }
      ]);

      setIsProcessing(true);
      setPendingGate(null);

      try {
        const response = await sendMessage({
          threadId: sendThreadId,
          content,
          attachments: serializeComposerAttachments([...images, ...attachments])
        });
        const responseThreadId = response?.thread_id || sendThreadId;
        if (responseThreadId !== sendThreadId) {
          movePending(pendingMessagesRef.current, sendThreadId, responseThreadId);
        }
        if (response?.run_id) {
          setActiveRun({
            runId: response.run_id,
            threadId: responseThreadId,
            status: response.status || null
          });
        }
        startRunPolling(responseThreadId, response?.run_id || null);
        return response;
      } catch (err) {
        removePending(pendingMessagesRef.current, pendingKey, optimisticId);
        if (err.status === 429) {
          setCooldownUntil(Date.now() + retryAfterMs(err));
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? {
                  ...m,
                  isOptimistic: false,
                  status: 'error',
                  error: failureMessageForApiError(err)
                }
              : m
          )
        );
        setIsProcessing(false);
        throw err;
      }
    },
    [threadId, setMessages, startRunPolling]
  );

  // v2 resolveGate signature: `(resolution, { always?, credentialRef? })`.
  // run_id and gate_ref come from the live `pendingGate` (set by the
  // gate / auth_required event) so the UI doesn't have to plumb them
  // through every approve-action call site.
  const resolveGate = React.useCallback(
    async (resolution, opts = {}) => {
      if (!pendingGate) return;
      const { runId, gateRef } = pendingGate;
      if (!runId || !gateRef) {
        throw new Error('resolveGate requires a pending gate with run_id and gate_ref');
      }
      await resolveGateRequest({
        threadId,
        runId,
        gateRef,
        resolution,
        always: opts.always,
        credentialRef: opts.credentialRef
      });
      const shouldContinueProcessing =
        resolution === 'approved' || resolution === 'credential_provided';
      setPendingGate(null);
      setIsProcessing(shouldContinueProcessing);
      if (!shouldContinueProcessing) {
        setActiveRun(null);
      }
    },
    [pendingGate, threadId]
  );

  const submitAuthToken = React.useCallback(
    async (token) => {
      if (!pendingGate) {
        throw new Error('auth gate is no longer pending');
      }
      const { runId, gateRef, provider, accountLabel } = pendingGate;
      if (!runId || !gateRef || !provider || !accountLabel) {
        throw new Error('auth gate is missing required credential metadata');
      }
      const gateKey = `${runId}\n${gateRef}`;
      if (authTokenSubmitRef.current.gateKey !== gateKey) {
        authTokenSubmitRef.current = {
          gateKey,
          credentialRef: null,
          inFlight: false
        };
      }
      if (authTokenSubmitRef.current.inFlight) {
        throw new Error('auth token submission already in progress');
      }
      authTokenSubmitRef.current.inFlight = true;

      try {
        let credentialRef = authTokenSubmitRef.current.credentialRef;
        let submitted = null;
        if (!credentialRef) {
          submitted = await withAuthTokenTimeout((signal) =>
            submitManualToken({
              provider,
              accountLabel,
              token,
              threadId,
              runId,
              gateRef,
              signal
            })
          );
          credentialRef = submitted?.credential_ref;
          if (!credentialRef) {
            throw new Error('manual token submit returned no credential_ref');
          }
          authTokenSubmitRef.current.credentialRef = credentialRef;
        }

        if (!submitResponseResumedTurnGate(submitted)) {
          try {
            await withAuthTokenTimeout((signal) =>
              resolveGateRequest({
                threadId,
                runId,
                gateRef,
                resolution: 'credential_provided',
                credentialRef,
                signal
              })
            );
          } catch (err) {
            throw credentialStoredGateResolutionError(err);
          }
        }

        authTokenSubmitRef.current = {
          gateKey: null,
          credentialRef: null,
          inFlight: false
        };
        setPendingGate(null);
        setIsProcessing(true);
      } catch (err) {
        if (authTokenSubmitRef.current.gateKey === gateKey) {
          authTokenSubmitRef.current.inFlight = false;
        }
        throw err;
      }
    },
    [pendingGate, threadId]
  );

  const cancelRun = React.useCallback(
    async (reason) => {
      const runId = activeRun?.runId;
      if (!runId || !threadId) return;
      try {
        await cancelRunRequest({ threadId, runId, reason });
      } finally {
        setIsProcessing(false);
      }
    },
    [activeRun, threadId]
  );

  const loadMore = React.useCallback(() => {
    if (hasMore && nextCursor) loadHistory(nextCursor);
  }, [hasMore, nextCursor, loadHistory]);

  // Fork-shape compatibility: `approve(requestId, action, kind)` from
  // chat.js. `requestId` and `kind` are v1 concepts the v2 stream
  // doesn't surface; the live `pendingGate` already carries
  // `runId` + `gateRef`, so the args are intentionally ignored and
  // the call is rerouted to v2 resolveGate.
  const approve = React.useCallback(
    async (_requestId, action, _kind) => {
      let resolution = 'approved';
      let always = false;
      if (action === 'deny') resolution = 'denied';
      else if (action === 'cancel') resolution = 'cancelled';
      else if (action === 'always') {
        resolution = 'approved';
        always = true;
      }
      await resolveGate(resolution, { always });
    },
    [resolveGate]
  );

  // Fork chat.js expects these as stubs: v2 stream is deterministic
  // enough that retry / suggestions / recovery are not necessary in
  // local-dev. Wire them as no-ops so the chat UI renders without
  // additional branches.
  const noop = React.useCallback(() => {}, []);

  return {
    // v2-native
    messages,
    isProcessing,
    pendingGate,
    activeRun,
    sseStatus,
    historyLoading,
    hasMore,
    cooldownSeconds,
    send,
    resolveGate,
    submitAuthToken,
    cancelRun,
    loadMore,
    // fork-shape compatibility — see comments above
    suggestions: [],
    setSuggestions: noop,
    retryMessage: noop,
    approve,
    recoverHistory: noop,
    recoveryNotice: null
  };
}

function serializeComposerAttachments(items) {
  return (items || [])
    .map((item) => ({
      name: item.filename || 'attachment',
      mime_type: item.mime_type || 'application/octet-stream',
      data_base64: item.base64 || '',
      size: item.size || 0
    }))
    .filter((item) => item.data_base64);
}

function addPending(store, key, record) {
  const existing = store.get(key) || [];
  store.set(key, [...existing, record]);
}

function removePending(store, key, pendingId) {
  const next = (store.get(key) || []).filter((r) => r.id !== pendingId);
  if (next.length > 0) store.set(key, next);
  else store.delete(key);
}

function movePending(store, fromKey, toKey) {
  const existing = store.get(fromKey) || [];
  if (existing.length === 0) return;
  const target = store.get(toKey) || [];
  store.set(toKey, [...target, ...existing]);
  store.delete(fromKey);
}

function adoptPendingMessagesForThread(store, key) {
  const direct = store.get(key) || [];
  if (direct.length > 0) return direct;
  if (key === '__new__' || store.size !== 1) return [];

  const [[orphanKey, orphanMessages]] = Array.from(store.entries());
  if (
    orphanKey &&
    orphanKey !== key &&
    Array.isArray(orphanMessages) &&
    orphanMessages.some((message) => message?.role === 'user')
  ) {
    store.set(key, orphanMessages);
    store.delete(orphanKey);
    return orphanMessages;
  }
  return [];
}

function upsertMissingAssistantReply(messages, key) {
  const id = `missing-assistant-${key || 'unknown'}`;
  if (messages.some((message) => message.id === id)) return messages;
  return [
    ...messages,
    {
      id,
      role: 'error',
      content: MISSING_ASSISTANT_REPLY_MESSAGE,
      timestamp: new Date().toISOString()
    }
  ];
}

function upsertRunStateFailure(messages, runId, runState) {
  const id = `run-failed-${runId || 'unknown'}`;
  const status = normalizedRunStatus(runState?.status);
  const failure = runState?.failure || {};
  const content =
    status === 'cancelled'
      ? 'The run was cancelled before producing a reply.'
      : failureMessageForRunStatus({
          status,
          failureCategory: failure.category,
          failureSummary: failure.summary
        });
  const existing = messages.findIndex((message) => message.id === id);
  const next = {
    id,
    role: 'error',
    content,
    timestamp: new Date().toISOString()
  };
  if (existing >= 0) {
    const copy = [...messages];
    copy[existing] = next;
    return copy;
  }
  return [...messages, next];
}

function normalizedRunStatus(status) {
  return String(status || '')
    .trim()
    .toLowerCase();
}

async function readTerminalRunState(threadId, runId) {
  try {
    const runState = await getRunState({ threadId, runId });
    const status = normalizedRunStatus(runState?.status);
    if (SUCCESS_RUN_STATE_STATUSES.has(status) || FAILED_RUN_STATE_STATUSES.has(status)) {
      return runState;
    }
  } catch (err) {
    console.warn('Failed to read run state while polling timeline:', err);
  }
  return null;
}

function retryAfterMs(err) {
  const raw = err.headers?.get?.('Retry-After');
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return 2000;
}
