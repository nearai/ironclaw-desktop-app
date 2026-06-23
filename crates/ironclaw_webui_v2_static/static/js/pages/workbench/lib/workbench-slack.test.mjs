import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildSlackSignals,
  buildSlackUserMap,
  classifySlackRow,
  fetchSlackDeep,
  isSlackBlockerIntent,
  normalizeSlackBlockers,
  normalizeSlackChannelList,
  normalizeSlackHistory,
  resolveSlackSelf,
  SLACK_BLOCKER_QUERY,
  slackArchiveLink,
  slackTeamDomain,
  textLooksLikeBlocker
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
    assert.equal(
      isSlackBlockerIntent(phrase),
      false,
      `expected no slack-blocker intent: ${phrase}`
    );
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
            text: 'Hey <@U08NSBJ8C9G>, the <https://x.com|signup> is blocked & waiting',
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

test('textLooksLikeBlocker keeps terse asks and drops status-report broadcasts', () => {
  // Real, terse, directed blockers — keep.
  assert.equal(
    textLooksLikeBlocker('Hey @abhi, the signup is blocked & waiting — can you unblock?'),
    true
  );
  assert.equal(textLooksLikeBlocker("I'm stuck on the staging deploy, who can help?"), true);
  // Status reports that merely MENTION blocker words — drop.
  assert.equal(
    textLooksLikeBlocker(
      "IronClaw QA Update: Bug Bash June 12 Morning\n\nWhat's Working\nGoogle services are stable.\nBlocked: recovery flow still failing.\nWaiting on staging."
    ),
    false,
    'multi-line QA Update is a broadcast, not a blocker'
  );
  assert.equal(
    textLooksLikeBlocker('Weekly status update: a few items are blocked and waiting on review'),
    false,
    'report-titled single line is still a broadcast'
  );
  assert.equal(textLooksLikeBlocker('   '), false, 'empty -> not a blocker');
});

test('normalizeSlackBlockers filters out a multi-line QA status report (false positive)', () => {
  const rows = normalizeSlackBlockers({
    successful: true,
    data: {
      messages: {
        matches: [
          {
            iid: 'report',
            username: 'joe',
            channel: { id: 'C9', name: 'bug-bash' },
            ts: '1781276971.0',
            text: "IronClaw QA Update: Bug Bash June 12\n\nWhat's Working\nGoogle services stable.\nBlocked: recovery flow.\nWaiting on staging deploy.",
            permalink: 'https://x.slack.com/archives/C9/p1'
          },
          {
            iid: 'real',
            username: 'dana',
            channel: { id: 'C1', name: 'gtm' },
            ts: '1781276971.5',
            text: 'blocked on the pricing sign-off — can you take a look today?',
            permalink: 'https://x.slack.com/archives/C1/p2'
          }
        ]
      }
    }
  });
  assert.deepEqual(
    rows.map((r) => r.id),
    ['real'],
    'the QA status report is dropped; the real terse blocker survives'
  );
});

test('normalizeSlackBlockers returns [] for unsuccessful or malformed payloads', () => {
  assert.deepEqual(normalizeSlackBlockers(null), []);
  assert.deepEqual(normalizeSlackBlockers({ successful: false }), []);
  assert.deepEqual(normalizeSlackBlockers({ data: {} }), []);
  assert.deepEqual(normalizeSlackBlockers({ data: { messages: { matches: 'nope' } } }), []);
});

// ---- Deep Slack read: identity, channels, history, classifier ----

// SLACK_LIST_ALL_USERS double-wraps members under data.data.members (verified live).
const USERS_RESULT = {
  successful: true,
  data: {
    data: {
      members: [
        { id: 'USLACKBOT', name: 'slackbot', profile: {} },
        { id: 'UME', name: 'abhi', real_name: 'Abhishek', profile: { email: 'Me@Near.org' } },
        { id: 'UCARLA', name: 'carla', profile: { display_name: 'Carla', email: 'carla@near.org' } }
      ]
    }
  }
};

test('resolveSlackSelf matches the signed-in user by email (case-insensitive), null when unknown', () => {
  assert.deepEqual(resolveSlackSelf(USERS_RESULT, 'me@near.org'), {
    userId: 'UME',
    userName: 'Abhishek'
  });
  assert.equal(resolveSlackSelf(USERS_RESULT, 'nobody@near.org'), null, 'unknown email -> null');
  assert.equal(resolveSlackSelf(USERS_RESULT, ''), null, 'empty email -> null (never guesses)');
  assert.equal(resolveSlackSelf({ successful: false }, 'me@near.org'), null);
});

test('buildSlackUserMap maps user ids to display names', () => {
  const map = buildSlackUserMap(USERS_RESULT);
  assert.equal(map.UCARLA, 'Carla', 'display_name preferred');
  assert.equal(map.UME, 'Abhishek', 'real_name fallback');
  assert.deepEqual(buildSlackUserMap({ data: {} }), {});
});

