import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import {
  isTerminalToolStatus,
  toolCardFromActivity,
  toolCardFromPreview
} from './history-messages.js';
import { gateFromProjection } from './gates.js';
import { upsertRunFailureMessage } from './message-upsert.js';
import {
  createToolActivityState,
  ensureGateToolActivity,
  upsertToolActivityMessage
} from './tool-activity-state.js';

function sourceForVm(url, replacements = []) {
  const source = readFileSync(url, 'utf8');
  const lines = [];
  let skippingImport = false;
  for (const line of source.split('\n')) {
    if (!skippingImport && line.startsWith('import ')) {
      skippingImport = !line.trimEnd().endsWith(';');
      continue;
    }
    if (skippingImport) {
      skippingImport = !line.trimEnd().endsWith(';');
      continue;
    }
    lines.push(replacements.reduce((next, [from, to]) => next.replace(from, to), line));
  }
  return lines.join('\n');
}

function useChatEventsSourceForTest() {
  const projectionSource = sourceForVm(new URL('./chat-event-projection.js', import.meta.url), [
    ['export function settleRun', 'function settleRun'],
    ['export function applyProjectionItems', 'function applyProjectionItems'],
    ['export function appendRunFailureMessage', 'function appendRunFailureMessage']
  ]);
  const eventsSource = sourceForVm(new URL('./useChatEvents.js', import.meta.url), [
    ['export function useChatEvents', 'function useChatEvents']
  ]);
  return `${projectionSource}\n${eventsSource}\nglobalThis.__testExports = { useChatEvents };`;
}

function createUseChatEventsHarness({
  gateFromEvent = () => null,
  gateFromProjection: gateFromProjectionOverride = gateFromProjection,
  failureMessageForRunStatus: failureMessageForRunStatusOverride = () => 'run failed'
} = {}) {
  let messages = [];
  let pendingGate = null;
  let isProcessing = false;
  let activeRun = null;
  const activeRunRef = { current: null };
  const locallyResolvedGatesRef = { current: new Map() };
  const toolActivityStateRef = { current: createToolActivityState() };
  const completedRuns = [];
  const settledRuns = [];
  const failedRuns = [];
  const context = {
    Date,
    React: {
      useCallback: (fn) => fn,
      useRef: (value) => ({ current: value })
    },
    failureMessageForRunStatus: failureMessageForRunStatusOverride,
    upsertRunFailureMessage,
    ensureGateToolActivity,
    upsertToolActivityMessage,
    gateFromEvent,
    globalThis: {},
    isTerminalToolStatus,
    toolCardFromActivity,
    toolCardFromPreview,
    gateFromProjection: gateFromProjectionOverride
  };

  vm.runInNewContext(useChatEventsSourceForTest(), context);

  const handleEvent = context.globalThis.__testExports.useChatEvents({
    threadId: 'thread-1',
    setMessages: (updater) => {
      messages = typeof updater === 'function' ? updater(messages) : updater;
    },
    setIsProcessing: (updater) => {
      isProcessing = typeof updater === 'function' ? updater(isProcessing) : updater;
    },
    setPendingGate: (updater) => {
      pendingGate = typeof updater === 'function' ? updater(pendingGate) : updater;
    },
    setActiveRun: (updater) => {
      activeRun = typeof updater === 'function' ? updater(activeRun) : updater;
      activeRunRef.current = activeRun;
    },
    activeRunRef,
    locallyResolvedGatesRef,
    toolActivityStateRef,
    onRunSettled: (runId, { success }) => settledRuns.push({ runId, success }),
    onRunCompleted: (runId) => completedRuns.push(runId),
    onRunFailed: (failure) => failedRuns.push(failure)
  });

  return {
    handleEvent,
    get messages() {
      return messages;
    },
    get pendingGate() {
      return pendingGate;
    },
    get isProcessing() {
      return isProcessing;
    },
    get activeRun() {
      return activeRun;
    },
    setCurrentActiveRun(run) {
      activeRun = run;
      activeRunRef.current = run;
    },
    get completedRuns() {
      return completedRuns;
    },
    get settledRuns() {
      return settledRuns;
    },
    get failedRuns() {
      return failedRuns;
    },
    toolActivityStateRef,
    locallyResolvedGatesRef
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('useChatEvents: projection activity preserves reasoning/tool chronology', () => {
  const harness = createUseChatEventsHarness();

  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [
          { run_status: { run_id: 'run-1', status: 'running' } },
          { thinking: { id: 'run-1:1', run_id: 'run-1', body: 'before tool' } },
          {
            capability_activity: {
              invocation_id: 'invocation-1',
              turn_run_id: 'run-1',
              thread_id: 'thread-1',
              capability_id: 'builtin.http',
              status: 'started',
              provider: null,
              runtime: null,
              process_id: null,
              output_bytes: null,
              error_kind: null,
              updated_at: '2026-06-03T11:44:43Z'
            }
          },
          { thinking: { id: 'run-1:2', run_id: 'run-1', body: 'after tool' } }
        ]
      }
    }
  });

  assert.deepEqual(
    Array.from(harness.messages, (message) => message.id),
    ['thinking-run-1:1', 'tool-invocation-1', 'thinking-run-1:2']
  );
  assert.deepEqual(
    Array.from(harness.messages, (message) => message.role),
    ['thinking', 'tool_activity', 'thinking']
  );
  assert.equal(harness.messages[1].toolName, 'http');
  assert.equal(harness.messages[1].toolStatus, 'running');
  assert.deepEqual(
    Array.from(harness.messages, (message) => message.turnRunId),
    ['run-1', 'run-1', 'run-1']
  );
});

