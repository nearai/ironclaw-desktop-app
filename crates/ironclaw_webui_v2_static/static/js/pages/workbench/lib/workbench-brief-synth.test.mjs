import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBriefSynthesisBundle,
  buildNeedsYouPrompt,
  deriveWorthWeighingIn,
  deriveThisWeek,
  deriveBestTimes,
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

test('deriveWorthWeighingIn surfaces slack signals matching my domain triggers (no LLM)', () => {
  const bundle = buildBriefSynthesisBundle(SAMPLE_BRIEFING, PROFILE);
  // David's signal mentions "AML posture ... legal read" — the legal domain's
  // triggers include "securities"/"custody"/etc; add one the text hits.
  const out = deriveWorthWeighingIn({
    ...bundle,
    slackSignals: [
      {
        id: 's1',
        channel: 'x-intents',
        text: 'New custody flow for partner funds — needs a read.',
        link: 'https://slack/p1'
      },
      { id: 's2', channel: 'x-intents', text: 'Lunch plans for Friday', link: 'https://slack/p2' }
    ]
  });
  assert.equal(out.length, 1, 'only the trigger-matching signal surfaces');
  assert.equal(out[0].id, 's1');
  assert.match(out[0].whyYours, /custody/, 'explains which trigger made it mine');
  assert.equal(out[0].myTake, '', 'no fabricated take without the model');
  assert.equal(out[0].link, 'https://slack/p1');
});

test('deriveWorthWeighingIn is empty when the domain is unknown (radar off, never borrows vocab)', () => {
  const bundle = buildBriefSynthesisBundle(SAMPLE_BRIEFING, { name: 'X', title: 'Marketing Lead' });
  assert.deepEqual(deriveWorthWeighingIn(bundle), []);
});

test('deriveThisWeek lists calendar commitments; deriveBestTimes pulls reply windows', () => {
  const bundle = buildBriefSynthesisBundle(SAMPLE_BRIEFING, PROFILE);
  const week = deriveThisWeek(bundle);
  assert.equal(week.length, 1);
  assert.match(week[0].title, /Regulator call/);
  const best = deriveBestTimes([
    { sender: 'Dana Lee', bestWindow: 'this morning' },
    { sender: 'Dana Lee', bestWindow: 'later' }, // deduped by person
    { sender: 'No Window' }
  ]);
  assert.deepEqual(best, [{ person: 'Dana Lee', window: 'this morning' }]);
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

test('synthesizeBriefing runs ONE needsYou turn and merges the deterministic sections', async () => {
  const sent = [];
  const needsYouJson = JSON.stringify({
    needsYou: [
      {
        id: 'm1',
        source: 'Email',
        sender: 'Dana Lee',
        badges: ['Decision'],
        context: 'Renewal terms.',
        suggestedReply: 'net 45 works.',
        replyHref: 'https://mail.google.com/x',
        bestWindow: 'this morning'
      }
    ]
  });
  // A briefing with a trigger-matching slack signal (custody) + a calendar event,
  // so worthWeighingIn (deterministic radar) and thisWeek (calendar) both populate.
  const briefing = {
    ...SAMPLE_BRIEFING,
    slack: [
      {
        id: 's1',
        channel: '#x-intents',
        sender: 'David Mirzadeh',
        text: 'New custody flow for partner funds — needs a legal read.',
        link: 'https://slack.example/p1'
      }
    ]
  };
  const deps = {
    createThread: async () => ({ thread: { thread_id: 'T1' } }),
    sendMessage: async (args) => {
      sent.push(args);
      return { status: 'Queued' };
    },
    fetchTimeline: async () => ({ messages: [{ kind: 'assistant', content: needsYouJson }] }),
    sleep: async () => {},
    maxTries: 3
  };
  const out = await synthesizeBriefing({ briefing, profile: PROFILE, deps });
  assert.ok(out, 'returns the merged briefing');
  assert.equal(out.needsYou[0].suggestedReply, 'net 45 works.', 'needsYou from the LLM turn');
  assert.match(
    out.worthWeighingIn[0].whyYours,
    /custody/,
    'worthWeighingIn derived deterministically'
  );
  assert.match(out.thisWeek[0].title, /Regulator call/, 'thisWeek derived from the calendar');
  assert.deepEqual(
    out.bestTimes,
    [{ person: 'Dana Lee', window: 'this morning' }],
    'bestTimes from reply windows'
  );
  assert.deepEqual(out.summary, { awaitingReply: 1, flagged: 1, weeklySignals: 1 });
  assert.equal(sent.length, 1, 'exactly ONE LLM turn — the rest is deterministic');
  assert.match(
    sent[0].content,
    /Renewal terms for Q3/,
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
