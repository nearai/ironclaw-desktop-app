import assert from 'node:assert/strict';
import test from 'node:test';

import {
  primaryExtensionAction,
  registryConnectButtonState,
  setupReadyForActivation
} from './extension-actions.js';

const notionRef = { kind: 'extension', id: 'notion' };

test('primaryExtensionAction opens configuration before OAuth-required activation', () => {
  assert.equal(
    primaryExtensionAction({
      package_ref: notionRef,
      kind: 'mcp_server',
      onboarding_state: 'auth_required'
    }),
    'configure'
  );
});

test('primaryExtensionAction activates configured inactive MCP extensions', () => {
  assert.equal(
    primaryExtensionAction({
      package_ref: notionRef,
      kind: 'mcp_server',
      activation_status: 'installed'
    }),
    'activate'
  );
});

test('primaryExtensionAction reopens setup for failed extensions', () => {
  assert.equal(
    primaryExtensionAction({
      package_ref: notionRef,
      kind: 'mcp_server',
      activation_status: 'failed'
    }),
    'configure'
  );
});

test('primaryExtensionAction hides activation for active extensions', () => {
  assert.equal(
    primaryExtensionAction({
      package_ref: notionRef,
      kind: 'mcp_server',
      active: true
    }),
    null
  );
});

test('setupReadyForActivation waits until all setup secrets are provided', () => {
  assert.equal(
    setupReadyForActivation({
      secrets: [{ provided: true }, { provided: true }],
      fields: []
    }),
    true
  );
  assert.equal(
    setupReadyForActivation({
      secrets: [{ provided: true }, { provided: false }],
      fields: []
    }),
    false
  );
  assert.equal(
    setupReadyForActivation({
      secrets: [{ provided: true }],
      fields: [{ name: 'workspace' }]
    }),
    false
  );
});

test('registryConnectButtonState makes manual-token setup actionable', () => {
  assert.deepEqual(registryConnectButtonState({ phase: 'needs-token' }), {
    label: 'Open setup',
    disabled: false,
    action: 'manual_setup',
    variant: 'secondary'
  });
});

test('registryConnectButtonState keeps running and connected phases disabled', () => {
  assert.deepEqual(registryConnectButtonState({ phase: 'waiting' }), {
    label: 'Finish in your browser...',
    disabled: true,
    action: 'wait',
    variant: 'primary'
  });
  assert.deepEqual(registryConnectButtonState({ phase: 'connected' }), {
    label: 'Connected',
    disabled: true,
    action: 'none',
    variant: 'secondary'
  });
  assert.deepEqual(registryConnectButtonState({ phase: 'error' }), {
    label: 'Retry connect',
    disabled: false,
    action: 'connect',
    variant: 'primary'
  });
});
