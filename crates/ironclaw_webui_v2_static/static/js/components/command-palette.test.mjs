import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCommandPaletteActions,
  visibleCommandRoutes
} from './command-palette.js';

test('command palette mirrors the simplified visible desktop routes', () => {
  assert.deepEqual(
    visibleCommandRoutes().map((route) => route.id),
    ['chat', 'automations', 'extensions', 'settings']
  );
});

test('command palette actions do not expose hidden product surfaces', () => {
  const actions = buildCommandPaletteActions({
    navigate: () => {},
    onNewChat: () => {},
    onToggleTheme: () => {}
  });
  const labels = actions.map((action) => action.label);

  assert.equal(labels.includes('Go to Chat'), true);
  assert.equal(labels.includes('Go to Automations'), true);
  assert.equal(labels.includes('Go to Extensions'), true);
  assert.equal(labels.includes('Go to Settings'), true);

  for (const hidden of ['Projects', 'Missions', 'Jobs', 'Routines', 'Admin']) {
    assert.equal(
      labels.some((label) => label.includes(hidden)),
      false,
      `${hidden} should not appear in the command palette`
    );
  }
});

test('command palette route actions navigate to the registered route paths', () => {
  const navigated = [];
  const actions = buildCommandPaletteActions({
    navigate: (path) => navigated.push(path),
    onNewChat: () => {},
    onToggleTheme: () => {}
  });

  actions.find((action) => action.id === 'go-automations').run();
  actions.find((action) => action.id === 'go-settings').run();

  assert.deepEqual(navigated, ['/automations', '/settings']);
});
