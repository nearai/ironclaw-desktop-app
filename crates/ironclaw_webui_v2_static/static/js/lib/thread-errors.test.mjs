import assert from 'node:assert/strict';
import test from 'node:test';

import { deleteThreadErrorMessage, isThreadBusyError } from './thread-errors.js';

const t = (key) => key;

test('isThreadBusyError matches the busy kind, not any 409', () => {
  assert.equal(isThreadBusyError({ status: 409, payload: { kind: 'busy' } }), true);
  assert.equal(isThreadBusyError({ payload: { kind: 'busy' } }), false);
  assert.equal(isThreadBusyError({ status: 409, payload: { kind: 'conflict' } }), false);
  assert.equal(isThreadBusyError({ status: 409 }), false);
  assert.equal(isThreadBusyError({ status: 500 }), false);
  assert.equal(isThreadBusyError(undefined), false);
});

test('deleteThreadErrorMessage surfaces a clear line for a running thread', () => {
  const error = { status: 409, payload: { error: 'conflict', kind: 'busy' }, message: 'Busy' };
  assert.equal(deleteThreadErrorMessage(error, t), 'chat.deleteBusy');
});

test('deleteThreadErrorMessage falls back to the API message, then a generic line', () => {
  assert.equal(deleteThreadErrorMessage({ message: 'Not found' }, t), 'Not found');
  assert.equal(deleteThreadErrorMessage({}, t), 'chat.deleteFailed');
});
