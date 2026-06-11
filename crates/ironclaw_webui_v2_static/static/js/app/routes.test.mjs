import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultRoute, primaryRoutes, routeForId } from './routes.js';

function visibleRouteIds() {
  return primaryRoutes.filter((route) => !route.hidden).map((route) => route.id);
}

test('desktop primary information architecture stays simple for normal users', () => {
  assert.equal(defaultRoute, '/chat');
  assert.deepEqual(visibleRouteIds(), ['chat', 'extensions', 'settings']);
});

test('backend-blocked and specialist routes stay deep-link only', () => {
  const hiddenIds = new Set(primaryRoutes.filter((route) => route.hidden).map((route) => route.id));

  for (const id of ['workspace', 'projects', 'jobs', 'routines', 'automations', 'missions', 'admin']) {
    assert.equal(hiddenIds.has(id), true, `${id} should not appear in primary navigation`);
  }
});

test('unknown route ids fall back to chat', () => {
  assert.equal(routeForId('missing').id, 'chat');
});
