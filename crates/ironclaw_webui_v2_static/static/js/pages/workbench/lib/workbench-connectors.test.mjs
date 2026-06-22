import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cleanEmailBody,
  connectorFamilyReadiness,
  gmailMessageHref,
  hasActiveToolkit,
  normalizeCalendarEvents,
  normalizeConnectedAccounts,
  normalizeFullMessage,
  normalizeInboxMessages,
  selectTriageInbox,
  unreadInboxCount
} from './workbench-connectors.js';

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
