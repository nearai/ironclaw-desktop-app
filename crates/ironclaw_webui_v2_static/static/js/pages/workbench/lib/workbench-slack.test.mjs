import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildFootprint,
  buildSlackBotIdSet,
  buildSlackEmailDomainMap,
  buildSlackSignals,
  buildSlackUserMap,
  classifySlackRow,
  fetchSlackDeep,
  isBotAuthor,
  isSlackBlockerIntent,
  cleanConversationName,
  normalizeSlackBlockers,
  normalizeSlackChannelList,
  normalizeSlackHistory,
  normalizeSlackRecentSearch,
  resolveSlackSelf,
  resolveSlackSelfFromLookup,
  scoreSlackRelevance,
  slackDisplayName,
  slackSelfLatestByConv,
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
  // A real blocker written across a few short lines that contains an ask is KEPT.
  assert.equal(
    textLooksLikeBlocker(
      'Hey, I am blocked on the deploy.\nThe staging box is down.\nCan you take a look today?'
    ),
    true,
    'multi-line message with a direct ask is a real blocker, not a report'
  );
  // A multi-line status report with no ask still drops.
  assert.equal(
    textLooksLikeBlocker(
      'Daily update:\nshipped the API.\nblocked on staging.\nwaiting on review.'
    ),
    false
  );
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

test('resolveSlackSelfFromLookup reads SLACK_FIND_USER_BY_EMAIL_ADDRESS (single + double wrap)', () => {
  // The shape verified live: data.user with id + profile.
  assert.deepEqual(
    resolveSlackSelfFromLookup({
      successful: true,
      data: { ok: true, user: { id: 'U04MWJDB7EK', profile: { display_name: 'Abhi' } } }
    }),
    { userId: 'U04MWJDB7EK', userName: 'Abhi' }
  );
  // double-wrapped (data.data.user) resolves too
  assert.deepEqual(
    resolveSlackSelfFromLookup({
      successful: true,
      data: { data: { user: { id: 'U1', real_name: 'Real' } } }
    }),
    { userId: 'U1', userName: 'Real' }
  );
  assert.equal(resolveSlackSelfFromLookup(null), null);
  assert.equal(resolveSlackSelfFromLookup({ successful: false }), null);
  assert.equal(resolveSlackSelfFromLookup({ successful: true, data: { ok: false } }), null);
});

test('slackDisplayName: resolved name wins; an unresolved raw id renders as a readable label', () => {
  assert.equal(slackDisplayName('UCARLA', { UCARLA: 'Carla' }), 'Carla');
  assert.equal(slackDisplayName('U082BCSSF6H', {}), 'a teammate', 'raw Slack id is never shown');
  assert.equal(slackDisplayName('W123456', {}), 'a teammate');
  assert.equal(slackDisplayName('', {}), 'a teammate');
  assert.equal(slackDisplayName('cameron', {}), 'cameron', 'a non-id username passes through');
});

// ---- Reply-state gate (replicates the daily-briefing skill's replystate.mjs) -------------
test('classifySlackRow: an @-mention you already answered IN-THREAD is handled (not awaiting)', () => {
  const self = { selfUserId: 'UME', kind: 'channel' };
  // mentioned, you have NOT replied in-thread -> still awaiting
  assert.equal(
    classifySlackRow({ who: 'UCARLA', raw: 'ping <@UME> thoughts?', reply_users: [] }, self),
    'awaiting'
  );
  // mentioned, but you ARE in the thread repliers -> you replied -> handled -> null
  assert.equal(
    classifySlackRow({ who: 'UCARLA', raw: 'ping <@UME> thoughts?', reply_users: ['UME'] }, self),
    null
  );
});

test('slackSelfLatestByConv: extracts the running user latest ts per conversation', () => {
  const result = {
    successful: true,
    data: {
      data: {
        messages: {
          matches: [
            { user: 'UME', ts: '100.0', channel: { id: 'C1' } },
            { user: 'UME', ts: '250.0', channel: { id: 'C1' } }, // later in C1
            { user: 'UCARLA', ts: '999.0', channel: { id: 'C1' } }, // not self → ignored
            { user: 'UME', ts: '50.0', channel: { id: 'C2' } }
          ]
        }
      }
    }
  };
  const map = slackSelfLatestByConv(result, 'UME');
  assert.equal(map.get('C1'), 250);
  assert.equal(map.get('C2'), 50);
  assert.equal(slackSelfLatestByConv(result, '').size, 0, 'no self id → empty');
});

