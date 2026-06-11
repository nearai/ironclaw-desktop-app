import assert from 'node:assert/strict';
import test from 'node:test';

import { formatGateParameters, gateFromEvent, gateFromProjection } from './gates.js';

test('gateFromEvent preserves approval tool metadata and allow-always support', () => {
  const gate = gateFromEvent('gate', {
    request_id: 'approval-request-1',
    turn_run_id: 'run-1',
    gate_ref: 'gate-1',
    headline: 'Approve sending an email',
    body: 'IronClaw wants to send a customer email.',
    tool_name: 'send_email',
    description: 'Send email to customer@example.com',
    parameters: {
      to: 'customer@example.com',
      subject: 'Services agreement'
    },
    allow_always: true
  });

  assert.deepEqual(gate, {
    kind: 'gate',
    requestId: 'approval-request-1',
    runId: 'run-1',
    gateRef: 'gate-1',
    headline: 'Approve sending an email',
    body: 'IronClaw wants to send a customer email.',
    toolName: 'send_email',
    description: 'Send email to customer@example.com',
    parameters: '{\n  "to": "customer@example.com",\n  "subject": "Services agreement"\n}',
    allowAlways: true
  });
});

test('gateFromProjection keeps projected gate honest without fabricating tool metadata', () => {
  const gate = gateFromProjection('run-2', {
    gate_ref: 'gate-2',
    headline: 'Approval required'
  });

  assert.deepEqual(gate, {
    kind: 'gate',
    requestId: 'gate-2',
    runId: 'run-2',
    gateRef: 'gate-2',
    headline: 'Approval required',
    body: '',
    toolName: '',
    description: '',
    parameters: '',
    allowAlways: false
  });
});

test('formatGateParameters returns strings as-is and hides absent values', () => {
  assert.equal(formatGateParameters('{"already":"redacted"}'), '{"already":"redacted"}');
  assert.equal(formatGateParameters(null), '');
  assert.equal(formatGateParameters(undefined), '');
  assert.equal(formatGateParameters(''), '');
});

