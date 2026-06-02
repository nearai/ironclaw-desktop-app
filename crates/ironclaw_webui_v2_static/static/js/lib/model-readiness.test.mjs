import assert from 'node:assert/strict';
import test from 'node:test';

import { isModelExecutionVerified, modelExecutionReadiness } from './model-readiness.js';

test('configured provider and model are unverified by default', () => {
  const status = {
    llm_backend: 'nearai',
    llm_model: 'z-ai/glm-4.5'
  };

  assert.equal(isModelExecutionVerified(status), false);
  assert.equal(modelExecutionReadiness(status).buttonPrefix, 'Configured (unverified)');
  assert.equal(modelExecutionReadiness(status).sendBlocked, false);
  assert.equal(modelExecutionReadiness(status).sendBlockReason, '');
});

test('model_execution_verified marks execution verified', () => {
  assert.equal(
    isModelExecutionVerified({
      llm_backend: 'nearai',
      llm_model: 'z-ai/glm-4.5',
      model_execution_verified: true
    }),
    true
  );
  assert.equal(
    modelExecutionReadiness({
      model_execution_verified: true
    }).sendBlocked,
    false
  );
});

test('GREEN readiness fields mark execution verified', () => {
  assert.equal(
    isModelExecutionVerified({
      readiness: { model_execution_readiness: 'GREEN' }
    }),
    true
  );
});

test('configured readiness text does not mark execution verified', () => {
  assert.equal(
    isModelExecutionVerified({
      model_execution_readiness: 'configured'
    }),
    false
  );
});

test('generic first-run verification reason does not block send', () => {
  const readiness = modelExecutionReadiness({
    model_execution_verified: false,
    model_readiness: 'unverified',
    model_readiness_reason:
      'Gateway status reports configured provider/model only; execution is verified by a successful WebChat run.'
  });

  assert.equal(readiness.sendBlocked, false);
  assert.equal(readiness.sendBlockReason, '');
});

test('explicit credential failures block send with the backend reason', () => {
  const readiness = modelExecutionReadiness({
    model_execution_verified: false,
    model_execution_failure_category: 'model_credentials_unavailable',
    model_execution_failure_summary:
      'NEAR.AI is selected, but no NEARAI_SESSION_TOKEN, NEARAI_API_KEY, or vaulted nearai credential is available.'
  });

  assert.equal(readiness.sendBlocked, true);
  assert.match(readiness.description, /NEARAI_SESSION_TOKEN/);
});
