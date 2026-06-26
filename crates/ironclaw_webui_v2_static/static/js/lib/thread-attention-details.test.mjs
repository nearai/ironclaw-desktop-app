import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeThreadAttentionDetail,
  threadAttentionDetailFromGate
} from './thread-attention-details.js';

test('threadAttentionDetailFromGate preserves approval gate specifics for cross-surface rails', () => {
  assert.deepEqual(
    threadAttentionDetailFromGate(
      {
        kind: 'gate',
        headline: 'Approve counter to Northwind',
        body: 'External email with net 45 terms is waiting.',
        toolName: 'send_email',
        runId: 'run-1',
        gateRef: 'gate-1'
      },
      '2026-06-20T04:30:00.000Z'
    ),
    {
      kind: 'approval',
      title: 'Approve counter to Northwind',
      detail: 'External email with net 45 terms is waiting.',
      badge: 'Needs approval',
      icon: 'shield',
      runId: 'run-1',
      gateRef: 'gate-1',
      timestamp: '2026-06-20T04:30:00.000Z'
    }
  );
});

test('threadAttentionDetailFromGate labels auth gates without pretending an approval exists', () => {
  assert.deepEqual(
    threadAttentionDetailFromGate(
      {
        kind: 'auth_required',
        provider: 'google_drive',
        accountLabel: 'Work Drive',
        runId: 'run-auth',
        gateRef: 'auth-1'
      },
      '2026-06-20T04:31:00.000Z'
    ),
    {
      kind: 'auth',
      title: 'Google Drive sign-in needed',
      detail: 'Work Drive needs authorization before this run can continue.',
      badge: 'Auth required',
      icon: 'plug',
      runId: 'run-auth',
      gateRef: 'auth-1',
      timestamp: '2026-06-20T04:31:00.000Z'
    }
  );
});

test('threadAttentionDetailFromGate accepts backend snake_case gate fields', () => {
  assert.deepEqual(
    threadAttentionDetailFromGate(
      {
        kind: 'auth_required',
        provider_id: 'slack',
        account_label: 'Ops Slack',
        run_id: 'run-auth-snake',
        gate_ref: 'auth-snake'
      },
      '2026-06-20T12:05:00.000Z'
    ),
    {
      kind: 'auth',
      title: 'Slack sign-in needed',
      detail: 'Ops Slack needs authorization before this run can continue.',
      badge: 'Auth required',
      icon: 'plug',
      runId: 'run-auth-snake',
      gateRef: 'auth-snake',
      timestamp: '2026-06-20T12:05:00.000Z'
    }
  );
});

test('normalizeThreadAttentionDetail degrades malformed rows to honest waiting copy', () => {
  assert.equal(normalizeThreadAttentionDetail(null), null);
  assert.deepEqual(normalizeThreadAttentionDetail({ kind: 'auth' }), {
    kind: 'auth',
    title: 'Decision waiting',
    detail: 'A connected source needs sign-in before the run can continue.',
    badge: 'Auth required',
    icon: 'plug',
    runId: '',
    gateRef: '',
    timestamp: ''
  });
});
