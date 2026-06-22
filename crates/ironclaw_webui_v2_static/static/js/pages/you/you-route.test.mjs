import assert from 'node:assert/strict';
import test from 'node:test';

import { primaryRoutes } from '../../app/routes.js';

test('the "You" perspective route is registered (hidden until promoted to nav)', () => {
  const route = primaryRoutes.find((r) => r.id === 'you');
  assert.ok(route, 'you route present');
  assert.equal(route.path, '/you', 'reachable at /you');
  assert.equal(route.hidden, true, 'hidden until tiering reads a fuller sent window');
});
