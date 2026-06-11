import assert from 'node:assert/strict';
import test from 'node:test';

import { projectedConnectPhase } from './registry-tab.js';

test('projectedConnectPhase accepts backend snake_case registry readiness', () => {
  assert.deepEqual(
    projectedConnectPhase({
      package_ref: { id: 'tools/gmail' },
      connect_phase: {
        phase: 'blocked-google-client-id',
        message: 'Google Desktop app client ID required.'
      }
    }),
    {
      phase: 'blocked-google-client-id',
      message: 'Google Desktop app client ID required.'
    }
  );
});

test('projectedConnectPhase preserves camelCase readiness projections', () => {
  assert.deepEqual(
    projectedConnectPhase({
      package_ref: { id: 'mcp-servers/notion' },
      connectPhase: { phase: 'needs-token', message: 'Needs setup' }
    }),
    { phase: 'needs-token', message: 'Needs setup' }
  );
});
