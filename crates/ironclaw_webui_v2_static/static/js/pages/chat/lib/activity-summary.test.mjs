import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeActivity } from './activity-summary.js';

test('summarizeActivity: nested toolCalls surface failed and running status', () => {
  const summary = summarizeActivity([
    { id: 'r', role: 'thinking', content: 'checking' },
    {
      id: 'g',
      role: 'assistant',
      toolCalls: [
        { id: 'a', toolName: 'read_file', toolStatus: 'error' },
        { id: 'b', toolName: 'grep', toolStatus: 'running' }
      ]
    }
  ]);

  assert.equal(summary.hasError, true);
  assert.equal(summary.label, '1 tool failed');
});

test('summarizeActivity: quiet labels describe the work instead of generic activity', () => {
  assert.equal(
    summarizeActivity([{ id: 'a', role: 'tool_activity', toolName: 'read_file' }]).label,
    'Read 1 file'
  );
  assert.equal(
    summarizeActivity([{ id: 'a', role: 'tool_activity', toolName: 'web_search' }]).label,
    'Searched 1 time'
  );
  assert.equal(
    summarizeActivity([
      { id: 'a', role: 'tool_activity', toolName: 'read_file' },
      { id: 'b', role: 'tool_activity', toolName: 'grep' },
      { id: 'c', role: 'tool_activity', toolName: 'bash' }
    ]).label,
    'Checked 3 tool steps'
  );
  assert.equal(
    summarizeActivity([{ id: 'a', role: 'tool_activity', toolName: 'read_file', toolStatus: 'running' }])
      .label,
    'Checking 1 tool step...'
  );
});
