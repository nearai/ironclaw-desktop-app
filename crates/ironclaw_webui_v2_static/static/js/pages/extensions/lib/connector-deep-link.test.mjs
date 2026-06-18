import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveConnectorDeepLink } from './connector-deep-link.js';

const installed = [
  { display_name: 'Gmail', package_ref: { kind: 'extension', id: 'gmail' } },
  { display_name: 'Google Calendar', package_ref: { kind: 'extension', id: 'google-calendar' } },
  { display_name: 'Notion', package_ref: { kind: 'extension', id: 'notion' } },
  { display_name: 'Slack', package_ref: { kind: 'extension', id: 'slack' } }
];

const catalog = [
  { entry: { display_name: 'GitHub', package_ref: { kind: 'extension', id: 'tools/github' } } }
];

test('matches a kind-prefixed focus ref to the bare installed connector', () => {
  const resolved = resolveConnectorDeepLink('tools/gmail', { extensions: installed });
  assert.equal(resolved.displayName, 'Gmail');
  assert.equal(resolved.packageRef.id, 'gmail');
});

test('normalizes underscores so tools/google_calendar resolves google-calendar', () => {
  const resolved = resolveConnectorDeepLink('tools/google_calendar', { extensions: installed });
  assert.equal(resolved.displayName, 'Google Calendar');
  assert.equal(resolved.packageRef.id, 'google-calendar');
});

test('resolves an mcp-servers focus ref', () => {
  const resolved = resolveConnectorDeepLink('mcp-servers/notion', { extensions: installed });
  assert.equal(resolved.displayName, 'Notion');
  assert.equal(resolved.packageRef.id, 'notion');
});

test('resolves a channels focus ref', () => {
  const resolved = resolveConnectorDeepLink('channels/slack', { extensions: installed });
  assert.equal(resolved.displayName, 'Slack');
  assert.equal(resolved.packageRef.id, 'slack');
});

test('falls back to catalog entries when not installed', () => {
  const resolved = resolveConnectorDeepLink('tools/github', {
    extensions: [],
    catalogEntries: catalog
  });
  assert.equal(resolved.displayName, 'GitHub');
  assert.equal(resolved.packageRef.id, 'tools/github');
});

test('synthesizes a bare-route ref when nothing matches', () => {
  const resolved = resolveConnectorDeepLink('tools/unknown_tool', { extensions: installed });
  assert.equal(resolved.packageRef.id, 'tools/unknown_tool');
  assert.equal(resolved.displayName, 'unknown-tool');
});

test('returns null for an empty focus ref', () => {
  assert.equal(resolveConnectorDeepLink('', { extensions: installed }), null);
  assert.equal(resolveConnectorDeepLink(null, { extensions: installed }), null);
});
