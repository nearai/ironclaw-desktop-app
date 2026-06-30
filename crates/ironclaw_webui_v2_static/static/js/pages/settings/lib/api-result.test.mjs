import assert from 'node:assert/strict';
import test from 'node:test';

import { throwIfApiFailed } from './api-result.js';

test('throwIfApiFailed throws on success:false so the mutation rejects', () => {
  assert.throws(() => throwIfApiFailed({ success: false, message: 'Conflict' }), /Conflict/);
});

test('throwIfApiFailed uses the fallback message when none is provided', () => {
  assert.throws(() => throwIfApiFailed({ success: false }, 'Save failed'), /Save failed/);
});

test('throwIfApiFailed returns the data unchanged on success', () => {
  const ok = { success: true, value: 1 };
  assert.equal(throwIfApiFailed(ok), ok);

  const passthrough = { value: 2 };
  assert.equal(throwIfApiFailed(passthrough), passthrough);
  assert.equal(throwIfApiFailed(null), null);
});
