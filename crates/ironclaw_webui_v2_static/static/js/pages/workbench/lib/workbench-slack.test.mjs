import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isSlackBlockerIntent,
  normalizeSlackBlockers,
  SLACK_BLOCKER_QUERY
} from './workbench-slack.js';
import { isBriefingIntent } from './workbench-briefing.js';
import { WORKBENCH_VISIBLE_SUGGESTIONS } from './workbench-plan.js';

test('isSlackBlockerIntent matches blocker-in-slack phrasings and the chip fill', () => {
  const chip = WORKBENCH_VISIBLE_SUGGESTIONS.find((c) => c.id === 'slack-blockers');
  assert.ok(chip, 'slack-blockers chip exists');
  for (const phrase of [
    'Find Slack blockers',
    'check slack for anything blocked',
    'what is stuck in slack',
    chip.fill
  ]) {
    assert.equal(isSlackBlockerIntent(phrase), true, `expected slack-blocker intent: ${phrase}`);
  }
});

test('isSlackBlockerIntent ignores non-slack and non-blocker text', () => {
  for (const phrase of [
    '',
    'Find blockers in my inbox',
    'Catch me up',
    'send a slack message to the team',
    'research TEE vendors'
  ]) {
    assert.equal(isSlackBlockerIntent(phrase), false, `expected no slack-blocker intent: ${phrase}`);
  }
});

test('slack-blocker and briefing intents do not collide', () => {
  const chip = WORKBENCH_VISIBLE_SUGGESTIONS.find((c) => c.id === 'slack-blockers');
  assert.equal(isBriefingIntent(chip.fill), false, 'slack chip fill must not trigger the briefing');
});

test('SLACK_BLOCKER_QUERY uses OR-joined synonyms (Slack search ANDs spaces)', () => {
  assert.match(SLACK_BLOCKER_QUERY, /\bOR\b/);
  assert.doesNotMatch(SLACK_BLOCKER_QUERY, /"/, 'no quoted phrases (they returned zero matches)');
});

test('normalizeSlackBlockers maps real SLACK_SEARCH_MESSAGES matches', () => {
  const rows = normalizeSlackBlockers({
    successful: true,
    data: {
      messages: {
        matches: [
          {
            iid: 'abc',
            username: 'cameron',
            channel: { id: 'C1', name: 'gtm' },
            ts: '1781276971.079319',
            text: "Hey <@U08NSBJ8C9G>, the <https://x.com|signup> is blocked & waiting",
            permalink: 'https://near-foundation.slack.com/archives/C1/p1781276971079319'
          },
          { text: '   ', ts: '1', channel: 'noise' }
        ]
      }
    }
  });
  assert.equal(rows.length, 1, 'empty-text rows are dropped');
  const [row] = rows;
  assert.equal(row.who, 'cameron');
  assert.equal(row.channel, 'gtm');
  assert.equal(row.text, 'Hey @someone, the signup is blocked & waiting', 'mentions/links cleaned');
  assert.ok(row.permalink.startsWith('https://'));
  assert.ok(row.when, 'a human time is derived from the float ts');
});

test('normalizeSlackBlockers returns [] for unsuccessful or malformed payloads', () => {
  assert.deepEqual(normalizeSlackBlockers(null), []);
  assert.deepEqual(normalizeSlackBlockers({ successful: false }), []);
  assert.deepEqual(normalizeSlackBlockers({ data: {} }), []);
  assert.deepEqual(normalizeSlackBlockers({ data: { messages: { matches: 'nope' } } }), []);
});