test('slackTeamDomain extracts the subdomain; rejects junk', () => {
  assert.equal(
    slackTeamDomain({ successful: true, data: { team: { domain: 'near-foundation' } } }),
    'near-foundation'
  );
  assert.equal(slackTeamDomain({ data: { domain: 'acme' } }), 'acme');
  assert.equal(
    slackTeamDomain({ data: { team: { domain: 'has space' } } }),
    '',
    'invalid -> empty'
  );
  assert.equal(slackTeamDomain(null), '');
});

test('normalizeSlackChannelList keeps member, non-archived channels and caps', () => {
  const result = {
    successful: true,
    data: {
      channels: [
        { id: 'C1', name: 'legal', is_member: true, is_archived: false },
        { id: 'C2', name: 'random', is_member: false, is_archived: false },
        { id: 'C3', name: 'old', is_member: true, is_archived: true },
        { id: 'C4', name: 'abound', is_member: true, is_archived: false }
      ]
    }
  };
  assert.deepEqual(normalizeSlackChannelList(result, { limit: 8 }), [
    { id: 'C1', name: 'legal' },
    { id: 'C4', name: 'abound' }
  ]);
  assert.equal(normalizeSlackChannelList(result, { limit: 1 }).length, 1, 'cap respected');
  assert.deepEqual(normalizeSlackChannelList({ data: {} }), []);
});

test('slackArchiveLink synthesizes a deep link; empty when any part is missing (never fabricates)', () => {
  assert.equal(
    slackArchiveLink('near-foundation', 'C1', '1781279514.137379'),
    'https://near-foundation.slack.com/archives/C1/p1781279514137379'
  );
  assert.equal(slackArchiveLink('', 'C1', '1.2'), '', 'no domain -> no link');
  assert.equal(slackArchiveLink('acme', '', '1.2'), '');
  assert.equal(slackArchiveLink('acme', 'C1', ''), '');
});

test('normalizeSlackHistory cleans text, keeps raw for mention detection, skips subtypes', () => {
  const rows = normalizeSlackHistory(
    {
      successful: true,
      data: {
        messages: [
          {
            user: 'UCARLA',
            ts: '1781279514.1',
            text: 'Hey <@UME>, how should we approach the Cavenwell negotiation?',
            thread_ts: '1781279514.1',
            reply_count: 3,
            reply_users: ['UCARLA', 'UBIANCA']
          },
          { user: 'UBOT', ts: '2', text: 'joined', subtype: 'channel_join' },
          { user: 'UX', ts: '3', text: '   ' }
        ]
      }
    },
    { channelId: 'C1', channelName: 'legal' }
  );
  assert.equal(rows.length, 1, 'subtype + empty rows dropped');
  assert.equal(rows[0].who, 'UCARLA');
  assert.equal(rows[0].channel, 'legal');
  assert.match(rows[0].raw, /<@UME>/, 'raw mention preserved for classification');
  assert.equal(rows[0].text, 'Hey @someone, how should we approach the Cavenwell negotiation?');
  assert.equal(rows[0].reply_count, 3);
  assert.deepEqual(rows[0].reply_users, ['UCARLA', 'UBIANCA']);
  assert.deepEqual(normalizeSlackHistory({ data: {} }, { channelId: 'C1' }), []);
});

test('classifySlackRow: @mention of me = awaiting; absent active thread = weighin; else null', () => {
  const self = { selfUserId: 'UME' };
  // someone mentions me, not my own message -> awaiting
  assert.equal(
    classifySlackRow(
      { who: 'UCARLA', raw: 'ping <@UME> please', reply_count: 0, reply_users: [] },
      self
    ),
    'awaiting'
  );
  // my own message that happens to contain my id -> not awaiting
  assert.equal(
    classifySlackRow(
      { who: 'UME', raw: '<@UME> note to self', reply_count: 0, reply_users: [] },
      self
    ),
    null
  );
  // active thread I'm absent from, not tagged -> weighin
  assert.equal(
    classifySlackRow(
      {
        who: 'UCARLA',
        raw: 'decision on the SA?',
        reply_count: 4,
        reply_users: ['UCARLA', 'UBIANCA']
      },
      self
    ),
    'weighin'
  );
  // thread I'm already in -> not weighin (I'm not absent)
  assert.equal(
    classifySlackRow(
      { who: 'UCARLA', raw: 'decision?', reply_count: 4, reply_users: ['UME'] },
      self
    ),
    null
  );
  // quiet message, no mention, <2 replies -> null
  assert.equal(
    classifySlackRow({ who: 'UCARLA', raw: 'fyi shipped', reply_count: 1, reply_users: [] }, self),
    null
  );
  // no identity -> null (never flags)
  assert.equal(
    classifySlackRow({ who: 'UCARLA', raw: 'ping <@UME>', reply_count: 0 }, { selfUserId: '' }),
    null
  );
});

