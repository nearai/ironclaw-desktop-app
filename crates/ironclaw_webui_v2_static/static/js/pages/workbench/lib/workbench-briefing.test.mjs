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
