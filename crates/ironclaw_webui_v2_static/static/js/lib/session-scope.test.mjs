import assert from 'node:assert/strict';
import test from 'node:test';
import { scopeFromBearerToken } from './session-scope.js';

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function jwt(claims, signature = 'sig') {
  return `${base64UrlJson({ alg: 'none', typ: 'JWT' })}.${base64UrlJson(claims)}.${signature}`;
}

test('scopeFromBearerToken hashes the whole bearer instead of trusting JWT claims', () => {
  const claims = {
    iss: 'https://issuer.example',
    sub: 'user-123',
    email: 'person@example.com'
  };
  const token = jwt(claims);
  const scope = scopeFromBearerToken(token);

  assert.match(scope, /^token:[a-f0-9]{64}$/);
  assert.doesNotMatch(scope, /issuer\.example/);
  assert.doesNotMatch(scope, /user-123/);
  assert.doesNotMatch(scope, /person@example\.com/);
  assert.equal(scope, scopeFromBearerToken(token));
  assert.notEqual(scope, scopeFromBearerToken(jwt(claims, 'different-signature')));
});

test('scopeFromBearerToken falls back to a stable non-raw opaque-token scope', () => {
  const scope = scopeFromBearerToken('opaque-secret-token');

  assert.match(scope, /^token:[a-f0-9]{64}$/);
  assert.doesNotMatch(scope, /opaque-secret-token/);
  assert.equal(scope, scopeFromBearerToken('opaque-secret-token'));
});

test('scopeFromBearerToken returns null for blank tokens', () => {
  assert.equal(scopeFromBearerToken(''), null);
  assert.equal(scopeFromBearerToken('   '), null);
});
