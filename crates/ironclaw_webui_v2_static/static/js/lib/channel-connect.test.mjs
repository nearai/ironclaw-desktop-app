import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveChannelConnectCommand, resolveExtensionConnectCommand } from './channel-connect.js';

const slack = {
  channel: 'slack',
  display_name: 'Slack',
  command_aliases: ['slack', 'slack account']
};

test('resolveChannelConnectCommand detects explicit Slack connect requests', () => {
  assert.equal(resolveChannelConnectCommand('connect my Slack account', [slack]), slack);
  assert.equal(resolveChannelConnectCommand('pair slack', [slack]), slack);
  assert.equal(resolveChannelConnectCommand('link the slack app', [slack]), slack);
});

test('resolveChannelConnectCommand leaves ordinary Slack prompts for the model', () => {
  assert.equal(resolveChannelConnectCommand('send a message to Slack', [slack]), null);
  assert.equal(resolveChannelConnectCommand('what is slack?', [slack]), null);
  assert.equal(resolveChannelConnectCommand('connect the two ideas', [slack]), null);
});

test('resolveExtensionConnectCommand creates honest app setup links for connector prompts', () => {
  const notion = resolveExtensionConnectCommand('connect notion to search team docs');
  assert.equal(notion.channel, 'notion');
  assert.equal(notion.strategy, 'extension_setup_link');
  assert.equal(notion.package_ref.id, 'mcp-servers/notion');
  assert.equal(notion.action.href, '/extensions/registry?setup=1&focus=notion');
  assert.match(notion.action.instructions, /Notion setup/);

  const gmail = resolveExtensionConnectCommand('set up gmail');
  assert.equal(gmail.channel, 'gmail');
  assert.equal(gmail.package_ref.id, 'tools/gmail');
  assert.equal(gmail.action.href, '/extensions/registry?setup=1&focus=gmail');
  assert.match(gmail.action.instructions, /Desktop app client ID/);
});

test('resolveExtensionConnectCommand keeps ordinary connector work prompts in the model path', () => {
  assert.equal(resolveExtensionConnectCommand('search notion for the launch notes'), null);
  assert.equal(resolveExtensionConnectCommand('draft a reply to this gmail thread'), null);
});
