import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveChannelConnectCommand,
  resolveExtensionConnectCommand,
  resolveExtensionRecoveryAction
} from './channel-connect.js';

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
  assert.equal(notion.package_ref.id, 'notion');
  assert.equal(notion.action.href, '/extensions/registry?setup=1&focus=notion');
  assert.match(notion.action.instructions, /Notion setup/);

  const gmail = resolveExtensionConnectCommand('set up gmail');
  assert.equal(gmail.channel, 'gmail');
  assert.equal(gmail.package_ref.id, 'gmail');
  assert.equal(gmail.action.href, '/extensions/registry?setup=1&focus=gmail');
  assert.match(gmail.action.instructions, /Desktop app client ID/);
});

test('resolveExtensionConnectCommand covers every workbook connector setup prompt', () => {
  const cases = [
    ['connect to Telegram with BotFather', 'telegram', 'channels/telegram'],
    ['connect Google Drive for docs', 'google-drive', 'google-drive'],
    ['connect Google Sheets', 'google-sheets', 'google-sheets'],
    ['connect GitHub', 'github', 'github'],
    ['set up routines', 'routines', null],
    ['connect web access', 'web-http', null]
  ];

  for (const [prompt, channel, packageRef] of cases) {
    const action = resolveExtensionConnectCommand(prompt);
    assert.equal(action.channel, channel, prompt);
    assert.equal(action.strategy, 'extension_setup_link');
    assert.equal(action.package_ref?.id || null, packageRef);
    assert.match(action.action.href, /\/extensions\/registry/);
  }
});

test('resolveExtensionConnectCommand keeps ordinary connector work prompts in the model path', () => {
  assert.equal(resolveExtensionConnectCommand('search notion for the launch notes'), null);
  assert.equal(resolveExtensionConnectCommand('draft a reply to this gmail thread'), null);
  assert.equal(resolveExtensionConnectCommand('search Hacker News for IronClaw'), null);
  assert.equal(resolveExtensionConnectCommand('summarize the latest GitHub release'), null);
});

test('resolveExtensionRecoveryAction maps connector failures to setup links', () => {
  const notion = resolveExtensionRecoveryAction('The notion tool is not installed for this run.');
  assert.equal(notion.channel, 'notion');
  assert.equal(notion.action.href, '/extensions/registry?setup=1&focus=notion');

  const calendar = resolveExtensionRecoveryAction('google_calendar auth required');
  assert.equal(calendar.channel, 'google-calendar');
  assert.equal(calendar.package_ref.id, 'google-calendar');
});

test('resolveExtensionRecoveryAction ignores unrelated failures', () => {
  assert.equal(resolveExtensionRecoveryAction('The run failed because the model timed out.'), null);
});
