import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBriefSynthesisBundle,
  buildNeedsYouPrompt,
  buildWorthWeighingInPrompt,
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

test('buildNeedsYouPrompt carries the never-miss-legal carve-out (broadcast-phrased legal is never dropped)', () => {
  const bundle = buildBriefSynthesisBundle(SAMPLE_BRIEFING, PROFILE);
  const p = buildNeedsYouPrompt(bundle, PROFILE);
  // it still instructs dropping announcements/broadcasts...
  assert.match(p, /DROP everything else/i);
  assert.match(p, /announcements, broadcasts/i);
  // ...but carves out legal/regulatory/governance so a CLO never misses one phrased as an FYI
  assert.match(p, /EXCEPTION/);
  assert.match(p, /never drop a legal, regulatory, fraud, governance, contract/i);
  assert.match(p, /KEEP it/i, 'tie-breaks toward keeping a possibly-legal item');
});

test('buildBriefSynthesisBundle folds slackAwaiting into needsReply (Slack-first) + carries weighInCandidates + voiceSample', () => {
  const briefing = {
    ...SAMPLE_BRIEFING,
    slackAwaiting: [
      {
        id: 'sa1',
        channel: 'legal',
        who: 'Carla',
        text: 'Cavenwell directorship — how do we approach the negotiation?',
        when: '2:13 PM',
        replyHref: 'https://near-foundation.slack.com/archives/C1/p1'
      }
    ],
    slackWeighIn: [
      {
        id: 'sw1',
        channel: 'xfn-np-nf',
        who: 'David',
        text: 'intercompany SA structure?',
        replyHref: 'https://near-foundation.slack.com/archives/C2/p2'
      }
    ]
  };
  const profile = { ...PROFILE, voiceSample: ['lowercase decisive reply.', '  '] };
  const bundle = buildBriefSynthesisBundle(briefing, profile);
  // Slack awaiting leads, email follows
  assert.equal(bundle.needsReply[0].source, 'Slack');
  assert.equal(bundle.needsReply[0].sender, 'Carla');
  assert.equal(bundle.needsReply[0].channel, 'legal');
  assert.match(bundle.needsReply[0].replyHref, /archives\/C1\/p1/);
  assert.equal(bundle.needsReply[1].source, 'Email', 'email reply follows the Slack one');
  // weigh-in candidates carried from slackWeighIn
  assert.equal(bundle.weighInCandidates.length, 1);
  assert.equal(bundle.weighInCandidates[0].channel, 'xfn-np-nf');
  assert.equal(bundle.weighInCandidates[0].sender, 'David');
  // voiceSample trimmed of blanks, capped
  assert.deepEqual(bundle.profile.voiceSample, ['lowercase decisive reply.']);
});

