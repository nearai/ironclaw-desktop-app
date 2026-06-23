import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBriefSynthesisBundle,
  buildNeedsYouPrompt,
  buildRadarPrompt,
  parseBriefJson,
  synthesizeBriefing
} from './workbench-brief-synth.js';

const SAMPLE_BRIEFING = {
  replies: [
    {
      id: 'm1',
      sender: 'Dana Lee <dana@customer.example>',
      subject: 'Renewal terms for Q3',
      preview: 'We would like net 60 and a 12 percent cap on the renewal.',
      unread: true,
      important: true,
      gmailHref: 'https://mail.google.com/mail/u/0/#all/thread-renewal'
    }
  ],
  slack: [
    {
      id: 's1',
      channel: '#x-intents',
      sender: 'David Mirzadeh',
      text: 'AML posture is blocking partner re-engagements — need a legal read before outreach resumes.',
      link: 'https://slack.example/p1'
    }
  ],
  events: [{ id: 'e1', title: 'Regulator call — Bermuda', when: 'Today 1:30pm' }],
  github: [{ title: 'PR #482 merged' }],
  drive: [],
  notion: [],
  attention: [
    { title: 'Time-off approval', detail: 'A report is blocked', groupLabel: 'Needs approval' }
  ]
};

const PROFILE = {
  name: 'Abhishek Vaidyanathan',
  title: 'Chief Legal Officer',
  channels: ['#x-intents', 'X-Intents', ' #kyc_status ']
};

test('buildBriefSynthesisBundle pulls from the deterministic briefing + resolves the profile domain', () => {
  const bundle = buildBriefSynthesisBundle(SAMPLE_BRIEFING, PROFILE);
  assert.equal(bundle.profile.domain, 'legal', 'CLO title resolves to the legal domain');
  assert.deepEqual(
    bundle.profile.channels,
    ['x-intents', 'kyc_status'],
    'channels normalized + deduped'
  );
  assert.ok(bundle.domainTriggers.includes('custody'), 'carries the legal trigger vocabulary');
  assert.equal(bundle.needsReply.length, 1);
  assert.equal(
    bundle.needsReply[0].sender,
    'Dana Lee',
    'sender display name is parsed from the header'
  );
  assert.equal(bundle.needsReply[0].source, 'Email');
  assert.equal(
    bundle.needsReply[0].replyHref,
    'https://mail.google.com/mail/u/0/#all/thread-renewal'
  );
  assert.equal(bundle.slackSignals[0].channel, 'x-intents', 'slack channel stripped of #');
  assert.equal(bundle.calendar[0].title, 'Regulator call — Bermuda');
  assert.equal(bundle.context.attention[0].group, 'Needs approval');
});

test('buildBriefSynthesisBundle clips long bodies so the turn stays short', () => {
  const bundle = buildBriefSynthesisBundle(
    { replies: [{ id: 'x', sender: 'A', subject: 'S', preview: 'y'.repeat(5000) }] },
    {}
  );
  assert.ok(
    bundle.needsReply[0].snippet.length <= 220,
    'snippet capped tight so the turn stays fast'
  );
});

test('buildNeedsYouPrompt is the replies-only turn: needsYou schema + inbox data, no radar', () => {
  const bundle = buildBriefSynthesisBundle(SAMPLE_BRIEFING, PROFILE);
  const p = buildNeedsYouPrompt(bundle, PROFILE);
  assert.match(p, /needsYou/);
  assert.match(p, /Chief Legal Officer/);
  assert.match(p, /Output ONLY one JSON object/i);
  assert.ok(p.includes('Dana Lee'), 'the inbox context is embedded');
  assert.doesNotMatch(
    p,
    /worthWeighingIn/,
    'the radar is a separate turn — keeps this prompt small'
  );
});

test('buildRadarPrompt is the radar/week/times turn, scoped to my domain + channels', () => {
  const bundle = buildBriefSynthesisBundle(SAMPLE_BRIEFING, PROFILE);
  const p = buildRadarPrompt(bundle, PROFILE);
  assert.match(p, /worthWeighingIn/);
  assert.match(p, /thisWeek/);
  assert.match(p, /bestTimes/);
  assert.match(p, /NOT tagged/i, 'radar instruction: only decisions I was not tagged on');
  assert.match(p, /\blegal\b/, 'scoped to my resolved domain');
  assert.doesNotMatch(p, /needsYou/, 'replies are a separate turn');
  assert.ok(p.includes('David Mirzadeh'), 'the slack-signal context is embedded');
});

