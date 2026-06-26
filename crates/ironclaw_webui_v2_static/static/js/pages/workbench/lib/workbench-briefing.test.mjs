import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBriefing, isBriefingIntent } from './workbench-briefing.js';
import { WORKBENCH_VISIBLE_SUGGESTIONS } from './workbench-plan.js';

test('the executive catch-up chips route to the deterministic briefing', () => {
  const executiveChips = WORKBENCH_VISIBLE_SUGGESTIONS.filter(
    (chip) => chip.id === 'needs-me' || chip.id === 'changed-while-away'
  );
  assert.equal(executiveChips.length, 2, 'both executive chips present');
  for (const chip of executiveChips) {
    assert.equal(
      isBriefingIntent(chip.fill),
      true,
      `chip "${chip.label}" fill must trigger the briefing: ${chip.fill}`
    );
  }
});

test('isBriefingIntent matches the chief-of-staff catch-up phrasings', () => {
  for (const phrase of [
    'What needs me today?',
    'what need me',
    'Catch me up',
    'brief me on the morning',
    'daily briefing',
    "what's going on",
    'What should I focus on?',
    'summarize my inbox'
  ]) {
    assert.equal(isBriefingIntent(phrase), true, `expected briefing intent for: ${phrase}`);
  }
});

test('isBriefingIntent rejects open-ended work that needs the agent', () => {
  for (const phrase of [
    '',
    '   ',
    'Draft the Northwind counter and show me the key terms',
    'Research privacy-preserving TEE vendors',
    'Prepare the June investor update',
    'Turn this deck into a one-page memo'
  ]) {
    assert.equal(isBriefingIntent(phrase), false, `expected no briefing intent for: ${phrase}`);
  }
});

test('buildBriefing synthesizes counts and sections from connector data', () => {
  const briefing = buildBriefing({
    gmailReady: true,
    calendarReady: true,
    inboxMessages: [
      { id: 'm1', subject: 'Term sheet', sender: 'Counsel', unread: true },
      { id: 'm2', subject: 'Newsletter', sender: 'The Information', unread: false },
      { id: 'm3', subject: 'Wire confirmation', sender: 'Bank', unread: true }
    ],
    calendarEvents: [
      { id: 'e1', title: 'Legal Weekly', when: 'Mon · 10:00' },
      { id: 'e2', title: 'AI Growth', when: 'Mon · 11:30' }
    ],
    railGroups: [
      {
        id: 'needs-approval',
        label: 'Needs a decision',
        rows: [{ id: 'a1', title: 'Approve and send counter' }]
      },
      {
        id: 'blocked',
        label: 'Blocked',
        rows: [{ id: 'b1', title: 'Slack sign-in expired' }]
      },
      {
        id: 'needs-reply',
        label: 'Needs a reply',
        rows: [{ id: 'r1', title: 'Should be ignored here (covered by inbox)' }]
      }
    ],
    now: new Date('2026-06-20T09:00:00')
  });

  assert.equal(briefing.counts.replies, 2, 'two unread messages');
  assert.equal(briefing.counts.events, 2, 'two calendar events');
  assert.equal(briefing.counts.attention, 2, 'approval + blocked, excluding needs-reply');
  assert.equal(briefing.replies.length, 2, 'only unread surfaced when unread exist');
  assert.ok(briefing.headline.startsWith('Good morning'), 'morning greeting at 09:00');
  assert.ok(/2 replies waiting/.test(briefing.headline));
  assert.deepEqual(
    briefing.sources.map((source) => source.id),
    ['gmail', 'calendar']
  );
  // needs-reply rail rows must NOT leak into the attention section.
  assert.ok(!briefing.attention.some((row) => row.groupId === 'needs-reply'));
});

test('buildBriefing spans GitHub, Drive, and Notion when those connectors are live', () => {
  const briefing = buildBriefing({
    gmailReady: true,
    githubReady: true,
    driveReady: true,
    notionReady: true,
    inboxMessages: [{ id: 'm1', subject: 'Term sheet', sender: 'Counsel', unread: true }],
    githubNotifications: [
      {
        id: 'g1',
        title: 'Bug Bash blocker',
        kind: 'Issue',
        reason: 'mention',
        repo: 'nearai/ironclaw',
        when: '10:00',
        link: 'https://github.com/nearai/ironclaw'
      }
    ],
    driveFiles: [
      {
        id: 'd1',
        name: 'JASON Levels',
        kind: 'Sheet',
        when: '4:11 PM',
        link: 'https://docs.google.com/x'
      }
    ],
    notionPages: [
      {
        id: 'n1',
        title: 'Q2 2026 Management Meeting',
        url: 'https://notion.so/x',
        when: '11:41 AM'
      }
    ],
    now: new Date('2026-06-20T09:00:00')
  });
  assert.equal(briefing.counts.github, 1);
  assert.equal(briefing.counts.drive, 1);
  assert.equal(briefing.counts.notion, 1);
  assert.equal(briefing.github.length, 1);
  assert.equal(briefing.drive.length, 1);
  assert.equal(briefing.notion.length, 1);
  assert.deepEqual(
    briefing.sources.map((s) => s.id),
    ['gmail', 'github', 'drive', 'notion']
  );
  assert.ok(/1 GitHub item/.test(briefing.headline), 'GitHub folded into the headline');
});

