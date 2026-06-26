import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeWorkbenchRuntimeMessages } from './workbench-scenes.js';

test('mergeWorkbenchRuntimeMessages keeps timeline text and replayed SSE tool activity', () => {
  const merged = mergeWorkbenchRuntimeMessages(
    [
      {
        id: 'msg-user',
        role: 'user',
        content: 'What changed in connected sources?'
      },
      {
        id: 'msg-assistant',
        role: 'assistant',
        content: 'Here is the summary.'
      }
    ],
    [
      {
        id: 'tool-invocation-1',
        role: 'tool_activity',
        invocationId: 'invocation-1',
        toolName: 'connected-sources.read',
        toolStatus: 'success'
      }
    ]
  );

  assert.deepEqual(
    merged.map((message) => [message.role, message.id]),
    [
      ['user', 'msg-user'],
      ['tool_activity', 'tool-invocation-1'],
      ['assistant', 'msg-assistant']
    ]
  );
});

test('mergeWorkbenchRuntimeMessages updates duplicate tool activity by invocation id', () => {
  const merged = mergeWorkbenchRuntimeMessages(
    [
      {
        id: 'tool-invocation-1',
        role: 'tool_activity',
        invocationId: 'invocation-1',
        toolName: 'connected-sources.read',
        toolStatus: 'running',
        updatedAt: '2026-06-21T17:00:00.000Z'
      }
    ],
    [
      {
        id: 'tool-invocation-1',
        role: 'tool_activity',
        invocationId: 'invocation-1',
        toolName: 'connected-sources.read',
        toolStatus: 'success',
        toolResultPreview: '3 rows',
        updatedAt: '2026-06-21T17:00:01.000Z'
      }
    ]
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].toolStatus, 'success');
  assert.equal(merged[0].toolResultPreview, '3 rows');
});

test('mergeWorkbenchRuntimeMessages keeps terminal tool state over stale running replay', () => {
  const merged = mergeWorkbenchRuntimeMessages(
    [
      {
        id: 'tool-invocation-1',
        role: 'tool_activity',
        invocationId: 'invocation-1',
        toolName: 'connected-sources.read',
        toolStatus: 'success',
        toolResultPreview: '3 rows',
        updatedAt: '2026-06-21T17:00:01.000Z'
      }
    ],
    [
      {
        id: 'tool-invocation-1',
        role: 'tool_activity',
        invocationId: 'invocation-1',
        toolName: 'connected-sources.read',
        toolStatus: 'running',
        updatedAt: '2026-06-21T17:00:02.000Z'
      }
    ]
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].toolStatus, 'success');
  assert.equal(merged[0].toolResultPreview, '3 rows');
});
