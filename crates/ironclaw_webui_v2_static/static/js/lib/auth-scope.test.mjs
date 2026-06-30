import assert from 'node:assert/strict';
import test from 'node:test';

import { ANON_SCOPE, authScope, hasAuthScope, setAuthScope } from './auth-scope.js';

test('setAuthScope accepts explicit strings and tenant/user objects', () => {
  setAuthScope(null);
  assert.equal(authScope(), ANON_SCOPE);
  assert.equal(hasAuthScope(), false);

  setAuthScope('token:abc123');
  assert.equal(authScope(), 'token:abc123');
  assert.equal(hasAuthScope(), true);

  setAuthScope({ tenant_id: 'tenant-a', user_id: 'user-b' });
  assert.equal(authScope(), 'tenant-a:user-b');
  assert.equal(hasAuthScope(), true);

  setAuthScope(null);
  assert.equal(authScope(), ANON_SCOPE);
  assert.equal(hasAuthScope(), false);
});

test('setAuthScope does not accept ad-hoc scope_id session objects', () => {
  setAuthScope({ scope_id: 'token:should-not-win' });
  assert.equal(authScope(), ANON_SCOPE);
  assert.equal(hasAuthScope(), false);
});
