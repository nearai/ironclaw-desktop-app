import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CORE_CONNECTIONS,
  coreConnectionButtonState,
  projectedConnectPhase
} from './registry-tab.js';

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

test('core connection fallbacks expose the expected catalog refs only', () => {
  assert.deepEqual(
    CORE_CONNECTIONS.filter((entry) => entry.package_ref).map((entry) => entry.package_ref.id),
    ['tools/gmail', 'tools/google_calendar', 'mcp-servers/notion', 'channels/slack']
  );
  assert.equal(CORE_CONNECTIONS.find((entry) => entry.id === 'workspace')?.package_ref, null);
});

test('core connection fallbacks are not installable when catalog is empty', () => {
  const gmail = CORE_CONNECTIONS.find((entry) => entry.id === 'gmail');

  assert.deepEqual(
    coreConnectionButtonState({
      entry: gmail,
      gatewayOffline: false,
      catalogUnavailable: true,
      isBusy: false
    }),
    { disabled: true, label: 'Not available' }
  );
});

test('core connection fallbacks distinguish offline gateway from unavailable catalog', () => {
  const notion = CORE_CONNECTIONS.find((entry) => entry.id === 'notion');

  assert.deepEqual(
    coreConnectionButtonState({
      entry: notion,
      gatewayOffline: true,
      catalogUnavailable: false,
      isBusy: false
    }),
    { disabled: true, label: 'Gateway offline' }
  );
});
