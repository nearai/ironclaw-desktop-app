import assert from 'node:assert/strict';
import test from 'node:test';

import {
  answeredThreadIndex,
  buildWeekColumns,
  weekTimeWindow,
  layoutDayColumn,
  cleanEmailBody,
  connectorFamilyReadiness,
  decodeBase64Part,
  extractHtmlBody,
  gmailMessageHref,
  gmailProfileEmail,
  hasActiveToolkit,
  isAnsweredThread,
  isCalendarInviteNoise,
  normalizeCalendarEvents,
  normalizeConnectedAccounts,
  normalizeFullMessage,
  normalizeInboxMessages,
  selectTriageInbox,
  toEpochMs,
  unreadInboxCount,
  urgencyScore
} from './workbench-connectors.js';

test('toEpochMs parses epoch-ms strings, ISO dates, and degrades to 0', () => {
  assert.equal(toEpochMs('1718900000000'), 1718900000000);
  assert.equal(toEpochMs('2026-06-20T10:00:00Z'), Date.parse('2026-06-20T10:00:00Z'));
  assert.equal(toEpochMs(''), 0);
  assert.equal(toEpochMs('not-a-date'), 0);
  assert.equal(toEpochMs(null), 0);
});

test('gmailProfileEmail extracts the self email from GMAIL_GET_PROFILE (response_data envelope)', () => {
  assert.equal(
    gmailProfileEmail({
      successful: true,
      data: { response_data: { emailAddress: 'abhishek.vaidyanathan@near.foundation' } }
    }),
    'abhishek.vaidyanathan@near.foundation'
  );
  // envelope fallbacks + honest-empty on malformed/unsuccessful
  assert.equal(gmailProfileEmail({ data: { data: { email: 'x@y.com' } } }), 'x@y.com');
  assert.equal(gmailProfileEmail({ data: { emailAddress: 'z@y.com' } }), 'z@y.com');
  assert.equal(gmailProfileEmail({ successful: false }), '');
  assert.equal(gmailProfileEmail(null), '');
  assert.equal(gmailProfileEmail({ data: { response_data: {} } }), '');
});

test('answeredThreadIndex maps threadId -> latest sent timestamp', () => {
  const index = answeredThreadIndex([
    { threadId: 'T1', timestamp: '1000000000000' },
    { threadId: 'T1', timestamp: '1000000005000' }, // later reply in same thread wins
    { threadId: 'T2', timestamp: '2026-01-01T00:00:00Z' },
    { threadId: '', timestamp: '999' }, // no threadId -> skipped
    { threadId: 'T3', timestamp: 'garbage' } // unparseable -> skipped
  ]);
  assert.equal(index.get('T1'), 1000000005000);
  assert.equal(index.get('T2'), Date.parse('2026-01-01T00:00:00Z'));
  assert.equal(index.has('T3'), false);
  assert.equal(index.size, 2);
});

test('isAnsweredThread: positive evidence only (sent after inbound)', () => {
  const index = new Map([['T1', 2000]]);
  // you replied after the inbound -> answered
  assert.equal(isAnsweredThread({ threadId: 'T1', timestamp: '1000' }, index), true);
  // your reply predates this newer inbound -> still waiting
  assert.equal(isAnsweredThread({ threadId: 'T1', timestamp: '3000' }, index), false);
  // no sent record for this thread -> never falsely filed
  assert.equal(isAnsweredThread({ threadId: 'T9', timestamp: '1000' }, index), false);
  // missing index/thread/ts -> false (bias to surface)
  assert.equal(isAnsweredThread({ threadId: 'T1', timestamp: '1000' }, null), false);
  assert.equal(isAnsweredThread({ threadId: '', timestamp: '1000' }, index), false);
  assert.equal(isAnsweredThread({ threadId: 'T1', timestamp: '' }, index), false);
});

