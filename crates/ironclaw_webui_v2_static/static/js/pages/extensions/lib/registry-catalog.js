export const CORE_CONNECTIONS = [
  {
    id: 'gmail',
    display_name: 'Gmail',
    kind: 'wasm_tool',
    description: 'Read, triage, draft, and prepare email work with approval gates.',
    package_ref: { kind: 'extension', id: 'tools/gmail' },
    keywords: ['email', 'google', 'inbox']
  },
  {
    id: 'google-calendar',
    display_name: 'Google Calendar',
    kind: 'wasm_tool',
    description: 'Find meetings, protect focus blocks, and prepare schedule changes.',
    package_ref: { kind: 'extension', id: 'tools/google_calendar' },
    keywords: ['calendar', 'google', 'schedule']
  },
  {
    id: 'google-drive',
    display_name: 'Google Drive',
    kind: 'wasm_tool',
    description: 'Ground prep, summaries, and answers in Drive documents and folders.',
    package_ref: { kind: 'extension', id: 'tools/google_drive' },
    keywords: ['drive', 'docs', 'files']
  },
  {
    id: 'google-sheets',
    display_name: 'Google Sheets',
    kind: 'wasm_tool',
    description: 'Append CRM rows, bug reports, and recurring tracker output to Sheets.',
    package_ref: { kind: 'extension', id: 'tools/google_sheets' },
    keywords: ['sheets', 'spreadsheet', 'crm']
  },
  {
    id: 'notion',
    display_name: 'Notion',
    kind: 'mcp_server',
    description: 'Search team knowledge, draft pages, and keep decisions visible.',
    package_ref: { kind: 'extension', id: 'mcp-servers/notion' },
    keywords: ['knowledge', 'docs', 'wiki']
  },
  {
    id: 'slack',
    display_name: 'Slack',
    kind: 'wasm_channel',
    description: 'Summarize channels, prepare replies, and surface urgent asks.',
    package_ref: { kind: 'extension', id: 'channels/slack' },
    keywords: ['messages', 'team', 'channels']
  },
  {
    id: 'telegram',
    display_name: 'Telegram',
    kind: 'wasm_channel',
    description: 'Send scheduled digests and bot messages through Telegram.',
    package_ref: { kind: 'extension', id: 'channels/telegram' },
    keywords: ['bot', 'news', 'dm']
  },
  {
    id: 'github',
    display_name: 'GitHub',
    kind: 'wasm_tool',
    description: 'Watch releases, summarize changes, and route follow-up tasks.',
    package_ref: { kind: 'extension', id: 'tools/github' },
    keywords: ['releases', 'issues', 'code']
  },
  {
    id: 'web-http',
    display_name: 'Web & HTTP',
    kind: 'builtin',
    description: 'Fetch pages, search public sources, and watch endpoint health.',
    package_ref: null,
    keywords: ['web', 'http', 'monitor']
  },
  {
    id: 'routines',
    display_name: 'Routines',
    kind: 'builtin',
    description: 'Schedule recurring checks, prep work, and delivery loops.',
    package_ref: null,
    keywords: ['schedule', 'trigger', 'automation']
  },
  {
    id: 'workspace',
    display_name: 'Workspace files',
    kind: 'builtin',
    description: 'Use local documents, spreadsheets, PDFs, and generated work products in chat.',
    package_ref: null,
    keywords: ['files', 'documents', 'exports']
  }
];