test('buildSlackSignals: drops an awaiting item the user already answered after (reply-state gate)', () => {
  // Two DM messages from a teammate; the user posted (selfLatestByConv) AFTER the first one but
  // before the second. The first is handled (drop); the second is still owed (keep).
  const histories = [
    [
      {
        id: 'old',
        channelId: 'D1',
        channel: 'Direct message',
        kind: 'im',
        who: 'UCARLA',
        raw: 'early question',
        text: 'early question',
        ts: '100',
        reply_count: 0,
        reply_users: []
      },
      {
        id: 'new',
        channelId: 'D1',
        channel: 'Direct message',
        kind: 'im',
        who: 'UCARLA',
        raw: 'later question',
        text: 'later question',
        ts: '300',
        reply_count: 0,
        reply_users: []
      }
    ]
  ];
  const out = buildSlackSignals(histories, {
    selfUserId: 'UME',
    domain: 'near',
    selfLatestByConv: new Map([['D1', 200]]) // you last posted at ts 200
  });
  const texts = out.awaiting.map((i) => i.text);
  assert.ok(!texts.includes('early question'), 'message you already answered after is dropped');
  assert.ok(texts.includes('later question'), 'the message after your last reply is still owed');
});

test('reply-state gate does NOT over-drop: channel @-mention survives unrelated later channel activity', () => {
  // Adversarial-review HIGH: a #channel @-mention you never answered must NOT be silenced just
  // because you later posted something unrelated in that channel. Only a 1:1 DM earns the
  // conversation-level "posted after" signal; channels rely on thread-scoped reply_users.
  const histories = [
    [
      {
        id: 'ask',
        channelId: 'CENG',
        channel: 'eng',
        kind: 'channel',
        who: 'UBOSS',
        raw: 'hey <@UME> can you sign off on the release?',
        text: 'can you sign off on the release?',
        ts: '500',
        reply_count: 0,
        reply_users: []
      }
    ]
  ];
  const out = buildSlackSignals(histories, {
    selfUserId: 'UME',
    domain: 'near',
    selfLatestByConv: new Map([['CENG', 600]]) // you posted later in #eng (unrelated)
  });
  assert.ok(
    out.awaiting.some((i) => /sign off on the release/.test(i.text)),
    'an unanswered channel @-mention is NOT silenced by unrelated later channel traffic'
  );
});

test('reply-state gate NEVER silences a critical item on conversation-level activity', () => {
  // Adversarial-review: a fraud/legal item must not vanish because you posted later in the DM.
  const histories = [
    [
      {
        id: 'fraud',
        channelId: 'CMPDM',
        channel: 'Group DM',
        kind: 'mpim',
        critical: true,
        who: 'UA',
        raw: 'someone is misappropriating client funds',
        text: 'someone is misappropriating client funds',
        ts: '100',
        reply_count: 0,
        reply_users: []
      }
    ]
  ];
  const out = buildSlackSignals(histories, {
    selfUserId: 'UME',
    domain: 'near',
    selfLatestByConv: new Map([['CMPDM', 999]]) // you posted later — must NOT silence the fraud item
  });
  assert.ok(
    out.awaiting.some((i) => /misappropriating client funds/.test(i.text)),
    'a critical item survives later conversation activity (never-miss)'
  );
});