test('urgencyScore: named signals raise the score; pure + bounded', () => {
  const now = 1_800_000_000_000;
  const base = {
    subject: 'lunch',
    preview: 'see you there',
    timestamp: String(now),
    important: false
  };
  const ask = { ...base, subject: 'Can you review this?' };
  const deadline = { ...base, preview: 'need this by EOD Friday please' };
  const blocking = { ...base, preview: "I'm blocked waiting on you" };
  const important = { ...base, important: true };
  assert.ok(urgencyScore(ask, { now }) > urgencyScore(base, { now }), 'an ask scores higher');
  assert.ok(
    urgencyScore(deadline, { now }) > urgencyScore(base, { now }),
    'a deadline scores higher'
  );
  assert.ok(
    urgencyScore(blocking, { now }) > urgencyScore(base, { now }),
    'a blocker scores higher'
  );
  assert.ok(
    urgencyScore(important, { now }) > urgencyScore(base, { now }),
    'IMPORTANT lifts proximity'
  );
  // Older unread ramps up (age signal), capped in [0,1].
  const old = { ...base, timestamp: String(now - 80 * 3600000) };
  assert.ok(urgencyScore(old, { now }) > urgencyScore(base, { now }), 'older mail scores higher');
  const s = urgencyScore(
    { ...ask, ...deadline, important: true, timestamp: String(now - 100 * 3600000) },
    { now }
  );
  assert.ok(s >= 0 && s <= 1, 'score stays within 0..1');
  assert.equal(urgencyScore(null), 0);
  assert.equal(urgencyScore({}), urgencyScore({}), 'deterministic on empty');
});

test('buildWeekColumns lays out a rolling week, places + sorts events, splits all-day', () => {
  const now = 1_750_000_000_000;
  const cols = buildWeekColumns(
    [
      {
        id: 'review',
        title: 'Review',
        when: 'Tue · 14:00',
        start: String(now + 24 * 3600000 + 2 * 3600000)
      },
      { id: 'standup', title: 'Standup', when: 'Mon · 09:30', start: String(now + 3600000) },
      { id: 'coffee', title: 'Coffee', when: 'Mon · 08:00', start: String(now) },
      { id: 'ooo', title: 'OOO', when: 'Mon · all day', start: String(now + 1800000) }
    ],
    { now, days: 7 }
  );
  assert.equal(cols.length, 7, 'a rolling 7-day week');
  assert.equal(cols[0].isToday, true);
  assert.equal(cols[1].isTomorrow, true);
  // today's column: timed events sorted by start; the all-day event split off
  assert.deepEqual(
    cols[0].timed.map((e) => e.id),
    ['coffee', 'standup']
  );
  assert.equal(cols[0].timed[0].timeLabel, '08:00', 'time read from the · separator');
  assert.deepEqual(
    cols[0].allDay.map((e) => e.id),
    ['ooo']
  );
  assert.equal(cols[0].allDay[0].allDay, true);
  // tomorrow's column holds the next-day event
  assert.deepEqual(
    cols[1].timed.map((e) => e.id),
    ['review']
  );
  assert.deepEqual(buildWeekColumns([]).length, 7, 'empty input still yields the week scaffold');
  assert.deepEqual(buildWeekColumns(null).length, 7);
});

test('weekTimeWindow brackets events to whole hours; defaults when empty', () => {
  const cols = [
    {
      timed: [
        { startMin: 9 * 60 + 15, endMin: 10 * 60 },
        { startMin: 16 * 60, endMin: 17 * 60 + 30 }
      ]
    }
  ];
  const w = weekTimeWindow(cols);
  assert.equal(w.startMin, 480, 'earliest 9:15 brackets down to 08:00');
  assert.equal(w.endMin, 1080, 'latest 17:30 brackets up to 18:00');
  const d = weekTimeWindow([]);
  assert.equal(d.startMin, 480);
  assert.equal(d.endMin, 1140);
});