test('useChatEvents: auth gate stays visible through progress events', () => {
  const runId = 'run-auth-1';
  const authGate = {
    kind: 'auth_required',
    challengeKind: 'manual_token',
    runId,
    gateRef: 'gate:auth'
  };
  const harness = createUseChatEventsHarness({ gateFromEvent: () => authGate });

  harness.handleEvent({
    type: 'auth_required',
    frame: {
      prompt: {
        turn_run_id: runId,
        auth_request_ref: 'gate:auth'
      }
    }
  });
  assert.deepEqual(harness.pendingGate, authGate);

  harness.handleEvent({
    type: 'capability_progress',
    frame: {
      progress: {
        turn_run_id: runId,
        kind: 'tool_running'
      }
    }
  });

  assert.deepEqual(harness.pendingGate, authGate);
});

test('useChatEvents: progress clears non-auth gates for the resumed run', () => {
  const runId = 'run-approval-1';
  const approvalGate = {
    kind: 'gate',
    runId,
    gateRef: 'gate:approval'
  };
  const harness = createUseChatEventsHarness({
    gateFromEvent: () => approvalGate
  });

  harness.handleEvent({
    type: 'gate',
    frame: {
      prompt: {
        turn_run_id: runId,
        gate_ref: 'gate:approval'
      }
    }
  });
  assert.deepEqual(harness.pendingGate, approvalGate);

  harness.handleEvent({
    type: 'running',
    frame: {
      progress: {
        turn_run_id: runId,
        kind: 'typing'
      }
    }
  });

  assert.equal(harness.pendingGate, null);
});

test('useChatEvents: approval gate annotates an existing tool activity', () => {
  const runId = 'run-gated-existing';
  const gateRef = 'gate:web-access';
  const gate = {
    kind: 'gate',
    runId,
    gateRef,
    toolName: 'web-access.search'
  };
  const harness = createUseChatEventsHarness({
    gateFromEvent: () => gate
  });

  harness.handleEvent({
    type: 'capability_activity',
    frame: {
      activity: {
        invocation_id: 'invocation-web-access',
        turn_run_id: runId,
        capability_id: 'web-access.search',
        status: 'started'
      }
    }
  });
  harness.handleEvent({
    type: 'gate',
    frame: {
      prompt: {
        turn_run_id: runId,
        gate_ref: gateRef
      }
    }
  });

  assert.equal(harness.messages.length, 1);
  assert.equal(harness.messages[0].id, 'tool-invocation-web-access');
  assert.equal(harness.messages[0].toolName, 'search');
  assert.equal(harness.messages[0].toolStatus, 'running');
  assert.equal(harness.messages[0].gateRef, gateRef);
  assert.deepEqual(harness.pendingGate, gate);
});