test('buildBriefing folds Slack blocker rows into the catch-up briefing', () => {
  const briefing = buildBriefing({
    slackReady: true,
    slackBlockers: [
      {
        id: 's1',
        who: 'cameron',
        channel: 'gtm',
        when: '10:00',
        text: 'Launch copy is blocked on pricing approval',
        permalink: 'https://near-foundation.slack.com/archives/C1/p1781276971079319'
      }
    ],
    now: new Date('2026-06-20T09:00:00')
  });

  assert.equal(briefing.counts.slack, 1);
  assert.equal(briefing.slack.length, 1);
  assert.equal(briefing.slack[0].text, 'Launch copy is blocked on pricing approval');
  assert.deepEqual(
    briefing.sources.map((source) => source.id),
    ['slack']
  );
  assert.ok(/1 Slack item/.test(briefing.headline), 'Slack folded into the headline');
  assert.ok(!/all clear/i.test(briefing.headline), 'Slack rows prevent false all-clear');
});

test('buildBriefing emits slackAwaiting + slackWeighIn as distinct arrays (blocker back-compat intact)', () => {
  const briefing = buildBriefing({
    slackReady: true,
    slackBlockers: [{ id: 'b1', who: 'cameron', channel: 'gtm', text: 'launch is blocked' }],
    slackAwaiting: [
      {
        id: 'a1',
        channel: 'legal',
        who: 'Carla',
        text: 'Cavenwell terms?',
        replyHref: 'https://x/p1'
      }
    ],
    slackWeighIn: [
      {
        id: 'w1',
        channel: 'xfn-np-nf',
        who: 'David',
        text: 'intercompany SA?',
        replyHref: 'https://x/p2'
      }
    ],
    now: new Date('2026-06-20T09:00:00')
  });
  // the two new sourcing arrays are distinct from the legacy blocker list
  assert.equal(briefing.slackAwaiting.length, 1);
  assert.equal(briefing.slackAwaiting[0].channel, 'legal');
  assert.equal(briefing.slackWeighIn.length, 1);
  assert.equal(briefing.slackWeighIn[0].who, 'David');
  assert.equal(briefing.counts.slackAwaiting, 1);
  assert.equal(briefing.counts.slackWeighIn, 1);
  // back-compat: the blocker list (and its count) are untouched
  assert.equal(briefing.slack.length, 1);
  assert.equal(briefing.counts.slack, 1);
});

test('buildBriefing slackAwaiting/slackWeighIn default to [] when not supplied', () => {
  const briefing = buildBriefing({ gmailReady: true, now: new Date('2026-06-20T20:00:00') });
  assert.deepEqual(briefing.slackAwaiting, []);
  assert.deepEqual(briefing.slackWeighIn, []);
  assert.equal(briefing.counts.slackAwaiting, 0);
  assert.equal(briefing.counts.slackWeighIn, 0);
});

test('buildBriefing degrades to an honest all-clear with no data', () => {
  const briefing = buildBriefing({ gmailReady: true, now: new Date('2026-06-20T20:00:00') });
  assert.equal(briefing.counts.replies, 0);
  assert.equal(briefing.counts.events, 0);
  assert.equal(briefing.counts.attention, 0);
  assert.ok(/all clear/i.test(briefing.headline));
  assert.ok(briefing.headline.startsWith('Good evening'), 'evening greeting at 20:00');
});