test('layoutDayColumn splits overlaps into lanes, full width when free', () => {
  const laid = layoutDayColumn(
    [
      { id: 'a', startMin: 540, endMin: 600 }, // 9:00-10:00
      { id: 'b', startMin: 570, endMin: 630 }, // 9:30-10:30 (overlaps a)
      { id: 'c', startMin: 840, endMin: 900 } // 14:00-15:00 (free)
    ],
    540,
    1020
  );
  const byId = Object.fromEntries(laid.map((e) => [e.id, e]));
  assert.equal(byId.a.laneCount, 2);
  assert.equal(byId.a.leftPct, 0);
  assert.equal(byId.a.widthPct, 50);
  assert.equal(byId.b.leftPct, 50, 'overlapping event gets the second lane');
  assert.equal(byId.c.laneCount, 1);
  assert.equal(byId.c.widthPct, 100, 'a free event spans the column');
  assert.equal(byId.a.topPct, 0, 'window start sits at the top');
  assert.equal(byId.c.topPct, ((840 - 540) / 480) * 100);
  assert.deepEqual(layoutDayColumn([], 540, 1020), []);
});

test('buildWeekColumns is today-onward: past + out-of-window events are dropped', () => {
  const now = 1_750_000_000_000;
  const cols = buildWeekColumns(
    [
      { id: 'past', title: 'Yesterday', when: 'Sun · 10:00', start: String(now - 30 * 3600000) },
      {
        id: 'far',
        title: 'Next month',
        when: 'Wed · 10:00',
        start: String(now + 40 * 24 * 3600000)
      },
      { id: 'today', title: 'Now', when: 'Mon · 09:00', start: String(now) }
    ],
    { now }
  );
  const placed = cols.flatMap((c) => [...c.allDay, ...c.timed].map((e) => e.id));
  assert.deepEqual(placed, ['today'], 'only the in-window event lands; past + far are dropped');
});

test('normalizeCalendarEvents extracts a join URL from hangoutLink/conferenceData/location', () => {
  const rows = normalizeCalendarEvents(
    {
      successful: true,
      data: {
        events: [
          {
            id: 'a',
            summary: 'Meet',
            start: { dateTime: '2026-06-22T12:00:00Z' },
            hangoutLink: 'https://meet.google.com/abc-defg-hij'
          },
          {
            id: 'b',
            summary: 'Conf',
            start: { dateTime: '2026-06-22T13:00:00Z' },
            conferenceData: {
              entryPoints: [
                { entryPointType: 'phone', uri: 'tel:+1' },
                { entryPointType: 'video', uri: 'https://zoom.us/j/123' }
              ]
            }
          },
          {
            id: 'c',
            summary: 'Loc',
            start: { dateTime: '2026-06-22T14:00:00Z' },
            location: 'Room 4 https://teams.microsoft.com/l/meetup'
          },
          {
            id: 'd',
            summary: 'None',
            start: { dateTime: '2026-06-22T15:00:00Z' },
            location: 'Boardroom'
          }
        ]
      }
    },
    { limit: 10 }
  );
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(byId.a.joinUrl, 'https://meet.google.com/abc-defg-hij', 'hangoutLink');
  assert.equal(byId.b.joinUrl, 'https://zoom.us/j/123', 'conferenceData video entry point');
  assert.equal(byId.c.joinUrl, 'https://teams.microsoft.com/l/meetup', 'meeting URL in location');
  assert.equal(byId.d.joinUrl, undefined, 'no join URL when none present');
});

test('selectTriageInbox reply-state gate files answered threads, keeps open loops', () => {
  const messages = [
    { messageId: 'a', threadId: 'T1', fromEmail: 'x@y.com', timestamp: '1000' }, // answered
    { messageId: 'b', threadId: 'T2', fromEmail: 'x@y.com', timestamp: '1000' }, // open
    { messageId: 'c', threadId: 'T3', fromEmail: 'x@y.com', timestamp: '5000' } // replied earlier, new inbound -> open
  ];
  const sentThreadIndex = new Map([
    ['T1', 2000],
    ['T3', 2000]
  ]);
  const kept = selectTriageInbox(messages, { sentThreadIndex }).map((m) => m.messageId);
  assert.deepEqual(kept, ['b', 'c']);
  // No index -> nothing filed by the reply-state gate (backward compatible).
  assert.equal(selectTriageInbox(messages, {}).length, 3);
});