test('parseBriefJson extracts JSON from a fenced/prose reply and normalizes every field', () => {
  const reply = [
    "Here's your briefing:",
    '```json',
    JSON.stringify({
      summary: { awaitingReply: 99, flagged: 99, weeklySignals: 99 },
      needsYou: [
        {
          id: 'm1',
          source: 'Email',
          sender: 'Dana Lee',
          badges: ['Decision', 'time-sensitive'],
          context: 'Renewal terms need your sign-off.',
          suggestedReply: 'net 45 and an 8% cap work for the renewal.',
          replyHref: 'https://mail.google.com/x',
          bestWindow: 'this morning'
        },
        { sender: '', context: '', suggestedReply: '' }
      ],
      worthWeighingIn: [
        {
          id: 's1',
          title: 'AML posture blocking partner outreach',
          channel: '#x-intents',
          whyYours: 'It is a legal read, on the critical path.',
          myTake: 'A short AML memo unblocks outreach.',
          confidence: 250,
          link: 'https://slack.example/p1'
        }
      ],
      thisWeek: [
        {
          id: 'w1',
          title: 'Agent marketplace launch',
          yourMove: 'lock the gate',
          priority: 'urgent'
        }
      ],
      bestTimes: [{ person: 'David', window: 'now' }]
    }),
    '```'
  ].join('\n');

  const out = parseBriefJson(reply);
  assert.ok(out, 'parsed despite the fence + preamble');
  // counts are derived from the kept arrays, NOT the model's inflated self-report
  assert.deepEqual(out.summary, { awaitingReply: 1, flagged: 1, weeklySignals: 1 });
  assert.equal(out.needsYou.length, 1, 'the empty/malformed needsYou item is dropped');
  assert.equal(out.needsYou[0].sender, 'Dana Lee');
  assert.deepEqual(out.needsYou[0].badges, ['Decision', 'time-sensitive']);
  assert.equal(out.worthWeighingIn[0].confidence, 100, 'confidence clamped to 0..100');
  assert.equal(out.worthWeighingIn[0].channel, 'x-intents', 'channel # stripped');
  assert.equal(out.thisWeek[0].priority, 'med', 'invalid priority coerced to med');
  assert.equal(out.bestTimes[0].person, 'David');
});

test('parseBriefJson returns null on non-JSON or an entirely-empty briefing (caller falls back)', () => {
  assert.equal(parseBriefJson('I could not build a briefing.'), null);
  assert.equal(parseBriefJson(''), null);
  assert.equal(parseBriefJson('{ not valid json'), null);
  assert.equal(
    parseBriefJson(
      JSON.stringify({ needsYou: [], worthWeighingIn: [], thisWeek: [], bestTimes: [] })
    ),
    null,
    'all-empty arrays -> null so the deterministic briefing shows instead'
  );
});

test('synthesizeBriefing runs the two split turns in parallel and merges them', async () => {
  const sent = [];
  const byThread = {};
  let threadN = 0;
  const needsYouJson = JSON.stringify({
    needsYou: [
      {
        id: 'm1',
        source: 'Email',
        sender: 'Dana Lee',
        badges: ['Decision'],
        context: 'Renewal terms.',
        suggestedReply: 'net 45 works.',
        replyHref: 'https://mail.google.com/x'
      }
    ]
  });
  const radarJson = JSON.stringify({
    worthWeighingIn: [
      {
        id: 's1',
        title: 'AML posture',
        channel: 'x-intents',
        whyYours: 'a legal read',
        myTake: 'a short memo',
        confidence: 70,
        link: 'https://slack.example/p1'
      }
    ],
    thisWeek: [{ id: 'w1', title: 'Launch', yourMove: 'lock the gate', priority: 'high' }],
    bestTimes: [{ person: 'David', window: 'now' }]
  });
  const deps = {
    // Distinct thread per turn; the timeline reply is chosen by which prompt that
    // thread received — robust to the two turns running concurrently.
    createThread: async () => ({ thread: { thread_id: `T${++threadN}` } }),
    sendMessage: async (args) => {
      sent.push(args);
      byThread[args.threadId] = String(args.content || '');
      return { status: 'Queued' };
    },
    fetchTimeline: async ({ threadId }) => {
      const isRadar = /worthWeighingIn/.test(byThread[threadId] || '');
      return { messages: [{ kind: 'assistant', content: isRadar ? radarJson : needsYouJson }] };
    },
    sleep: async () => {},
    maxTries: 3
  };
  const out = await synthesizeBriefing({ briefing: SAMPLE_BRIEFING, profile: PROFILE, deps });
  assert.ok(out, 'returns the merged briefing');
  assert.equal(out.needsYou[0].suggestedReply, 'net 45 works.', 'needsYou from the replies turn');
  assert.equal(out.worthWeighingIn[0].title, 'AML posture', 'radar from the second turn');
  assert.equal(out.thisWeek[0].yourMove, 'lock the gate');
  assert.equal(out.bestTimes[0].person, 'David');
  assert.deepEqual(out.summary, { awaitingReply: 1, flagged: 1, weeklySignals: 1 });
  assert.equal(sent.length, 2, 'exactly two turns');
  assert.ok(
    sent.some((m) => /Renewal terms for Q3/.test(m.content)),
    'the inbox context rode into the replies turn'
  );
});

test('synthesizeBriefing returns null on missing deps, empty bundle, or timeout (never fabricates)', async () => {
  // missing deps
  assert.equal(await synthesizeBriefing({ briefing: SAMPLE_BRIEFING, deps: {} }), null);
  // empty bundle (nothing read) -> null, caller shows the deterministic all-clear
  const liveDeps = {
    createThread: async () => ({ thread_id: 'T2' }),
    sendMessage: async () => ({ status: 'Queued' }),
    fetchTimeline: async () => ({ messages: [{ kind: 'assistant', content: '{}' }] }),
    sleep: async () => {},
    maxTries: 2
  };
  assert.equal(await synthesizeBriefing({ briefing: {}, profile: PROFILE, deps: liveDeps }), null);
  // timeout: assistant never returns usable JSON
  assert.equal(
    await synthesizeBriefing({ briefing: SAMPLE_BRIEFING, profile: PROFILE, deps: liveDeps }),
    null
  );
});