test('useChatEvents: approval gate creates activity before invocation metadata arrives', () => {
  const runId = 'run-gated-synthetic';
  const gateRef = 'gate:nearai';
  const gate = {
    kind: 'gate',
    runId,
    gateRef,
    toolName: 'nearai.web_search'
  };
  const harness = createUseChatEventsHarness({
    gateFromEvent: () => gate
  });

  harness.handleEvent({
    type: 'gate',
    frame: {
      prompt: {
        turn_run_id: runId,
        gate_ref: gateRef
      }
    }
  });

  assert.equal(harness.messages.length, 1);
  assert.equal(harness.messages[0].id, `tool-gate:${runId}:${gateRef}`);
  assert.equal(harness.messages[0].toolName, 'web_search');
  assert.equal(harness.messages[0].toolStatus, 'running');
  assert.equal(harness.messages[0].gateRef, gateRef);

  harness.handleEvent({
    type: 'capability_activity',
    frame: {
      activity: {
        invocation_id: 'invocation-nearai',
        turn_run_id: runId,
        capability_id: 'nearai.web_search',
        status: 'started'
      }
    }
  });

  assert.equal(harness.messages.length, 1);
  assert.equal(harness.messages[0].id, 'tool-invocation-nearai');
  assert.equal(harness.messages[0].invocationId, 'invocation-nearai');
  assert.equal(harness.messages[0].toolName, 'web_search');
  assert.equal(harness.messages[0].toolStatus, 'running');
  assert.equal(harness.messages[0].gateRef, gateRef);
  assert.equal(harness.messages[0].gateActivity, false);
});

test('useChatEvents: projection approval gate annotates an existing tool activity', () => {
  const runId = 'run-projected-gated-existing';
  const gateRef = 'gate:web-access';
  const harness = createUseChatEventsHarness();

  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [
          { run_status: { run_id: runId, status: 'blocked_approval' } },
          {
            capability_activity: {
              invocation_id: 'invocation-web-access',
              turn_run_id: runId,
              capability_id: 'web-access.search',
              status: 'started'
            }
          },
          {
            gate: {
              gate_ref: gateRef,
              tool_name: 'web-access.search'
            }
          }
        ]
      }
    }
  });

  assert.equal(harness.messages.length, 1);
  assert.equal(harness.messages[0].id, 'tool-invocation-web-access');
  assert.equal(harness.messages[0].toolName, 'search');
  assert.equal(harness.messages[0].toolStatus, 'running');
  assert.equal(harness.messages[0].gateRef, gateRef);
  assert.deepEqual(plain(harness.pendingGate), {
    kind: 'gate',
    requestId: gateRef,
    runId,
    gateRef,
    headline: '',
    body: '',
    toolName: 'web-access.search',
    description: '',
    parameters: '',
    allowAlways: false
  });
});

test('useChatEvents: projection approval gate creates activity before invocation metadata arrives', () => {
  const runId = 'run-projected-gated-synthetic';
  const gateRef = 'gate:nearai';
  const harness = createUseChatEventsHarness();

  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [
          { run_status: { run_id: runId, status: 'blocked_approval' } },
          {
            gate: {
              gate_ref: gateRef,
              tool_name: 'nearai.web_search'
            }
          }
        ]
      }
    }
  });

  assert.equal(harness.messages.length, 1);
  assert.equal(harness.messages[0].id, `tool-gate:${runId}:${gateRef}`);
  assert.equal(harness.messages[0].toolName, 'web_search');
  assert.equal(harness.messages[0].toolStatus, 'running');
  assert.equal(harness.messages[0].gateRef, gateRef);

  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [
          {
            capability_activity: {
              invocation_id: 'invocation-nearai',
              turn_run_id: runId,
              capability_id: 'nearai.web_search',
              status: 'started'
            }
          }
        ]
      }
    }
  });

  assert.equal(harness.messages.length, 1);
  assert.equal(harness.messages[0].id, 'tool-invocation-nearai');
  assert.equal(harness.messages[0].invocationId, 'invocation-nearai');
  assert.equal(harness.messages[0].toolName, 'web_search');
  assert.equal(harness.messages[0].toolStatus, 'running');
  assert.equal(harness.messages[0].gateRef, gateRef);
  assert.equal(harness.messages[0].gateActivity, false);
});

test('useChatEvents: cleared non-auth gates are not restored by later projections', () => {
  const runId = 'run-resource-1';
  const harness = createUseChatEventsHarness();

  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [
          { run_status: { run_id: runId, status: 'blocked_resource' } },
          {
            gate: {
              gate_ref: 'gate:resource',
              headline: 'Resource unavailable'
            }
          }
        ]
      }
    }
  });
  assert.deepEqual(plain(harness.pendingGate), {
    kind: 'gate',
    requestId: 'gate:resource',
    runId,
    gateRef: 'gate:resource',
    headline: 'Resource unavailable',
    body: '',
    toolName: '',
    description: '',
    parameters: '',
    allowAlways: false
  });

  harness.handleEvent({
    type: 'running',
    frame: {
      progress: {
        turn_run_id: runId,
        kind: 'typing'
      }
    }
  });
  assert.equal(harness.pendingGate, null);

  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [
          {
            gate: {
              gate_ref: 'gate:resource',
              headline: 'Resource unavailable'
            }
          }
        ]
      }
    }
  });

  assert.equal(harness.pendingGate, null);
});