test('decodeBase64Part decodes base64url Gmail part data to text', () => {
  const text = '<p>Hi & bye — net 60?</p>';
  const b64 = Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  assert.equal(decodeBase64Part(b64), text);
  assert.equal(decodeBase64Part(''), '');
  assert.equal(decodeBase64Part(null), '');
});

test('extractHtmlBody pulls the text/html part out of a (nested) Gmail payload', () => {
  const htmlData = Buffer.from(
    '<html><body><table><tr><td>Renewal</td></tr></table></body></html>'
  ).toString('base64');
  const payload = {
    mimeType: 'multipart/mixed',
    parts: [
      {
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { data: Buffer.from('plain').toString('base64') } },
          { mimeType: 'text/html', body: { data: htmlData } }
        ]
      }
    ]
  };
  assert.match(extractHtmlBody(payload), /<table><tr><td>Renewal/);
  assert.equal(
    extractHtmlBody({ mimeType: 'text/plain', body: { data: 'x' } }),
    '',
    'plain-only -> no html'
  );
  assert.equal(extractHtmlBody(null), '');
});

test('normalizeFullMessage surfaces htmlBody for a native render, body as fallback', () => {
  const htmlData = Buffer.from('<html><body><p>Rich body</p></body></html>').toString('base64');
  const full = normalizeFullMessage({
    successful: true,
    data: {
      messageId: 'm1',
      messageText: 'Rich body',
      payload: {
        mimeType: 'multipart/alternative',
        parts: [{ mimeType: 'text/html', body: { data: htmlData } }]
      }
    }
  });
  assert.equal(full.ok, true);
  assert.match(full.htmlBody, /<p>Rich body<\/p>/, 'htmlBody carries the original HTML');
  assert.equal(full.body, 'Rich body', 'plain-text fallback preserved');
  const plain = normalizeFullMessage({
    successful: true,
    data: { messageId: 'm2', messageText: 'just text' }
  });
  assert.equal(plain.htmlBody, '', 'plain-only message has no htmlBody (panel uses text)');
  assert.equal(plain.body, 'just text');
});

test('isCalendarInviteNoise flags every calendar-invite-system email (incl. "with note"), keeps real mail', () => {
  // all calendar-system mail is noise in "needs a reply" — the Calendar tab owns it
  for (const subject of [
    'Invitation: Abhi <> Alycia @ Wed Jun 24',
    'Updated invitation: Board sync @ Mon Jun 30',
    'Canceled event: Hot Takes @ Tue',
    // the real-world variant that slipped through: organizer added a note
    'Canceled event with note: Hot Takes | NEAR @ Wed (abhi@near.foundation)',
    'Updated invitation with note: Standup',
    'Cancelled event: Standup',
    'Accepted: Vendor call @ Thu',
    'Declined: 1:1',
    'Tentative: Offsite',
    'Invitation reply: Sarah accepted'
  ]) {
    assert.equal(isCalendarInviteNoise({ subject }), true, `should be noise: ${subject}`);
  }
  // real mail is untouched
  assert.equal(isCalendarInviteNoise({ subject: 'Re: term sheet redline' }), false);
  assert.equal(isCalendarInviteNoise({ subject: 'Quick question on the SOW' }), false);
  assert.equal(isCalendarInviteNoise({ subject: '' }), false);
  assert.equal(isCalendarInviteNoise({}), false);
});

test('selectTriageInbox drops calendar invite emails (invitations/updates/cancellations) from triage', () => {
  const messages = [
    {
      id: 'a',
      messageId: 'a',
      fromEmail: 'organizer@near.org',
      subject: 'Updated invitation: DM & Maggie @ Jul 6',
      unread: true,
      isBulk: false
    },
    {
      id: 'b',
      messageId: 'b',
      fromEmail: 'organizer@near.org',
      subject: 'Canceled event with note: Hot Takes',
      unread: true,
      isBulk: false
    },
    {
      id: 'i',
      messageId: 'i',
      fromEmail: 'organizer@near.org',
      subject: 'Invitation: Abhi <> Alycia @ Wed',
      unread: true,
      isBulk: false
    },
    {
      id: 'c',
      messageId: 'c',
      fromEmail: 'counsel@firm.com',
      subject: 'Re: the SA redline',
      unread: true,
      isBulk: false
    }
  ];
  assert.deepEqual(
    selectTriageInbox(messages, {}).map((m) => m.id),
    ['c'],
    'all calendar-system mail filed; the real reply survives'
  );
});

