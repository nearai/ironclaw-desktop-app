// Workspace Packs are pure data definitions for one-click extension setup.
// The desktop installs these registry ids through the existing
// `/api/extensions` install + setup + readiness flow; pack availability still
// depends on what the connected gateway exposes in its extension registry.

export type ConnectorAuthKind = 'oauth' | 'dcr' | 'token' | 'none';

export interface ConnectorPack {
  id: string;
  display_name: string;
  description: string;
  extensions: string[];
  shared_auth: string | null;
  auth_kind: ConnectorAuthKind;
  example_tasks: string[];
}

export const CONNECTOR_PACKS: ConnectorPack[] = [
  {
    id: 'google',
    display_name: 'Google Workspace',
    description:
      'Connect Gmail, Calendar, Drive, Docs, Sheets, and Slides so work moves with context.',
    extensions: [
      'tools/gmail',
      'tools/google_calendar',
      'tools/google_docs',
      'tools/google_drive',
      'tools/google_sheets',
      'tools/google_slides'
    ],
    shared_auth: 'google_oauth_token',
    auth_kind: 'oauth',
    example_tasks: [
      'Summarize unread Gmail and draft the replies I owe.',
      "Find next week's calendar conflicts and gather the relevant Drive context.",
      'Turn this Sheets forecast into a Slides briefing with speaker notes.'
    ]
  },
  {
    id: 'notion',
    display_name: 'Notion',
    description: 'Connect Notion so plans, docs, and project memory stay organized and actionable.',
    extensions: ['notion'],
    shared_auth: null,
    auth_kind: 'dcr',
    example_tasks: [
      'Summarize open project pages and flag overdue decisions.',
      'Create a launch checklist in Notion from this plan.',
      'Update the weekly status page with blockers and next steps.'
    ]
  },
  {
    id: 'slack',
    display_name: 'Slack',
    description: 'Connect Slack so conversations become decisions, drafts, and follow-through.',
    extensions: ['channels/slack', 'tools/slack_tool'],
    shared_auth: null,
    auth_kind: 'oauth',
    example_tasks: [
      'Summarize missed Slack mentions and list what needs my response.',
      "Draft replies for today's priority Slack threads.",
      'Turn this channel discussion into owners, decisions, and next actions.'
    ]
  }
];

export function connectorPackById(id: string): ConnectorPack | undefined {
  return CONNECTOR_PACKS.find((pack) => pack.id === id);
}
