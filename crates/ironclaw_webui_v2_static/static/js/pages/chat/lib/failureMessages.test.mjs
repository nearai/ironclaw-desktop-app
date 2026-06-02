import assert from 'node:assert/strict';
import test from 'node:test';

import { failureMessageForApiError, failureMessageForRunStatus } from './failureMessages.js';

test('failureMessageForRunStatus prefers trimmed failureSummary', () => {
  assert.equal(
    failureMessageForRunStatus({
      status: 'failed',
      failureCategory: 'driver_failed',
      failureSummary: '  The driver stopped unexpectedly.  '
    }),
    'The driver stopped unexpectedly.'
  );
});

test('failureMessageForRunStatus formats category underscores', () => {
  assert.equal(
    failureMessageForRunStatus({
      status: 'failed',
      failureCategory: 'driver_invalid_request',
      failureSummary: null
    }),
    'The run failed: driver invalid request.'
  );
});

test('failureMessageForRunStatus uses recovery_required fallback', () => {
  assert.equal(
    failureMessageForRunStatus({
      status: 'recovery_required',
      failureCategory: null,
      failureSummary: null
    }),
    'The run is awaiting recovery — backend reported `recovery_required`.'
  );
});

test('failureMessageForRunStatus handles whitespace-only summary', () => {
  assert.equal(
    failureMessageForRunStatus({
      status: 'failed',
      failureCategory: 'lease_expired',
      failureSummary: '   '
    }),
    'The run failed: lease expired.'
  );
});

test('failureMessageForRunStatus explains unavailable drivers without internal category copy', () => {
  assert.equal(
    failureMessageForRunStatus({
      status: 'failed',
      failureCategory: 'driver_unavailable',
      failureSummary: null
    }),
    'The selected model is configured, but its execution driver is unavailable. Check provider setup or choose a verified model before retrying.'
  );
});

test('failureMessageForRunStatus explains unavailable models without internal category copy', () => {
  assert.equal(
    failureMessageForRunStatus({
      status: 'failed',
      failureCategory: 'model_unavailable',
      failureSummary: null
    }),
    'The selected model is configured, but the gateway says that model is unavailable. Choose a verified model or update the configured model before retrying.'
  );
});

test('failureMessageForRunStatus explains model credential failures', () => {
  assert.equal(
    failureMessageForRunStatus({
      status: 'failed',
      failureCategory: 'model_credentials_unavailable',
      failureSummary: null
    }),
    'Model credentials are unavailable. Sign in or update provider credentials before retrying.'
  );
});

test('failureMessageForRunStatus explains model plan denials', () => {
  assert.equal(
    failureMessageForRunStatus({
      status: 'failed',
      failureCategory: 'policy_denied',
      failureSummary: null
    }),
    'The selected model is not available for this account or provider plan. Choose a model this account can run, or update provider credentials.'
  );
});

test('failureMessageForApiError maps send-message unavailable driver payloads', () => {
  assert.equal(
    failureMessageForApiError({
      message: '{"category":"driver_unavailable"}',
      payload: { category: 'driver_unavailable' }
    }),
    'The selected model is configured, but its execution driver is unavailable. Check provider setup or choose a verified model before retrying.'
  );
});