test('selectTriageInbox keeps human mail but files bulk, ignored senders, and dismissed rows', () => {
  const messages = [
    {
      id: 'h1',
      messageId: 'h1',
      fromEmail: 'dana@northwind.com',
      subject: 'Renewal',
      unread: true,
      isBulk: false
    },
    // gemini-notes meeting summary — classified bulk upstream; must NOT surface as a decision
    {
      id: 'note',
      messageId: 'note',
      fromEmail: 'gemini-notes@google.com',
      subject: 'Notes: Intents Steering Committee',
      unread: true,
      isBulk: true
    },
    {
      id: 'ign',
      messageId: 'ign',
      fromEmail: 'chatty@vendor.com',
      subject: 'Following up again',
      unread: true,
      isBulk: false
    },
    {
      id: 'dis',
      messageId: 'dis',
      fromEmail: 'someone@x.com',
      subject: 'Old thing',
      unread: true,
      isBulk: false
    }
  ];
  const out = selectTriageInbox(messages, {
    overrides: { 'chatty@vendor.com': 'ignore' },
    dismissals: { dis: { reason: 'handled', ts: 1 } }
  });
  assert.deepEqual(
    out.map((m) => m.id),
    ['h1'],
    'only the real human, non-dismissed, non-ignored, non-bulk message survives'
  );
});

test('selectTriageInbox auto-files a learned-ignore sender, unless explicitly corrected', () => {
  const messages = [
    {
      id: 'n1',
      messageId: 'n1',
      fromEmail: 'noisy@vendor.com',
      subject: 'New noise',
      unread: true,
      isBulk: false
    },
    {
      id: 'k1',
      messageId: 'k1',
      fromEmail: 'dana@northwind.com',
      subject: 'Renewal',
      unread: true,
      isBulk: false
    }
  ];
  const learnedIgnore = new Set(['noisy@vendor.com']);
  // New mail from a learned-ignore sender is suppressed.
  assert.deepEqual(
    selectTriageInbox(messages, { learnedIgnore }).map((m) => m.id),
    ['k1'],
    'learned-ignore sender auto-filed; the rest stays'
  );
  // An explicit VIP/Respond correction overrides the learned signal.
  assert.deepEqual(
    selectTriageInbox(messages, {
      learnedIgnore,
      overrides: { 'noisy@vendor.com': 'respond' }
    }).map((m) => m.id),
    ['n1', 'k1'],
    'an explicit correction beats the learned auto-file'
  );
});

test('selectTriageInbox degrades safely on empty/garbage and never mutates input', () => {
  assert.deepEqual(selectTriageInbox(null), []);
  assert.deepEqual(selectTriageInbox([], {}), []);
  const input = [{ id: 'a', isBulk: false, unread: true }];
  const snapshot = JSON.parse(JSON.stringify(input));
  selectTriageInbox(input, { overrides: null, dismissals: null });
  assert.deepEqual(input, snapshot, 'input not mutated');
});

test('normalizeConnectedAccounts keeps only ACTIVE toolkits and de-dupes', () => {
  const set = normalizeConnectedAccounts({
    accounts: [
      { toolkit: 'gmail', status: 'ACTIVE' },
      { toolkit: 'googledrive', status: 'ACTIVE' },
      { toolkit: 'googledrive', status: 'ACTIVE' },
      { toolkit: 'slack', status: 'INITIATED' },
      { toolkit: '', status: 'ACTIVE' }
    ]
  });
  assert.deepEqual([...set].sort(), ['gmail', 'googledrive']);
});