test('buildNeedsYouPrompt carries the voice directive + the voiceSample few-shot', () => {
  const bundle = buildBriefSynthesisBundle(SAMPLE_BRIEFING, {
    ...PROFILE,
    voiceSample: ["fine to match the terms, but i'm not signing uncapped liability."]
  });
  const p = buildNeedsYouPrompt(bundle, PROFILE);
  assert.match(p, /all-lowercase/, 'voice directive present');
  assert.ok(p.includes('not signing uncapped liability'), 'voiceSample embedded as a few-shot');
  assert.match(p, /2-4 sentences/, 'deeper context spec');
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

test('deriveWorthWeighingIn prefers pre-classified weighInCandidates over the trigger fallback', () => {
  // weighInCandidates surface directly (pre-classified) regardless of domain triggers.
  const out = deriveWorthWeighingIn({
    domainTriggers: [],
    weighInCandidates: [
      {
        id: 'w1',
        channel: 'xfn-np-nf',
        text: 'intercompany SA — margined or not?',
        link: 'https://s/p1'
      }
    ],
    slackSignals: []
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'w1');
  assert.equal(out[0].channel, 'xfn-np-nf');
  assert.match(out[0].whyYours, /weren't tagged/);
  assert.equal(out[0].myTake, '', 'deterministic fallback omits a take');
  assert.equal(out[0].confidence, null);
});

test('buildWorthWeighingInPrompt carries the candidates + take/confidence schema, not needsYou', () => {
  const bundle = buildBriefSynthesisBundle(SAMPLE_BRIEFING, PROFILE);
  const candidates = [
    { id: 'w1', title: 'intercompany SA structure', channel: 'xfn-np-nf', link: 'https://s/p1' }
  ];
  const p = buildWorthWeighingInPrompt(bundle, candidates, PROFILE);
  assert.match(p, /worthWeighingIn/);
  assert.match(p, /take/);
  assert.match(p, /confidence/);
  assert.match(p, /NOT tagged/);
  assert.ok(p.includes('w1'), 'candidate id echoed');
  assert.doesNotMatch(p, /needsYou/, 'the radar turn does not carry the replies');
});

test('parseBriefJson accepts the "take" alias for myTake and a top-level intro', () => {
  const out = parseBriefJson(
    JSON.stringify({
      intro: 'Pulled from Slack and Email. Most loops already closed — left those out.',
      worthWeighingIn: [
        {
          id: 'w1',
          title: 'intercompany SA',
          channel: '#xfn-np-nf',
          whyYours: 'transfer pricing sits in legal',
          take: 'test whether a cost-allocation + CIA satisfies the auditor without the margin.',
          confidence: 80,
          link: 'https://s/p1'
        }
      ]
    })
  );
  assert.ok(out);
  assert.match(out.intro, /left those out/);
  assert.match(out.worthWeighingIn[0].myTake, /cost-allocation/, '"take" maps to myTake');
  assert.equal(out.worthWeighingIn[0].confidence, 80);
  assert.equal(out.worthWeighingIn[0].channel, 'xfn-np-nf');
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

test('parseBriefJson: garbage -> null, but a well-formed EMPTY briefing is a valid result (bias to silence)', () => {
  assert.equal(parseBriefJson('I could not build a briefing.'), null);
  assert.equal(parseBriefJson(''), null);
  assert.equal(parseBriefJson('{ not valid json'), null);
  assert.equal(parseBriefJson('{}'), null, 'no recognized keys -> null (partial stream / garbage)');
  // The model judging everything out ("nothing needs you") is a VALID, expected answer — it
  // must NOT be discarded as a parse failure. Discarding it was the bug that left the home
  // showing deterministic noise even after the model correctly returned an empty result.
  const empty = parseBriefJson(
    JSON.stringify({ needsYou: [], worthWeighingIn: [], thisWeek: [], bestTimes: [] })
  );
  assert.ok(empty, 'a well-formed empty briefing is a valid result, not null');
  assert.deepEqual(empty.needsYou, []);
  assert.deepEqual(empty.worthWeighingIn, []);
});

const NEEDS_YOU_JSON = JSON.stringify({
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

// Build deps whose fetchTimeline answers each thread with the JSON for whichever
// prompt was sent to it (needsYou vs radar), captured per unique thread id.
function twoTurnDeps(sent, { radarJson } = {}) {
  let seq = 0;
  const promptByThread = {};
  return {
    createThread: async () => ({ thread: { thread_id: `T${++seq}` } }),
    sendMessage: async ({ threadId, content }) => {
      sent.push({ threadId, content });
      promptByThread[threadId] = content;
      return { status: 'Queued' };
    },
    fetchTimeline: async ({ threadId }) => {
      const prompt = promptByThread[threadId] || '';
      const isRadar = /worthWeighingIn/.test(prompt);
      const content = isRadar ? radarJson || '{}' : NEEDS_YOU_JSON;
      return { messages: [{ kind: 'assistant', content }] };
    },
    sleep: async () => {},
    maxTries: 3
  };
}

test('synthesizeBriefing runs needsYou + radar turns IN PARALLEL and merges both', async () => {
  const sent = [];
  // A briefing with a trigger-matching slack signal (custody) + a calendar event, so
  // the radar turn fires over a real candidate and thisWeek populates.
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
  const radarJson = JSON.stringify({
    worthWeighingIn: [
      {
        id: 's1',
        title: 'custody flow for partner funds',
        channel: '#x-intents',
        whyYours: 'custody sits in legal',
        take: 'a short memo unblocks it.',
        confidence: 80,
        link: 'https://slack.example/p1'
      }
    ]
  });
  const out = await synthesizeBriefing({
    briefing,
    profile: PROFILE,
    deps: twoTurnDeps(sent, { radarJson })
  });
  assert.ok(out, 'returns the merged briefing');
  assert.equal(out.needsYou[0].suggestedReply, 'net 45 works.', 'needsYou from turn A');
  // worthWeighingIn ENRICHED by the radar turn (take maps from the alias + confidence)
  assert.equal(
    out.worthWeighingIn[0].myTake,
    'a short memo unblocks it.',
    'radar turn enriched the take'
  );
  assert.equal(out.worthWeighingIn[0].confidence, 80);
  assert.match(out.thisWeek[0].title, /Regulator call/, 'thisWeek derived from the calendar');
  assert.deepEqual(out.bestTimes, [{ person: 'Dana Lee', window: 'this morning' }]);
  assert.deepEqual(out.summary, { awaitingReply: 1, flagged: 1, weeklySignals: 1 });
  assert.ok(out.intro.startsWith('Pulled from'), 'deterministic provenance intro');
  // TWO turns, run concurrently — one carries the replies, one the radar.
  assert.equal(sent.length, 2, 'exactly two LLM turns');
  assert.ok(
    sent.some((s) => /Renewal terms for Q3/.test(s.content)),
    'one turn carried the inbox context'
  );
  assert.ok(
    sent.some((s) => /worthWeighingIn/.test(s.content)),
    'the other turn was the radar'
  );
});

test('synthesizeBriefing biases to silence: turn B yielding nothing leaves worthWeighingIn EMPTY (not unjudged candidates)', async () => {
  const sent = [];
  const briefing = {
    ...SAMPLE_BRIEFING,
    slack: [
      {
        id: 's1',
        channel: '#x-intents',
        text: 'New custody flow for partner funds — needs a read.',
        link: 'https://slack.example/p1'
      }
    ]
  };
  // radarJson omitted -> the radar JUDGE turn returns '{}' (no worthWeighingIn). The
  // candidates are UNJUDGED noise, so they must NOT be surfaced — an empty section is honest.
  // (Previously this fell back to the raw candidates, which is the noise-on-the-home failure
  // mode the ruthless judgment fixes.)
  const out = await synthesizeBriefing({ briefing, profile: PROFILE, deps: twoTurnDeps(sent) });
  assert.ok(out, 'still returns a brief (the needsYou turn ran)');
  assert.deepEqual(out.worthWeighingIn, [], 'unjudged candidates are dropped, not surfaced');
  assert.equal(sent.length, 2, 'both turns still attempted');
});

test('synthesizeBriefing emits a progressive partial (needsYou + deterministic radar) before the final', async () => {
  const sent = [];
  const partials = [];
  const briefing = {
    ...SAMPLE_BRIEFING,
    slack: [
      { id: 's1', channel: '#x-intents', text: 'custody flow question', link: 'https://s/p1' }
    ]
  };
  const radarJson = JSON.stringify({
    worthWeighingIn: [
      {
        id: 's1',
        title: 'custody flow',
        channel: 'x-intents',
        whyYours: 'mine',
        take: 'do it.',
        confidence: 70,
        link: 'https://s/p1'
      }
    ]
  });
  const out = await synthesizeBriefing({
    briefing,
    profile: PROFILE,
    deps: twoTurnDeps(sent, { radarJson }),
    onPartial: (b) => partials.push(b)
  });
  assert.ok(partials.length >= 1, 'a partial brief was emitted');
  assert.equal(partials[0].needsYou[0].suggestedReply, 'net 45 works.', 'partial has needsYou');
  // final is enriched
  assert.equal(out.worthWeighingIn[0].myTake, 'do it.');
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
