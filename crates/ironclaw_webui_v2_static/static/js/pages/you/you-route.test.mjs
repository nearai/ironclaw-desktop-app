import assert from 'node:assert/strict';
import test from 'node:test';

import { primaryRoutes } from '../../app/routes.js';

test('the "You" perspective route is registered and visible in the primary nav', () => {
  const route = primaryRoutes.find((r) => r.id === 'you');
  assert.ok(route, 'you route present');
  assert.equal(route.path, '/you', 'reachable at /you');
  assert.equal(route.hidden, false, 'promoted to the visible primary nav');
});
