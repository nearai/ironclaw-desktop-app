import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultRoute, primaryRoutes, routeForId } from './routes.js';

function visibleRouteIds() {
  return primaryRoutes.filter((route) => !route.hidden).map((route) => route.id);
}

test('desktop primary information architecture stays simple for normal users', () => {
  // Chat is the front door. Workbench is a separate product instance, kept
  // deep-link-only and off the desktop information architecture.
  assert.equal(defaultRoute, '/chat');
  assert.deepEqual(visibleRouteIds(), [
    'you',
    'chat',
    'work',
    'automations',
    'extensions',
    'settings'
  ]);
});

test('saved work surface is a registered, visible route', () => {
  const work = primaryRoutes.find((route) => route.id === 'work');
  assert.ok(work, 'work route should be registered');
  assert.equal(work.hidden, false);
  assert.equal(work.path, '/work');
});

test('workbench stays registered but hidden — a separate product instance', () => {
  const workbench = primaryRoutes.find((route) => route.id === 'workbench');
  assert.ok(workbench, 'workbench route should stay registered (deep-link only)');
  assert.equal(workbench.hidden, true);
  assert.equal(workbench.path, '/workbench');
});

test('backend-blocked and specialist routes stay deep-link only', () => {
  const hiddenIds = new Set(primaryRoutes.filter((route) => route.hidden).map((route) => route.id));

  // 'automations' was promoted to visible nav (real read-only viewer); the rest
  // stay deep-link only until their backends are real ('routines' is still a
  // TODO stub, so it must stay hidden).
  for (const id of ['workspace', 'projects', 'jobs', 'routines', 'missions', 'admin']) {
    assert.equal(hiddenIds.has(id), true, `${id} should not appear in primary navigation`);
  }
});

test('unknown route ids fall back to the workbench replacement surface', () => {
  assert.equal(routeForId('missing').id, 'workbench');
});