test('normalizeConnectedAccounts accepts a bare array and ignores junk', () => {
  assert.equal(normalizeConnectedAccounts(null).size, 0);
  assert.equal(normalizeConnectedAccounts({}).size, 0);
  const set = normalizeConnectedAccounts([{ toolkit: 'notion', status: 'active' }, 7, null]);
  assert.deepEqual([...set], ['notion']);
});

test('connectorFamilyReadiness maps real ACTIVE toolkits to ready families via Composio', () => {
  const items = connectorFamilyReadiness({
    accounts: [
      { toolkit: 'gmail', status: 'ACTIVE' },
      { toolkit: 'googlecalendar', status: 'ACTIVE' },
      { toolkit: 'googledocs', status: 'ACTIVE' },
      { toolkit: 'notion', status: 'ACTIVE' },
      { toolkit: 'slack', status: 'ACTIVE' }
    ]
  });
  const byId = Object.fromEntries(items.map((item) => [item.id, item]));
  assert.equal(byId.gmail.statusLabel, 'Ready');
  assert.equal(byId.gmail.via, 'Composio');
  assert.equal(byId.calendar.state, 'ready');
  assert.equal(byId.drive.label, 'Drive'); // googledocs maps into the Drive family
  assert.equal(byId.notion.icon, 'file');
  assert.equal(byId.slack.label, 'Slack');
});

test('connectorFamilyReadiness omits families with no ACTIVE account (no overclaim)', () => {
  const items = connectorFamilyReadiness({
    accounts: [{ toolkit: 'gmail', status: 'ACTIVE' }]
  });
  assert.deepEqual(
    items.map((item) => item.id),
    ['gmail']
  );
  assert.equal(
    hasActiveToolkit({ accounts: [{ toolkit: 'gmail', status: 'ACTIVE' }] }, 'slack'),
    false
  );
});

test('normalizeInboxMessages parses sender, subject, unread, preview and respects limit', () => {
  const rows = normalizeInboxMessages(
    {
      successful: true,
      data: {
        messages: [
          {
            sender: 'Dana Lee <dana@customer.example>',
            subject: 'Renewal terms',
            messageText: 'Hi Abhishek,\r\n  We would like net 60 and a 12% cap.\r\n\r\nThanks',
            messageId: 'm1',
            labelIds: ['UNREAD', 'INBOX'],
            messageTimestamp: '1718900000'
          },
          {
            from: 'newsletter@example.com',
            subject: '',
            snippet: 'Weekly digest',
            id: 'm2',
            labelIds: ['INBOX', 'CATEGORY_PROMOTIONS']
          }
        ]
      }
    },
    { limit: 6 }
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].sender, 'Dana Lee');
  assert.equal(rows[0].fromEmail, 'dana@customer.example');
  assert.equal(rows[0].subject, 'Renewal terms');
  assert.equal(rows[0].unread, true);
  assert.match(rows[0].preview, /net 60/);
  assert.equal(rows[1].sender, 'newsletter@example.com');
  assert.equal(rows[1].fromEmail, 'newsletter@example.com');
  assert.equal(rows[1].subject, '(no subject)');
  assert.equal(rows[1].unread, false);
  assert.equal(unreadInboxCount(rows), 1);
});

test('normalizeInboxMessages surfaces the real messageId and threadId for linking', () => {
  const rows = normalizeInboxMessages({
    successful: true,
    data: {
      messages: [
        {
          messageId: '19ee5df98f8d839e',
          threadId: 'thread-abc',
          sender: 'The Information <hello@theinformation.com>',
          subject: 'IPO signal',
          labelIds: ['UNREAD', 'INBOX']
        }
      ]
    }
  });
  assert.equal(rows[0].messageId, '19ee5df98f8d839e');
  assert.equal(rows[0].threadId, 'thread-abc');
  assert.equal(rows[0].id, '19ee5df98f8d839e');
});