test('buildBriefing reports failed source reads instead of calling them all clear', () => {
  const briefing = buildBriefing({
    githubReady: true,
    driveReady: true,
    sourceProblems: [
      { id: 'github', label: 'GitHub', detail: 'Could not read GitHub right now.' },
      { id: 'drive', label: 'Drive' },
      { id: 'github', label: 'GitHub duplicate should be ignored' }
    ],
    now: new Date('2026-06-20T20:00:00')
  });

  assert.equal(briefing.counts.sourceProblems, 2);
  assert.equal(briefing.sourceProblems.length, 2);
  assert.ok(/2 sources could not be read/.test(briefing.headline));
  assert.ok(!/all clear/i.test(briefing.headline));
  assert.equal(briefing.sourceProblems[0].label, 'GitHub');
  assert.equal(briefing.sourceProblems[1].label, 'Drive');
  assert.ok(/Try again or reconnect/.test(briefing.sourceProblems[1].detail));
});

test('buildBriefing shows recent threads for display but never calls read mail "waiting"', () => {
  const briefing = buildBriefing({
    gmailReady: true,
    inboxMessages: [
      { id: 'm1', subject: 'Read already', sender: 'A', unread: false },
      { id: 'm2', subject: 'Also read', sender: 'B', unread: false }
    ],
    now: new Date('2026-06-20T13:00:00')
  });
  assert.equal(briefing.counts.replies, 0, 'no unread = nothing waiting');
  assert.equal(briefing.replies.length, 2, 'recent threads still surfaced for display');
  assert.ok(/all clear/i.test(briefing.headline), 'all-clear headline when nothing waits');
});

test('buildBriefing suppresses bulk/newsletter mail from replies-waiting', () => {
  const briefing = buildBriefing({
    inboxMessages: [
      {
        id: 'n1',
        subject: 'Exclusive: Lime Plans IPO',
        sender: 'The Information',
        unread: true,
        isBulk: true
      },
      {
        id: 'n2',
        subject: 'The Briefing: Cannes',
        sender: 'The Information Briefing',
        unread: true,
        isBulk: true
      },
      {
        id: 'h1',
        subject: 'RE: NEAR in Wyoming',
        sender: 'john@salt.org',
        unread: true,
        isBulk: false
      }
    ],
    gmailReady: true,
    now: new Date('2026-06-22T09:00:00')
  });
  assert.equal(briefing.counts.replies, 1, 'only the human thread counts as waiting');
  assert.equal(briefing.replies.length, 1, 'newsletters are not surfaced as replies');
  assert.equal(briefing.replies[0].id, 'h1', 'the surfaced reply is the human thread');
  assert.ok(
    !briefing.replies.some((r) => r.isBulk),
    'no bulk message ever appears in replies-waiting'
  );
  // Transparency: filtered newsletters are counted + named in the headline
  // ("handled, not surfaced"), so suppression is visible, never silent.
  assert.equal(briefing.counts.filed, 2, 'both newsletters are counted as filed');
  assert.match(
    briefing.headline,
    /2 newsletters filed — not surfaced\./,
    'headline owns the filing'
  );
});

test('buildBriefing floats a VIP-corrected sender above Gmail IMPORTANT in replies', () => {
  const briefing = buildBriefing({
    gmailReady: true,
    inboxMessages: [
      {
        id: 'imp',
        subject: 'Board deck',
        sender: 'Chair',
        fromEmail: 'chair@near.foundation',
        unread: true,
        important: true
      },
      {
        id: 'vip',
        subject: 'quick q',
        sender: 'Dana',
        fromEmail: 'dana@northwind.com',
        unread: true,
        important: false
      }
    ],
    tierOverrides: { 'dana@northwind.com': 'vip' },
    now: new Date('2026-06-22T09:00:00')
  });
  assert.equal(briefing.replies[0].id, 'vip', 'VIP-corrected sender leads the replies');
  assert.equal(briefing.counts.replies, 2, 'both still count as waiting');
});

test('buildBriefing drops an Ignore-corrected sender from replies and the waiting count', () => {
  const briefing = buildBriefing({
    gmailReady: true,
    inboxMessages: [
      {
        id: 'keep',
        subject: 'Renewal',
        sender: 'Dana',
        fromEmail: 'dana@northwind.com',
        unread: true,
        important: false
      },
      {
        id: 'drop',
        subject: 'FYI',
        sender: 'Auto',
        fromEmail: 'noreply@vendor.com',
        unread: true,
        important: true
      }
    ],
    tierOverrides: { 'noreply@vendor.com': 'ignore' },
    now: new Date('2026-06-22T09:00:00')
  });
  assert.deepEqual(
    briefing.replies.map((r) => r.id),
    ['keep'],
    'ignore-corrected sender suppressed'
  );
  assert.equal(briefing.counts.replies, 1, 'ignored sender no longer counts as waiting');
});