test('buildSlackSignals merges channels into awaiting/weighin, resolves names, links, sorts, caps', () => {
  const histories = [
    [
      {
        id: '1781279600.0',
        channelId: 'C1',
        channel: 'legal',
        who: 'UCARLA',
        raw: 'Hey <@UME>, Cavenwell terms?',
        text: 'Hey @someone, Cavenwell terms?',
        ts: '1781279600.0',
        when: '9:00 AM',
        thread_ts: '',
        reply_count: 0,
        reply_users: []
      }
    ],
    [
      {
        id: '1781279500.0',
        channelId: 'C2',
        channel: 'xfn-np-nf',
        who: 'UDAVID',
        raw: 'intercompany SA — what do we do?',
        text: 'intercompany SA — what do we do?',
        ts: '1781279500.0',
        when: '8:50 AM',
        thread_ts: '1781279500.0',
        reply_count: 4,
        reply_users: ['UDAVID', 'UBIANCA']
      }
    ]
  ];
  const out = buildSlackSignals(histories, {
    selfUserId: 'UME',
    domain: 'near-foundation',
    userMap: { UCARLA: 'Carla', UDAVID: 'David' }
  });
  assert.equal(out.awaiting.length, 1);
  assert.equal(out.awaiting[0].who, 'Carla', 'author id resolved to name');
  assert.equal(out.awaiting[0].channel, 'legal');
  assert.match(out.awaiting[0].replyHref, /near-foundation\.slack\.com\/archives\/C1\/p1781279600/);
  assert.equal(out.weighIn.length, 1);
  assert.equal(out.weighIn[0].who, 'David');
  assert.equal(out.weighIn[0].channel, 'xfn-np-nf');
  // thread link uses thread_ts when present
  assert.match(out.weighIn[0].replyHref, /\/p1781279500/);
});

test('fetchSlackDeep orchestrates identity → channels → history → classified signals', async () => {
  const calls = [];
  const read = async (tool, args) => {
    calls.push(tool);
    if (tool === 'SLACK_LIST_ALL_USERS') {
      return {
        successful: true,
        data: {
          data: {
            members: [
              { id: 'UME', profile: { email: 'me@near.org', display_name: 'Abhi' } },
              { id: 'UCARLA', profile: { email: 'carla@near.org', display_name: 'Carla' } }
            ]
          }
        }
      };
    }
    if (tool === 'SLACK_LIST_ALL_CHANNELS') {
      return {
        successful: true,
        data: { channels: [{ id: 'C1', name: 'legal', is_member: true, is_archived: false }] }
      };
    }
    if (tool === 'SLACK_FETCH_TEAM_INFO') {
      return { successful: true, data: { team: { domain: 'near-foundation' } } };
    }
    if (tool === 'SLACK_FETCH_CONVERSATION_HISTORY') {
      assert.equal(args.channel, 'C1');
      return {
        successful: true,
        data: {
          messages: [{ user: 'UCARLA', ts: '1781279600.1', text: 'Hey <@UME>, Cavenwell terms?' }]
        }
      };
    }
    return null;
  };
  const out = await fetchSlackDeep({ read, email: 'me@near.org', channelLimit: 8 });
  assert.equal(out.selfResolved, true);
  assert.equal(out.awaiting.length, 1);
  assert.equal(out.awaiting[0].who, 'Carla');
  assert.match(out.awaiting[0].replyHref, /near-foundation\.slack\.com\/archives\/C1\//);
  assert.ok(calls.includes('SLACK_FETCH_CONVERSATION_HISTORY'), 'fanned out to channel history');
});

test('fetchSlackDeep degrades to empty when identity is unresolved or reader missing', async () => {
  // identity cannot be matched -> empty, and history is NOT fetched
  const calls = [];
  const read = async (tool) => {
    calls.push(tool);
    if (tool === 'SLACK_LIST_ALL_USERS')
      return { successful: true, data: { data: { members: [] } } };
    return { successful: true, data: { channels: [{ id: 'C1', is_member: true }] } };
  };
  const unresolved = await fetchSlackDeep({ read, email: 'me@near.org' });
  assert.deepEqual(unresolved, { awaiting: [], weighIn: [], selfResolved: false });
  assert.ok(
    !calls.includes('SLACK_FETCH_CONVERSATION_HISTORY'),
    'no history read without identity'
  );
  // no reader at all -> empty
  assert.deepEqual(await fetchSlackDeep({}), { awaiting: [], weighIn: [], selfResolved: false });
});
