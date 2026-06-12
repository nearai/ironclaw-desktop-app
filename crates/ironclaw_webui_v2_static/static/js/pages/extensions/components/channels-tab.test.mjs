import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function channelsTabSourceForTest() {
  const source = readFileSync(new URL('./channels-tab.js', import.meta.url), 'utf8');
  const lines = [];
  for (const line of source.split('\n')) {
    if (line.startsWith('import ')) continue;
    lines.push(line.replace(/^export function /, 'function '));
  }
  return `${lines.join('\n')}\nglobalThis.__testExports = { isSlackChannelEnabled, deriveSlackMessagingState };`;
}

test('isSlackChannelEnabled covers all Slack channel ids', () => {
  const context = { globalThis: {} };
  vm.runInNewContext(channelsTabSourceForTest(), context);
  const { isSlackChannelEnabled } = context.globalThis.__testExports;

  assert.equal(isSlackChannelEnabled(['slack']), true);
  assert.equal(isSlackChannelEnabled(['slack_v2']), true);
  assert.equal(isSlackChannelEnabled(['slack-v2']), true);
  assert.equal(isSlackChannelEnabled([]), false);
  assert.equal(isSlackChannelEnabled(['other']), false);
});

test('deriveSlackMessagingState treats gateway offline as unavailable', () => {
  const context = { globalThis: {} };
  vm.runInNewContext(channelsTabSourceForTest(), context);
  const { deriveSlackMessagingState } = context.globalThis.__testExports;

  const result = deriveSlackMessagingState({
    gatewayOffline: true,
    enabledChannels: ['slack'],
    connectableChannels: [{ channel: 'slack', action: { type: 'oauth' } }]
  });

  assert.equal(result.enabled, false);
  assert.equal(result.connectAction, null);
  assert.equal(result.statusLabel, 'unavailable');
  assert.equal(result.statusTone, 'warning');
});

test('deriveSlackMessagingState only offers connect when gateway exposes Slack setup', () => {
  const context = { globalThis: {} };
  vm.runInNewContext(channelsTabSourceForTest(), context);
  const { deriveSlackMessagingState } = context.globalThis.__testExports;

  const result = deriveSlackMessagingState({
    gatewayOffline: false,
    enabledChannels: [],
    connectableChannels: [{ channel: 'slack', action: { type: 'oauth' } }]
  });

  assert.equal(result.enabled, false);
  assert.equal(result.statusLabel, 'connect');
  assert.equal(result.statusTone, 'info');
});