test('useChatEvents: stale terminal run status does not clear newer run', () => {
  const harness = createUseChatEventsHarness();

  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [{ run_status: { run_id: 'run-1', status: 'running' } }]
      }
    }
  });
  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [
          { run_status: { run_id: 'run-2', status: 'running' } },
          { run_status: { run_id: 'run-1', status: 'cancelled' } }
        ]
      }
    }
  });

  assert.equal(harness.isProcessing, true);
  assert.deepEqual(plain(harness.activeRun), {
    runId: 'run-2',
    threadId: 'thread-1',
    status: 'running'
  });
});

test('useChatEvents: stale terminal status before newer projection does not clear newer run', () => {
  const harness = createUseChatEventsHarness();

  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [{ run_status: { run_id: 'run-1', status: 'running' } }]
      }
    }
  });
  harness.setCurrentActiveRun({
    runId: 'run-2',
    threadId: 'thread-1',
    status: 'queued',
    source: 'local'
  });
  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [{ run_status: { run_id: 'run-1', status: 'cancelled' } }]
      }
    }
  });

  assert.equal(harness.isProcessing, true);
  assert.deepEqual(plain(harness.activeRun), {
    runId: 'run-2',
    threadId: 'thread-1',
    status: 'queued',
    source: 'local'
  });
});

test('useChatEvents: stale running status before newer projection does not replace newer run', () => {
  const harness = createUseChatEventsHarness();

  harness.setCurrentActiveRun({
    runId: 'run-2',
    threadId: 'thread-1',
    status: 'queued',
    source: 'local'
  });
  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [{ run_status: { run_id: 'run-1', status: 'running' } }]
      }
    }
  });

  assert.deepEqual(plain(harness.activeRun), {
    runId: 'run-2',
    threadId: 'thread-1',
    status: 'queued',
    source: 'local'
  });
});

test('useChatEvents: stale failed run status does not append error', () => {
  const harness = createUseChatEventsHarness();

  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [{ run_status: { run_id: 'run-1', status: 'running' } }]
      }
    }
  });
  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [
          { run_status: { run_id: 'run-2', status: 'running' } },
          { run_status: { run_id: 'run-1', status: 'failed' } }
        ]
      }
    }
  });

  assert.equal(harness.isProcessing, true);
  assert.deepEqual(harness.messages, []);
  assert.deepEqual(plain(harness.activeRun), {
    runId: 'run-2',
    threadId: 'thread-1',
    status: 'running'
  });
});

test('useChatEvents: failed run status emits connector recovery context', () => {
  const harness = createUseChatEventsHarness({
    failureMessageForRunStatus: ({ failureSummary }) => failureSummary
  });

  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [
          { run_status: { run_id: 'run-1', status: 'running' } },
          {
            run_status: {
              run_id: 'run-1',
              status: 'failed',
              failure_category: 'missing_tool',
              failure_summary: 'Notion tool is not installed for this run.'
            }
          }
        ]
      }
    }
  });

  assert.equal(harness.messages.length, 1);
  assert.equal(harness.messages[0].content, 'Notion tool is not installed for this run.');
  assert.deepEqual(plain(harness.failedRuns), [
    {
      runId: 'run-1',
      status: 'failed',
      failureCategory: 'missing_tool',
      failureSummary: 'Notion tool is not installed for this run.',
      content: 'Notion tool is not installed for this run.'
    }
  ]);
});

test('useChatEvents: stale completed run status does not refetch timeline', () => {
  const harness = createUseChatEventsHarness();

  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [{ run_status: { run_id: 'run-1', status: 'running' } }]
      }
    }
  });
  harness.handleEvent({
    type: 'projection_update',
    frame: {
      state: {
        items: [
          { run_status: { run_id: 'run-2', status: 'running' } },
          { run_status: { run_id: 'run-1', status: 'completed' } }
        ]
      }
    }
  });

  assert.deepEqual(harness.completedRuns, []);
  assert.equal(harness.isProcessing, true);
  assert.deepEqual(plain(harness.activeRun), {
    runId: 'run-2',
    threadId: 'thread-1',
    status: 'running'
  });
});
