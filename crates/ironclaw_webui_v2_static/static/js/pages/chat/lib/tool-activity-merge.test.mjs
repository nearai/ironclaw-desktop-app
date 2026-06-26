// Unit tests for transient tool activity merge behavior.
//
// Run with Node's built-in test runner:
//   node --test crates/ironclaw_webui_v2_static/static/js/pages/chat/lib/tool-activity-merge.test.mjs

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createToolActivityState,
  ensureGateToolActivity,
  failGateToolActivity,
  upsertToolActivityMessage
} from './tool-activity-state.js';

function messageHarness() {
  let messages = [];
  return {
    stateRef: { current: createToolActivityState() },
    get messages() {
      return messages;
    },
    setMessages(updater) {
      messages = typeof updater === 'function' ? updater(messages) : updater;
    }
  };
}

function runtimeActivity(overrides = {}) {
  return {
    invocationId: 'invocation-1',
    callId: 'invocation-1',
    capabilityId: 'web-access.search',
    toolName: 'search',
    toolStatus: 'running',
    toolDetail: null,
    toolParameters: null,
    toolResultPreview: null,
    toolError: null,
    toolDurationMs: null,
    updatedAt: '2026-06-17T01:00:00.000Z',
    resultRef: null,
    truncated: false,
    outputBytes: null,
    outputKind: null,
    turnRunId: 'run-1',
    activityOrder: 42,
    activityOrderSource: 'projection',
    ...overrides
  };
}

function approvalGate(overrides = {}) {
  return {
    kind: 'gate',
    runId: 'run-1',
    gateRef: 'gate:approval-1',
    invocationId: 'invocation-1',
    toolName: 'web-access.search',
    ...overrides
  };
}

test('approval gate with invocation id merges into an existing runtime activity', () => {
  const harness = messageHarness();
  upsertToolActivityMessage(harness.setMessages, runtimeActivity(), harness.stateRef);

  ensureGateToolActivity(harness.setMessages, approvalGate(), harness.stateRef);
  failGateToolActivity(harness.setMessages, approvalGate(), harness.stateRef);

  assert.equal(harness.messages.length, 1);
  assert.equal(harness.messages[0].id, 'tool-invocation-1');
  assert.equal(harness.messages[0].gateRef, 'gate:approval-1');
  assert.equal(harness.messages[0].toolStatus, 'error');
  assert.equal(harness.messages[0].toolError, 'authorization');
  assert.equal(harness.messages[0].activityOrder, 42);
});

test('runtime activity adopts an earlier gate card by invocation id', () => {
  const harness = messageHarness();

  ensureGateToolActivity(harness.setMessages, approvalGate(), harness.stateRef);
  failGateToolActivity(harness.setMessages, approvalGate(), harness.stateRef);
  upsertToolActivityMessage(
    harness.setMessages,
    runtimeActivity({ toolStatus: 'error' }),
    harness.stateRef
  );

  assert.equal(harness.messages.length, 1);
  assert.equal(harness.messages[0].id, 'tool-invocation-1');
  assert.equal(harness.messages[0].toolStatus, 'error');
  assert.equal(harness.messages[0].activityOrder, 42);
  assert.equal(harness.messages[0].activityOrderSource, 'projection');
});

test('gate without invocation merges when exactly one matching real activity exists', () => {
  const harness = messageHarness();
  upsertToolActivityMessage(
    harness.setMessages,
    runtimeActivity({ invocationId: 'runtime-only', callId: 'runtime-only' }),
    harness.stateRef
  );

  ensureGateToolActivity(
    harness.setMessages,
    approvalGate({ invocationId: '', gateRef: 'gate:approval-single' }),
    harness.stateRef
  );

  assert.equal(harness.messages.length, 1);
  assert.equal(harness.messages[0].id, 'tool-runtime-only');
  assert.equal(harness.messages[0].gateRef, 'gate:approval-single');
  assert.equal(Boolean(harness.messages[0].gateActivity), false);
});

test('gate without invocation does not annotate terminal real activity by same-tool fallback', () => {
  const harness = messageHarness();
  upsertToolActivityMessage(
    harness.setMessages,
    runtimeActivity({
      invocationId: 'completed-search',
      callId: 'completed-search',
      toolStatus: 'success'
    }),
    harness.stateRef
  );

  ensureGateToolActivity(
    harness.setMessages,
    approvalGate({ invocationId: '', gateRef: 'gate:approval-after-complete' }),
    harness.stateRef
  );

  assert.equal(harness.messages.length, 2);
  assert.equal(harness.messages[0].id, 'tool-completed-search');
  assert.equal(harness.messages[0].toolStatus, 'success');
  assert.equal(harness.messages[0].gateRef || '', '');
  assert.equal(harness.messages[1].id, 'tool-gate:run-1:gate:approval-after-complete');
  assert.equal(harness.messages[1].toolStatus, 'running');
  assert.equal(harness.messages[1].gateRef, 'gate:approval-after-complete');
});

test('runtime activity does not adopt terminal gate activity by same-tool fallback', () => {
  const harness = messageHarness();
  const deniedGate = approvalGate({ invocationId: '', gateRef: 'gate:approval-denied' });

  ensureGateToolActivity(harness.setMessages, deniedGate, harness.stateRef);
  failGateToolActivity(harness.setMessages, deniedGate, harness.stateRef);
  upsertToolActivityMessage(
    harness.setMessages,
    runtimeActivity({
      invocationId: 'follow-up-search',
      callId: 'follow-up-search',
      activityOrder: 43
    }),
    harness.stateRef
  );

  assert.equal(harness.messages.length, 2);
  assert.equal(harness.messages[0].id, 'tool-gate:run-1:gate:approval-denied');
  assert.equal(harness.messages[0].toolStatus, 'error');
  assert.equal(harness.messages[0].gateRef, 'gate:approval-denied');
  assert.equal(harness.messages[1].id, 'tool-follow-up-search');
  assert.equal(harness.messages[1].toolStatus, 'running');
  assert.equal(harness.messages[1].gateRef || '', '');
});

test('uncorrelated gate does not guess by same tool name inside a run', () => {
  const harness = messageHarness();
  upsertToolActivityMessage(
    harness.setMessages,
    runtimeActivity({ invocationId: 'search-1', callId: 'search-1' }),
    harness.stateRef
  );
  upsertToolActivityMessage(
    harness.setMessages,
    runtimeActivity({
      invocationId: 'search-2',
      callId: 'search-2',
      updatedAt: '2026-06-17T01:00:01.000Z',
      activityOrder: 43
    }),
    harness.stateRef
  );

  ensureGateToolActivity(
    harness.setMessages,
    approvalGate({ invocationId: '', gateRef: 'gate:approval-uncorrelated' }),
    harness.stateRef
  );

  assert.equal(harness.messages.length, 3);
  assert.equal(harness.messages[0].gateRef || '', '');
  assert.equal(harness.messages[1].gateRef || '', '');
  assert.equal(harness.messages[2].id, 'tool-gate:run-1:gate:approval-uncorrelated');
  assert.equal(harness.messages[2].gateActivity, true);
});