test('classifySlackRow: a critical item you already replied to IN-THREAD is handled (cleared)', () => {
  const base = {
    who: 'UA',
    raw: 'funds misappropriated',
    text: 'funds misappropriated',
    critical: true
  };
  assert.equal(
    classifySlackRow({ ...base, reply_users: [] }, { selfUserId: 'UME', kind: 'mpim' }),
    'awaiting',
    'unanswered critical item surfaces'
  );
  assert.equal(
    classifySlackRow({ ...base, reply_users: ['UME'] }, { selfUserId: 'UME', kind: 'mpim' }),
    null,
    'critical item you replied to in-thread is cleared'
  );
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

test('classifySlackRow: a non-self message in a DM or group DM is awaiting, even with no @-mention', () => {
  const self = { selfUserId: 'UME' };
  // 1:1 DM from someone else → directed at you
  assert.equal(
    classifySlackRow(
      { who: 'UCARLA', raw: 'can we sync on the term sheet', reply_count: 0 },
      { ...self, kind: 'im' }
    ),
    'awaiting'
  );
  // group DM broadcast (@channel, no <@UME>) → still for you
  assert.equal(
    classifySlackRow(
      { who: 'UCARLA', raw: 'Hi <!channel>, funds were misappropriated', reply_count: 0 },
      { ...self, kind: 'mpim' }
    ),
    'awaiting'
  );
  // your own DM message → not awaiting (you already replied)
  assert.equal(
    classifySlackRow({ who: 'UME', raw: 'on it', reply_count: 0 }, { ...self, kind: 'im' }),
    null
  );
  // the SAME quiet message in a CHANNEL (not a DM) is NOT awaiting — channels need a mention/thread
  assert.equal(
    classifySlackRow(
      { who: 'UCARLA', raw: 'can we sync', reply_count: 0 },
      { ...self, kind: 'channel' }
    ),
    null
  );
});

test('cleanConversationName: DM, group DM (drops self), and channel render readably', () => {
  assert.equal(cleanConversationName({ is_im: true, id: 'D1' }, 'im'), 'Direct message');
  assert.equal(
    cleanConversationName(
      { is_mpim: true, name: 'mpdm-bianca.guimaraes--david.norris--abhishek.vaidyanathan-1' },
      'mpim',
      'U0 abhishek'
    ),
    'Group DM · bianca, david'
  );
  assert.equal(cleanConversationName({ name: 'legal' }, 'channel'), 'legal');
});

test('normalizeSlackRecentSearch: keeps DMs/group-DMs + channel @-mentions, drops self + plain channel chatter', () => {
  const result = {
    successful: true,
    data: {
      data: {
        messages: {
          matches: [
            // group DM — kept (direct), tagged mpim
            {
              user: 'UCARLA',
              ts: '1781279600.1',
              text: 'pretence of funds being misappropriated',
              channel: { id: 'C9', name: 'mpdm-carla--abhishek.vaidyanathan-1', is_mpim: true },
              permalink: 'https://x.slack.com/archives/C9/p1'
            },
            // 1:1 DM — kept (direct), tagged im
            {
              user: 'UDANA',
              ts: '1781279500.1',
              text: 'quick q on the MSA',
              channel: { id: 'D1', is_im: true }
            },
            // channel @-mention of me — kept
            {
              user: 'UBOB',
              ts: '1781279400.1',
              text: 'hey <@UME> please review',
              channel: { id: 'C1', name: 'legal' }
            },
            // plain channel chatter (no mention) — dropped (channel read handles it)
            {
              user: 'UBOB',
              ts: '1781279300.1',
              text: 'shipping the feature',
              channel: { id: 'C1', name: 'legal' }
            },
            // my own message — dropped
            { user: 'UME', ts: '1781279200.1', text: 'thanks', channel: { id: 'D1', is_im: true } }
          ]
        }
      }
    }
  };
  const rows = normalizeSlackRecentSearch(result, { selfUserId: 'UME' });
  assert.equal(
    rows.length,
    3,
    'group DM + 1:1 DM + channel @-mention kept; chatter + self dropped'
  );
  const byId = Object.fromEntries(rows.map((r) => [r.channelId, r]));
  assert.equal(byId.C9.kind, 'mpim');
  assert.equal(byId.D1.kind, 'im');
  assert.equal(byId.C1.kind, 'channel');
  assert.equal(byId.C9.permalink, 'https://x.slack.com/archives/C9/p1');
  assert.deepEqual(normalizeSlackRecentSearch({ successful: false }, { selfUserId: 'UME' }), []);
});

test('fetchSlackDeep: a group-DM (recency) AND a channel fraud hit with no @-mention (critical) both surface', async () => {
  // The exact failures the operator hit: (a) an urgent message in a GROUP DM, which the
  // per-channel history fan-out (member CHANNELS only) can't reach — covered by the recency
  // search; and (b) a fraud message in a channel with NO @-mention and NO replies, which the
  // recency feed + normal classifier would skip — covered by the dedicated critical search.
  const recencyQueries = [];
  const read = async (tool, args) => {
    if (tool === 'SLACK_FIND_USER_BY_EMAIL_ADDRESS')
      return { successful: true, data: { user: { id: 'UME', profile: { display_name: 'Abhi' } } } };
    if (tool === 'SLACK_LIST_ALL_USERS')
      return {
        successful: true,
        data: { data: { members: [{ id: 'UME', profile: { email: 'me@near.org' } }] } }
      };
    if (tool === 'SLACK_LIST_ALL_CHANNELS')
      return {
        successful: true,
        data: { channels: [{ id: 'C1', name: 'legal', is_member: true }] }
      };
    if (tool === 'SLACK_FETCH_TEAM_INFO')
      return { successful: true, data: { team: { domain: 'near-foundation' } } };
    if (tool === 'SLACK_FETCH_CONVERSATION_HISTORY')
      return { successful: true, data: { messages: [] } }; // channel quiet — the miss happens here
    if (tool === 'SLACK_SEARCH_MESSAGES') {
      const q = String(args.query || '');
      if (q.startsWith('after:')) {
        recencyQueries.push(q);
        return {
          successful: true,
          data: {
            messages: {
              matches: [
                {
                  user: 'UKONRAD',
                  ts: '1781279600.5',
                  text: 'the issue here is a vote on the contract terms',
                  channel: {
                    id: 'CMPDM',
                    name: 'mpdm-konrad.merino--abhishek.vaidyanathan-1',
                    is_mpim: true
                  },
                  permalink: 'https://near-foundation.slack.com/archives/CMPDM/p1'
                }
              ]
            }
          }
        };
      }
      // the critical (fraud/legal) query: a channel message, NO @UME, NO replies
      return {
        successful: true,
        data: {
          messages: {
            matches: [
              {
                user: 'UFINANCE',
                ts: '1781279500.9',
                text: 'flagging that funds appear to have been misappropriated from the treasury',
                channel: { id: 'CFIN', name: 'finance', is_im: false, is_mpim: false },
                permalink: 'https://near-foundation.slack.com/archives/CFIN/p9'
              }
            ]
          }
        }
      };
    }
    return null;
  };
  const out = await fetchSlackDeep({ read, email: 'me@near.org' });
  assert.equal(out.selfResolved, true);
  assert.match(recencyQueries[0], /^after:\d{4}-\d{2}-\d{2}$/, 'recency search is date-scoped');
  const awaitingTexts = out.awaiting.map((i) => i.text).join(' | ');
  const weighInTexts = out.weighIn.map((i) => i.text).join(' | ');
  // directed group-DM message → awaiting (an owed reply)
  assert.match(awaitingTexts, /vote on the contract terms/, 'directed group-DM message → awaiting');
  // a fraud keyword in a channel you're NOT party to surfaces as weigh-in, never as a top owed
  // reply (so it can't bury today's real owed replies — the adversarial-review fix)
  assert.match(
    weighInTexts,
    /misappropriated from the treasury/,
    'non-directed channel fraud hit → weigh-in, not awaiting'
  );
  assert.doesNotMatch(
    awaitingTexts,
    /from the treasury/,
    'non-directed critical does NOT lead awaiting'
  );
});

test('scoreSlackRelevance: a STALE critical hit decays out of the lead; a FRESH owed @-reply outranks it', () => {
  // Adversarial-review regression: an all-time critical search can return an ancient lexical
  // match (a pasted contract clause). It must NOT floor to the top over today's real owed reply.
  const stale = scoreSlackRelevance(
    {
      who: 'ULEGAL',
      channelId: 'CARCHIVE',
      raw: 'Section 12.3: in the event of fraud or misappropriation, the company may…',
      text: 'Section 12.3: in the event of fraud or misappropriation, the company may…',
      ts: tsAgo(24 * 400), // ~400 days old
      critical: true
    },
    { selfUserId: 'UME', kind: 'awaiting', footprint: buildFootprint([], {}) }
  );
  const freshReply = scoreSlackRelevance(
    {
      who: 'UDEV',
      raw: 'hey <@UME> can you approve the deploy?',
      text: 'hey can you approve the deploy?',
      ts: tsAgo(2)
    },
    { selfUserId: 'UME', kind: 'awaiting', footprint: buildFootprint([], {}) }
  );
  assert.ok(
    freshReply.score > stale.score,
    `fresh owed reply (${freshReply.score}) must outrank a 400-day-old fraud-keyword paste (${stale.score})`
  );
  // and a FRESH critical hit still leads (the original miss must still surface at the top)
  const freshCritical = scoreSlackRelevance(
    {
      who: 'UCFO',
      channelId: 'CMPDM',
      raw: 'funds being sent to a personal wallet under the pretence of a vote',
      text: 'funds being sent to a personal wallet under the pretence of a vote',
      ts: tsAgo(1),
      critical: true
    },
    { selfUserId: 'UME', kind: 'awaiting', footprint: buildFootprint([], {}) }
  );
  assert.ok(
    freshCritical.score >= 0.9,
    `a fresh fraud hit still leads (got ${freshCritical.score})`
  );
});

test('scoreSlackRelevance: broad contract vocab does NOT lead; only fraud/regulatory earns the lead-floor', () => {
  // Adversarial-review #3: a casual DM containing a broad LEGAL_RE word ("charter") must not
  // floor to the top over a genuine high-stakes message.
  const casual = scoreSlackRelevance(
    {
      who: 'UFRIEND',
      channelId: 'D1',
      raw: 'btw is the charter flight still at 3?',
      text: 'btw is the charter flight still at 3?',
      ts: tsAgo(1)
    },
    { selfUserId: 'UME', kind: 'awaiting', footprint: buildFootprint([], {}) }
  );
  assert.equal(casual.lead, false, 'a broad contract word does not earn the lead-floor');
  const regulatory = scoreSlackRelevance(
    {
      who: 'UCOUNSEL',
      channelId: 'D2',
      raw: 'the SEC sent a subpoena — we have to respond this week',
      text: 'the SEC sent a subpoena — we have to respond this week',
      ts: tsAgo(1)
    },
    { selfUserId: 'UME', kind: 'awaiting', footprint: buildFootprint([], {}) }
  );
  assert.equal(regulatory.lead, true, 'fraud/regulatory earns the lead-floor');
  assert.ok(regulatory.score > casual.score, 'regulatory leads above casual contract-word chatter');
});

test('buildSlackSignals: two distinct high-stakes items in ONE group DM both survive dedupe', () => {
  // Adversarial-review #4: per-conversation dedupe must not silently drop a second distinct
  // fraud item from the same conversation (never-miss beats de-clutter).
  const now = Math.floor(Date.now() / 1000);
  const histories = [
    [
      {
        id: 'a',
        channelId: 'CMPDM',
        channel: 'Group DM · x',
        kind: 'mpim',
        critical: true,
        who: 'UA',
        raw: 'funds were misappropriated from the treasury',
        text: 'funds were misappropriated from the treasury',
        ts: String(now - 100),
        reply_count: 0,
        reply_users: []
      },
      {
        id: 'b',
        channelId: 'CMPDM',
        channel: 'Group DM · x',
        kind: 'mpim',
        critical: true,
        who: 'UB',
        raw: 'and there may be a related subpoena coming',
        text: 'and there may be a related subpoena coming',
        ts: String(now - 50),
        reply_count: 0,
        reply_users: []
      }
    ]
  ];
  const out = buildSlackSignals(histories, { selfUserId: 'UME', domain: 'near' });
  assert.equal(out.awaiting.length, 2, 'both distinct high-stakes items in the same DM survive');
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

// ---- C8 relevance ranking -------------------------------------------------------
const NOW = Math.floor(Date.now() / 1000);
const tsAgo = (hours) => String(NOW - Math.round(hours * 3600));
// A footprint where UBOSS is a top peer, C9 a top channel, t9 a touched thread.
const STRONG_FP = {
  peerScore: new Map([['UBOSS', 9]]),
  chanCount: new Map([['C9', 5]]),
  touchedThreads: new Set(['t9']),
  maxChan: 5,
  maxPeer: 9
};

test('buildFootprint reuses the +3 (I @them) / +3 (they @me) / +1 (they post) reach model', () => {
  const histories = [
    [
      { who: 'UME', channelId: 'C1', raw: 'hey <@UBOB> ship it', thread_ts: 'tA' },
      { who: 'UBOB', channelId: 'C1', raw: 'on it', thread_ts: 'tA' },
      { who: 'UCARLA', channelId: 'C1', raw: 'ping <@UME>', thread_ts: '' }
    ]
  ];
  const fp = buildFootprint(histories, { selfUserId: 'UME' });
  assert.equal(fp.peerScore.get('UBOB'), 4, 'I @them (+3) and they post (+1)');
  assert.equal(fp.peerScore.get('UCARLA'), 4, 'they post (+1) and @me (+3)');
  assert.equal(fp.chanCount.get('C1'), 1, 'one self post in C1');
  assert.ok(fp.touchedThreads.has('tA'));
});

test('isBotAuthor is flag-driven (bot-id set), never name-based', () => {
  const botIds = buildSlackBotIdSet({
    data: {
      data: {
        members: [
          { id: 'UBOT', is_bot: true },
          { id: 'UAPP', is_app: true },
          { id: 'UHUMAN', is_bot: false }
        ]
      }
    }
  });
  assert.equal(isBotAuthor('USLACKBOT', botIds), true);
  assert.equal(isBotAuthor('UBOT', botIds), true);
  assert.equal(isBotAuthor('UAPP', botIds), true);
  assert.equal(isBotAuthor('UHUMAN', botIds), false);
  // a human whose display name contains "app"/"workflow" is NOT treated as a bot
  assert.equal(isBotAuthor('UWORKFLOW', botIds), false);
});

test('HARD-NOISE: only a confirmed bot drops an awaiting item; business words never do', () => {
  const botIds = new Set(['UBOT']);
  const bot = scoreSlackRelevance(
    { who: 'UBOT', raw: '<@UME> build failed', text: 'build failed', ts: tsAgo(1) },
    { selfUserId: 'UME', kind: 'awaiting', footprint: STRONG_FP, botIds }
  );
  assert.equal(bot.drop, true);
  assert.equal(bot.reason, 'hard-noise');
  // a HUMAN @-mention mentioning deploy/PR/build is KEPT (the over-drop the review caught)
  for (const text of [
    'deploy 5 is down, can you fix?',
    'PR 22 ready for your review?',
    'I pinned a message for you'
  ]) {
    const human = scoreSlackRelevance(
      { who: 'UDEV', raw: `<@UME> ${text}`, text, ts: tsAgo(1) },
      { selfUserId: 'UME', kind: 'awaiting', footprint: buildFootprint([], {}), botIds }
    );
    assert.equal(human.drop, false, `business words must not drop an owed @-reply: ${text}`);
    assert.ok(human.score >= 0.55);
  }
  // emoji/reactions-only weigh-in is still hard noise
  const emoji = scoreSlackRelevance(
    {
      who: 'UX',
      raw: '🎉',
      text: '🎉',
      ts: tsAgo(1),
      reply_count: 3,
      reply_users: ['UX', 'UY', 'UZ']
    },
    { selfUserId: 'UME', kind: 'weighin', footprint: STRONG_FP, botIds }
  );
  assert.equal(emoji.drop, true, 'emoji-only is hard noise');
});

test('a busy multi-person thread from OUTSIDE the footprint window is kept (no burial)', () => {
  const r = scoreSlackRelevance(
    {
      who: 'UCOFOUNDER',
      channelId: 'CX',
      thread_ts: 'tx',
      raw: 'leaning toward restructuring the org around pods',
      text: 'leaning toward restructuring the org around pods',
      ts: tsAgo(5),
      reply_count: 7,
      reply_users: ['UCOFOUNDER', 'UA', 'UB', 'UC']
    },
    { selfUserId: 'UME', kind: 'weighin', footprint: buildFootprint([], {}) }
  );
  assert.equal(
    r.drop,
    false,
    '>=3 distinct repliers keeps a real discussion even with zero footprint'
  );
  assert.ok(r.score >= 0.34, 'vitality carries it over the bar');
});

test('an urgent message with an incidental social word is NOT dampened as social', () => {
  const r = scoreSlackRelevance(
    {
      who: 'UBOSS',
      channelId: 'C9',
      thread_ts: 't9',
      raw: 'excited to report the outage is a sev1 incident — we cannot proceed',
      text: 'excited to report the outage is a sev1 incident — we cannot proceed',
      ts: tsAgo(1),
      reply_count: 2,
      reply_users: ['UBOSS', 'UA']
    },
    { selfUserId: 'UME', kind: 'weighin', footprint: STRONG_FP }
  );
  assert.equal(r.isSocial, false, 'urgency/blocker language overrides the social word');
  assert.equal(r.drop, false);
});

test('scoreSlackRelevance: an @-mention to me is never dropped and floors high, even from a stranger', () => {
  const r = scoreSlackRelevance(
    {
      who: 'USTRANGER',
      raw: 'hey <@UME> thoughts on this?',
      text: 'hey thoughts on this?',
      ts: tsAgo(2)
    },
    { selfUserId: 'UME', kind: 'awaiting', footprint: buildFootprint([], {}) }
  );
  assert.equal(r.drop, false);
  assert.ok(r.score >= 0.55, `awaiting floor applied (got ${r.score})`);
  assert.equal(r.address, 1);
});

test('scoreSlackRelevance: a high-engagement celebration weigh-in is dropped (social dampener)', () => {
  const r = scoreSlackRelevance(
    {
      who: 'USTRANGER',
      raw: 'congrats team, thrilled to share we shipped! 🎉',
      text: 'congrats team, thrilled to share we shipped! 🎉',
      ts: tsAgo(0.2),
      reply_count: 8,
      reply_users: ['UA', 'UB', 'UC', 'UD', 'UE', 'UF']
    },
    { selfUserId: 'UME', kind: 'weighin', footprint: buildFootprint([], {}) }
  );
  assert.equal(r.isSocial, true);
  assert.equal(r.drop, true, 'vitality alone cannot rescue social chatter');
});

// ---- Legal/regulatory substance is NEVER dropped (adversarial-review regression) -----
// An adversarial review proved that a lexical "drop announcements" filter false-drops
// real legal threads, because legal posts share the IDENTICAL broadcast forms ("Hi team",
// "we heard", "anniversary", "ICYMI", "please join") as brand/celebration noise. The
// approach was reverted in favour of a POSITIVE legal-relevance boost: these exact
// messages must now surface (kept, never social), even from outside the footprint window.
const LEGAL_FALSE_DROP_CASES = [
  'Hi team, we heard from outside counsel that the SEC has questions about the token launch. We are pausing while we assess.',
  'On the vendor MSA: we heard back, they are pushing hard on the uncapped indemnity. Thinking we hold the line on the liability cap.',
  'Please join us to align on the cap-table changes before we file the amended charter.',
  'ICYMI: the DOJ second request response is due and we are realigning the privilege log.'
];
for (const text of LEGAL_FALSE_DROP_CASES) {
  test(`scoreSlackRelevance: legal substance surfaces (never dropped): "${text.slice(0, 32)}…"`, () => {
    const r = scoreSlackRelevance(
      {
        who: 'UCOUNSEL',
        channelId: 'CGEN',
        thread_ts: 'tlegal',
        raw: text,
        text,
        ts: tsAgo(3),
        reply_count: 3,
        reply_users: ['UA', 'UB', 'UC']
      },
      { selfUserId: 'UME', kind: 'weighin', footprint: buildFootprint([], {}) }
    );
    assert.equal(r.isSocial, false, 'legal substance is never treated as social/announcement');
    assert.equal(r.drop, false, 'a CLO must see this');
    assert.ok(r.score >= 0.34, `clears the bar (got ${r.score})`);
  });
}

test('scoreSlackRelevance: a QUIET legal thread (one reply, no footprint) still surfaces', () => {
  // The worst case the review flagged: the contract-anniversary auto-renewal. Few replies,
  // no footprint — the >=3-replier force-keep does NOT apply, so the legal signal alone must
  // carry it. (A social anniversary with no legal substance correctly does NOT get this.)
  const r = scoreSlackRelevance(
    {
      who: 'UCOUNSEL',
      channelId: 'CLEGAL',
      thread_ts: 'tren',
      raw: 'The MSA hits its 3-year anniversary next month, which auto-renews unless we send notice.',
      text: 'The MSA hits its 3-year anniversary next month, which auto-renews unless we send notice.',
      ts: tsAgo(6),
      reply_count: 1,
      reply_users: ['UA']
    },
    { selfUserId: 'UME', kind: 'weighin', footprint: buildFootprint([], {}) }
  );
  assert.equal(r.drop, false, 'a quiet contract auto-renewal is not buried');
  assert.ok(r.score >= 0.34);
});

test('scoreSlackRelevance: the legal boost does NOT rescue a pure social celebration', () => {
  // Guard: adding the legal signal must not weaken social-noise dropping for non-legal text.
  const r = scoreSlackRelevance(
    {
      who: 'USTRANGER',
      channelId: 'CGEN',
      thread_ts: 'tsoc',
      raw: 'congrats team, thrilled to share we shipped! 🎉',
      text: 'congrats team, thrilled to share we shipped! 🎉',
      ts: tsAgo(0.5),
      reply_count: 8,
      reply_users: ['UA', 'UB', 'UC', 'UD']
    },
    { selfUserId: 'UME', kind: 'weighin', footprint: buildFootprint([], {}) }
  );
  assert.equal(r.isSocial, true);
  assert.equal(r.drop, true, 'a pure celebration with no legal substance is still dropped');
});

test('scoreSlackRelevance: a 2-reply stranger thread with no ask is dropped (the core noise case)', () => {
  const r = scoreSlackRelevance(
    {
      who: 'USTRANGER',
      raw: 'lunch?',
      text: 'lunch?',
      ts: tsAgo(0.1),
      reply_count: 2,
      reply_users: ['UX', 'UY']
    },
    { selfUserId: 'UME', kind: 'weighin', footprint: buildFootprint([], {}) }
  );
  assert.equal(r.drop, true);
});

test('scoreSlackRelevance: footprint + liveness clears the bar with NO keyword (relevance generalizes)', () => {
  const r = scoreSlackRelevance(
    {
      who: 'UBOSS',
      channelId: 'C9',
      thread_ts: 't9',
      raw: 'we are leaning toward the second vendor for the rollout',
      text: 'we are leaning toward the second vendor for the rollout',
      ts: tsAgo(2),
      reply_count: 6,
      reply_users: ['UBOSS', 'UA', 'UB', 'UC']
    },
    { selfUserId: 'UME', kind: 'weighin', footprint: STRONG_FP }
  );
  assert.equal(r.drop, false, `strong footprint should clear the bar (score ${r.score})`);
  assert.ok(r.score >= 0.34);
});

test('recency is a multiplier, not the sort key: a strong older thread outranks fresh trivia', () => {
  const strongOld = scoreSlackRelevance(
    {
      who: 'UBOSS',
      channelId: 'C9',
      thread_ts: 't9',
      raw: 'need a decision: go/no-go before the board call?',
      text: 'need a decision: go/no-go before the board call?',
      ts: tsAgo(30),
      reply_count: 6,
      reply_users: ['UBOSS', 'UA', 'UB', 'UC']
    },
    { selfUserId: 'UME', kind: 'weighin', footprint: STRONG_FP }
  );
  const freshTrivia = scoreSlackRelevance(
    {
      who: 'UZ',
      channelId: 'C0',
      raw: 'anyone around',
      text: 'anyone around',
      ts: tsAgo(0.05),
      reply_count: 2,
      reply_users: ['UZ', 'UW']
    },
    { selfUserId: 'UME', kind: 'weighin', footprint: STRONG_FP }
  );
  assert.ok(strongOld.score > freshTrivia.score, 'substance (30h old) beats fresh trivia');
});

test('buildSlackEmailDomainMap maps ids to email domains; skips missing', () => {
  const map = buildSlackEmailDomainMap({
    data: {
      members: [
        { id: 'U1', profile: { email: 'a@near.foundation' } },
        { id: 'U2', profile: {} },
        { id: 'U3', profile: { email: 'b@acme.com' } }
      ]
    }
  });
  assert.equal(map.U1, 'near.foundation');
  assert.equal(map.U3, 'acme.com');
  assert.equal('U2' in map, false);
});

test('buildSlackSignals drops weigh-in noise but keeps a substantive thread', () => {
  // self posts in C9 + mentions UBOSS, so footprint makes UBOSS/C9 relevant.
  const histories = [
    [
      {
        who: 'UME',
        channelId: 'C9',
        raw: 'kicking this off <@UBOSS>',
        text: 'kicking this off',
        ts: tsAgo(5),
        thread_ts: 't9',
        reply_count: 0,
        reply_users: []
      },
      {
        who: 'UBOSS',
        channelId: 'C9',
        raw: 'leaning toward vendor two — need a decision before the call?',
        text: 'leaning toward vendor two — need a decision before the call?',
        ts: tsAgo(3),
        thread_ts: 't9',
        reply_count: 6,
        reply_users: ['UBOSS', 'UA', 'UB', 'UC']
      },
      {
        who: 'USTRANGER',
        channelId: 'C0',
        raw: 'lunch? 🎉',
        text: 'lunch? 🎉',
        ts: tsAgo(0.1),
        thread_ts: 't0',
        reply_count: 2,
        reply_users: ['USTRANGER', 'UQ']
      }
    ]
  ];
  const out = buildSlackSignals(histories, {
    selfUserId: 'UME',
    domain: 'acme',
    userMap: { UBOSS: 'Boss', USTRANGER: 'Stranger' }
  });
  const texts = out.weighIn.map((i) => i.text).join(' | ');
  assert.ok(/vendor two/.test(texts), 'substantive thread kept');
  assert.ok(!/lunch/.test(texts), 'social/low-relevance noise dropped');
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

test('fetchSlackDeep resolves identity via email lookup when the user is NOT in the truncated member list (the enterprise bug)', async () => {
  // The signed-in user is absent from SLACK_LIST_ALL_USERS (org > the 200-row page),
  // exactly the live near-foundation case. The email lookup must still resolve identity
  // so the read does NOT silently go empty.
  const calls = [];
  const read = async (tool, args) => {
    calls.push(tool);
    if (tool === 'SLACK_FIND_USER_BY_EMAIL_ADDRESS') {
      assert.equal(args.email, 'me@near.org');
      return {
        successful: true,
        data: { ok: true, user: { id: 'UME', profile: { display_name: 'Abhi' } } }
      };
    }
    if (tool === 'SLACK_LIST_ALL_USERS') {
      // 200-row page that does NOT contain UME
      return {
        successful: true,
        data: { data: { members: [{ id: 'UCARLA', profile: { email: 'carla@near.org' } }] } }
      };
    }
    if (tool === 'SLACK_LIST_ALL_CHANNELS') {
      return {
        successful: true,
        data: { channels: [{ id: 'C1', name: 'legal', is_member: true, is_archived: false }] }
      };
    }
    if (tool === 'SLACK_FETCH_TEAM_INFO')
      return { successful: true, data: { team: { domain: 'near-foundation' } } };
    if (tool === 'SLACK_FETCH_CONVERSATION_HISTORY') {
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
  assert.equal(out.selfResolved, true, 'lookup resolved identity despite truncated member list');
  assert.equal(out.awaiting.length, 1, 'the @-mention surfaces');
  assert.ok(calls.includes('SLACK_FIND_USER_BY_EMAIL_ADDRESS'));
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