test('gmailMessageHref prefers the thread id and falls back to the message id', () => {
  assert.equal(
    gmailMessageHref({ threadId: 'thread-1', messageId: 'msg-1' }),
    'https://mail.google.com/mail/u/0/#all/thread-1'
  );
  assert.equal(
    gmailMessageHref({ messageId: 'msg-only' }),
    'https://mail.google.com/mail/u/0/#all/msg-only'
  );
  assert.equal(gmailMessageHref({}), '');
  assert.equal(gmailMessageHref(), '');
});

test('cleanEmailBody keeps paragraph breaks and strips HTML + invisible padding', () => {
  const html =
    '<html><head><style>p{color:red}</style></head><body>' +
    '<p>Hi&nbsp;Abhishek,</p><p>We&#39;d like net 60 &amp; a cap.</p>' +
    '<p>Thanks​­</p></body></html>';
  const body = cleanEmailBody(html);
  assert.match(body, /Hi Abhishek,/);
  assert.match(body, /We'd like net 60 & a cap\./);
  assert.match(body, /Thanks/);
  // Paragraph structure is preserved (more than one line), not flattened.
  assert.ok(body.split('\n').length >= 3);
  // Invisible padding is gone.
  assert.ok(!/​/.test(body) && !/­/.test(body));
  assert.equal(cleanEmailBody(''), '');
  assert.equal(cleanEmailBody(null), '');
});

test('cleanEmailBody passes plain text through with structure intact', () => {
  const text = 'Line one\r\n\r\nLine two\r\nLine three';
  const body = cleanEmailBody(text);
  assert.match(body, /Line one/);
  assert.match(body, /Line two/);
  assert.match(body, /Line three/);
});

test('normalizeFullMessage maps the live full-message shape to a reading-panel view', () => {
  const message = normalizeFullMessage({
    successful: true,
    data: {
      messageId: '19ee5df98f8d839e',
      threadId: '19ee5df98f8d839e',
      sender: 'The Information <hello@theinformation.com>',
      to: 'abhishek@near.foundation',
      subject: 'What the SpaceX offering could signal',
      messageTimestamp: '2026-06-20T16:31:36Z',
      messageText: 'Subscribe now for $749.\r\n\r\nxAI org chart feature.\r\n\r\nThe Information'
    }
  });
  assert.equal(message.ok, true);
  assert.equal(message.messageId, '19ee5df98f8d839e');
  assert.equal(message.threadId, '19ee5df98f8d839e');
  assert.equal(message.sender, 'The Information');
  assert.equal(message.to, 'abhishek@near.foundation');
  assert.equal(message.subject, 'What the SpaceX offering could signal');
  assert.match(message.body, /Subscribe now for \$749/);
  assert.match(message.body, /The Information/);
});

test('normalizeFullMessage returns an honest error, never a fabricated body', () => {
  const failed = normalizeFullMessage({ successful: false, error: 'rate limited' });
  assert.equal(failed.ok, false);
  assert.equal(failed.body, '');
  assert.match(failed.error, /rate limited/);
  const nul = normalizeFullMessage(null);
  assert.equal(nul.ok, false);
  assert.equal(nul.body, '');
});

test('normalizeInboxMessages returns [] for unsuccessful or malformed payloads (honest empty)', () => {
  assert.deepEqual(normalizeInboxMessages(null), []);
  assert.deepEqual(normalizeInboxMessages({ successful: false, error: 'nope' }), []);
  assert.deepEqual(normalizeInboxMessages({ successful: true, data: {} }), []);
  assert.deepEqual(normalizeInboxMessages({ successful: true, data: { messages: 'bad' } }), []);
});

test('normalizeCalendarEvents parses title and start, honest empty on failure', () => {
  const rows = normalizeCalendarEvents({
    successful: true,
    data: {
      events: [
        { id: 'e1', summary: 'Standup', start: { dateTime: '2026-06-20T13:00:00Z' } },
        { eventId: 'e2', title: 'Board call', start: '2026-06-20T18:00:00Z', location: 'Zoom' }
      ]
    }
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, 'Standup');
  assert.equal(rows[0].start, '2026-06-20T13:00:00Z');
  assert.equal(rows[1].location, 'Zoom');
  assert.deepEqual(normalizeCalendarEvents({ successful: false }), []);
  assert.deepEqual(normalizeCalendarEvents(null), []);
});

test('normalizeCalendarEvents reads the live `items` shape with when + link', () => {
  const rows = normalizeCalendarEvents(
    {
      successful: true,
      data: {
        items: [
          {
            id: 'live1',
            summary: '[ooo] USA & Abhi',
            start: { date: '2026-06-22' },
            end: { date: '2026-06-23' },
            htmlLink: 'https://www.google.com/calendar/event?eid=abc'
          },
          {
            id: 'live2',
            summary: 'Legal Weekly',
            start: { dateTime: '2026-06-22T10:00:00-04:00', timeZone: 'Europe/London' },
            location: 'Zoom'
          }
        ]
      }
    },
    { limit: 6 }
  );
  assert.equal(rows.length, 2);
  // All-day event: human-readable "when" ends in "all day", carries the link.
  assert.equal(rows[0].title, '[ooo] USA & Abhi');
  assert.match(rows[0].when, /all day$/);
  assert.equal(rows[0].link, 'https://www.google.com/calendar/event?eid=abc');
  // Timed event: "when" includes a clock time; no link key when none was given.
  assert.equal(rows[1].title, 'Legal Weekly');
  assert.ok(rows[1].when.length > 0);
  assert.equal(rows[1].location, 'Zoom');
  assert.ok(!('link' in rows[1]));
});

test('normalizeCalendarEvents honours the limit and never fabricates a link', () => {
  const rows = normalizeCalendarEvents(
    {
      successful: true,
      data: {
        items: [
          {
            id: 'a',
            summary: 'One',
            start: { dateTime: '2026-06-22T09:00:00Z' },
            htmlLink: 'ftp://nope'
          },
          { id: 'b', summary: 'Two', start: { dateTime: '2026-06-22T10:00:00Z' } },
          { id: 'c', summary: 'Three', start: { dateTime: '2026-06-22T11:00:00Z' } }
        ]
      }
    },
    { limit: 2 }
  );
  assert.equal(rows.length, 2);
  // A non-http link is rejected, not surfaced as a clickable row.
  assert.ok(!('link' in rows[0]));
});

test('selectTriageInbox collapses one email thread to a single newest-message card', () => {
  // Three inbound messages in ONE thread (T1) + one in another (T2). The operator
  // was seeing the thread as three near-identical "Re: ..." cards.
  const messages = [
    {
      messageId: 'a',
      id: 'a',
      threadId: 'T1',
      fromEmail: 'carla@x.com',
      subject: 'Re: Founding Member Status',
      timestamp: '1782770000000',
      unread: false
    },
    {
      messageId: 'b',
      id: 'b',
      threadId: 'T1',
      fromEmail: 'chris@x.com',
      subject: 'Re: Founding Member Status',
      timestamp: '1782773000000', // newest in the thread
      unread: true
    },
    {
      messageId: 'c',
      id: 'c',
      threadId: 'T1',
      fromEmail: 'carla@x.com',
      subject: 'Re: Founding Member Status',
      timestamp: '1782772000000',
      unread: false
    },
    {
      messageId: 'd',
      id: 'd',
      threadId: 'T2',
      fromEmail: 'lluis@x.com',
      subject: 'General Assembly',
      timestamp: '1782771500000',
      unread: true
    }
  ];
  const out = selectTriageInbox(messages, {});
  // One card per thread, not per message.
  assert.equal(out.length, 2);
  const t1 = out.find((m) => m.threadId === 'T1');
  // Representative is the NEWEST message in the thread (b), carries the count, and is
  // marked unread because at least one message in the thread is unread.
  assert.equal(t1.messageId, 'b');
  assert.equal(t1.threadCount, 3);
  assert.equal(t1.unread, true);
  // The single-message thread is untouched (no threadCount key).
  const t2 = out.find((m) => m.threadId === 'T2');
  assert.equal(t2.messageId, 'd');
  assert.ok(!('threadCount' in t2));
});