export const WORKBENCH_SOURCE_FAMILIES = [
  {
    id: 'gmail',
    surfaceId: 'gmail',
    displayName: 'Gmail',
    category: 'Email',
    availableBody: 'Email can be connected when a task needs inbox context or drafts.',
    readyBody: 'Email is ready for workbench requests that need inbox context or drafts.',
    connectLabel: 'Connect Gmail'
  },
  {
    id: 'calendar',
    surfaceId: 'google-calendar',
    displayName: 'Calendar',
    category: 'Calendar',
    availableBody: 'Calendar can be connected when a task needs meeting context or timing.',
    readyBody: 'Calendar is ready for meeting prep and schedule-aware routines.',
    connectLabel: 'Connect Calendar'
  },
  {
    id: 'slack',
    surfaceId: 'slack',
    displayName: 'Slack',
    category: 'Messaging',
    availableBody: 'Slack can be connected when a task needs channel context or replies.',
    readyBody: 'Slack is ready for channel summaries, prepared replies, and urgent asks.',
    connectLabel: 'Connect Slack',
    reconnectLabel: 'Reconnect Slack'
  },
  {
    id: 'telegram',
    surfaceId: 'telegram',
    displayName: 'Telegram',
    category: 'Messaging',
    availableBody: 'Telegram can be connected when a task needs bot delivery or digests.',
    readyBody: 'Telegram is ready for scheduled digests and bot delivery.',
    connectLabel: 'Connect Telegram',
    reconnectLabel: 'Reconnect Telegram'
  },
  {
    id: 'notion',
    surfaceId: 'notion',
    displayName: 'Notion',
    category: 'Knowledge app',
    availableBody: 'Notion can be connected when a task needs team knowledge or pages.',
    readyBody: 'Notion is ready for team knowledge search and page drafting.',
    connectLabel: 'Connect Notion',
    setupLabel: 'Open Notion setup'
  },
  {
    id: 'drive',
    surfaceId: 'google-drive',
    displayName: 'Drive',
    category: 'Docs',
    availableBody: 'Drive can be connected when a task needs documents or folders.',
    readyBody: 'Drive is ready for document-grounded prep and summaries.',
    connectLabel: 'Connect Drive'
  },
  {
    id: 'sheets',
    surfaceId: 'google-sheets',
    displayName: 'Sheets',
    category: 'Spreadsheet',
    availableBody: 'Sheets can be connected when a task needs tracker rows or CRM updates.',
    readyBody: 'Sheets is ready for tracker rows, bug logs, and CRM updates.',
    connectLabel: 'Connect Sheets'
  },
  {
    id: 'github',
    surfaceId: 'github',
    displayName: 'GitHub',
    category: 'Code',
    availableBody: 'GitHub can be connected when a task needs issues, releases, or repos.',
    readyBody: 'GitHub is ready for issues, releases, and repo context.',
    connectLabel: 'Connect GitHub'
  },
  {
    id: 'web',
    surfaceId: 'web-http',
    displayName: 'Web & HTTP',
    category: 'Research',
    builtin: true,
    availableBody: 'Web and HTTP checks run through the gateway when web access is available.',
    readyBody: 'Web and HTTP checks are available for public search and endpoint health.',
    builtinStatusLabel: 'Available',
    builtinNextAction: 'Next: ask chat to search or check an endpoint'
  },
  {
    id: 'routines',
    surfaceId: 'routines',
    displayName: 'Routines',
    category: 'Schedule',
    builtin: true,
    availableBody: 'Routines are saved from scheduled chat prompts and listed in Scheduled.',
    readyBody: 'Routines are available for recurring checks, prep, and delivery loops.',
    builtinStatusLabel: 'Available',
    builtinNextAction: 'Next: ask chat to run something on a schedule'
  },
  {
    id: 'workspace',
    surfaceId: 'workspace',
    displayName: 'Local workspace',
    category: 'Files',
    builtin: true,
    availableBody: 'Local workspace files are readable when a task needs project context.',
    readyBody: 'Local workspace files are readable when a task needs project context.'
  }
];

export const ACCEPTANCE_WORKFLOWS = [
  {
    id: 'daily-news-digest',
    title: 'Daily news digest',
    outcome: 'Find NEAR AI news, summarize it, and deliver a short Telegram digest on a routine.',
    surfaces: ['telegram', 'web-http', 'routines'],
    prompt:
      "Create a recurring Telegram digest of the most important NEAR AI news. Start by drafting today's summary, then schedule the routine."
  },
  {
    id: 'calendar-prep-assistant',
    title: 'Calendar prep assistant',
    outcome:
      'Prepare meeting briefs from Gmail, Calendar, Drive documents, public news, and a timed routine.',
    surfaces: ['gmail', 'google-calendar', 'google-drive', 'web-http', 'routines'],
    prompt:
      'Thirty minutes before my next meeting, prepare a company brief from Gmail, Calendar, Drive docs, and recent news.'
  },
  {
    id: 'deployment-health-watcher',
    title: 'Deployment health watcher',
    outcome: 'Ping an endpoint on a schedule and send a Slack DM when health checks fail.',
    surfaces: ['slack', 'web-http', 'routines'],
    prompt:
      'Watch a deployment endpoint every five minutes and DM me in Slack if the status is not healthy.'
  },
  {
    id: 'competitor-release-tracker',
    title: 'Competitor release tracker',
    outcome: 'Watch GitHub releases, summarize meaningful changes, and email the result.',
    surfaces: ['gmail', 'github', 'routines'],
    prompt:
      'Track competitor GitHub releases, summarize meaningful changes, and email me a recurring update.'
  },
  {
    id: 'slack-ama',
    title: 'AMA in Slack',
    outcome:
      'Answer Slack questions from a Drive strategy document without losing source grounding.',
    surfaces: ['slack', 'google-drive'],
    prompt:
      'Use the strategy document in Drive as a knowledge base and answer Slack DMs with grounded answers.'
  },
  {
    id: 'crm-inbound-tracker',
    title: 'CRM inbound tracker',
    outcome: 'Find inbound Gmail from near.ai domains and append structured rows to Google Sheets.',
    surfaces: ['gmail', 'google-sheets', 'routines'],
    prompt:
      'Every thirty minutes, find new near.ai-domain inbound emails and append the right fields to a Google Sheet.'
  },
  {
    id: 'slack-sheet-bug-logger',
    title: 'Slack to Sheet bug logger',
    outcome: 'Turn Slack messages that start with "bug:" into rows in a product bug spreadsheet.',
    surfaces: ['slack', 'google-sheets', 'routines'],
    prompt:
      'Watch the product Slack channel for messages that start with bug: and append them to a Google Sheet.'
  },
  {
    id: 'hn-keyword-monitor',
    title: 'HN keyword monitor',
    outcome:
      'Search Hacker News for IronClaw and NEAR AI mentions and send Slack summaries hourly.',
    surfaces: ['slack', 'web-http', 'routines'],
    prompt:
      'Search Hacker News hourly for IronClaw or NEAR AI mentions and send a concise Slack summary.'
  }
];
