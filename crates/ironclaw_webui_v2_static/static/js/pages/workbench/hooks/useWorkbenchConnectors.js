import { useQuery } from '@tanstack/react-query';

import { React } from '../../../lib/html.js';
import { connectorRead, connectorsConnected } from '../../../lib/api.js';
import {
  connectorFamilyReadiness,
  hasActiveToolkit,
  normalizeCalendarEvents,
  normalizeFullMessage,
  normalizeInboxMessages
} from '../lib/workbench-connectors.js';
import { SLACK_BLOCKER_QUERY, normalizeSlackBlockers } from '../lib/workbench-slack.js';
import { DRIVE_FILE_LIMIT, normalizeDriveFiles } from '../lib/workbench-drive.js';
import { NOTION_PAGE_LIMIT, normalizeNotionPages } from '../lib/workbench-notion.js';
import {
  GITHUB_NOTIFICATION_LIMIT,
  normalizeGithubNotifications
} from '../lib/workbench-github.js';

// React-Query hooks that populate the home surface from the read-only connector
// route. They are deliberately resilient:
//  - one retry only, generous staleTime (these are deterministic reads, not a
//    hot loop), and `throwOnError: false` so a connector outage never surfaces a
//    React error boundary or a console error.
//  - they expose `ready`/`isError`/`isLoading` so callers render an honest empty
//    or hidden state instead of fabricating rows.

const CONNECTORS_QUERY_KEY = ['workbench-connectors-connected'];

export function useConnectedAccounts() {
  const query = useQuery({
    queryKey: CONNECTORS_QUERY_KEY,
    queryFn: ({ signal }) => connectorsConnected({ signal }),
    staleTime: 60_000,
    retry: 1,
    throwOnError: false
  });

  const families = React.useMemo(
    () => (query.isError ? [] : connectorFamilyReadiness(query.data)),
    [query.data, query.isError]
  );

  const gmailReady = React.useMemo(
    () => !query.isError && hasActiveToolkit(query.data, 'gmail'),
    [query.data, query.isError]
  );
  const calendarReady = React.useMemo(
    () => !query.isError && hasActiveToolkit(query.data, 'calendar'),
    [query.data, query.isError]
  );
  const slackReady = React.useMemo(
    () => !query.isError && hasActiveToolkit(query.data, 'slack'),
    [query.data, query.isError]
  );
  const driveReady = React.useMemo(
    () => !query.isError && hasActiveToolkit(query.data, 'drive'),
    [query.data, query.isError]
  );
  const notionReady = React.useMemo(
    () => !query.isError && hasActiveToolkit(query.data, 'notion'),
    [query.data, query.isError]
  );
  const githubReady = React.useMemo(
    () => !query.isError && hasActiveToolkit(query.data, 'github'),
    [query.data, query.isError]
  );

  return {
    families,
    gmailReady,
    calendarReady,
    slackReady,
    driveReady,
    notionReady,
    githubReady,
    isLoading: query.isLoading,
    isError: query.isError
  };
}

export function useConnectorInbox({ enabled = true, maxResults = 6 } = {}) {
  const query = useQuery({
    queryKey: ['workbench-connector-inbox', maxResults],
    enabled: Boolean(enabled),
    staleTime: 60_000,
    retry: 1,
    throwOnError: false,
    queryFn: ({ signal }) =>
      connectorRead({
        toolkit: 'gmail',
        tool: 'GMAIL_FETCH_EMAILS',
        // Read the Primary tab — human correspondence, not newsletters/promotions.
        // Gmail's own category classification keeps bulk out so "needs a reply"
        // surfaces real mail instead of a newsletter flood; messageIsBulk still
        // suppresses any automated sender that slips into Primary.
        arguments: {
          max_results: maxResults,
          query: 'in:inbox -category:promotions -category:updates -category:forums -category:social'
        },
        signal
      })
  });

  const messages = React.useMemo(
    () => (query.isError ? [] : normalizeInboxMessages(query.data, { limit: maxResults })),
    [query.data, query.isError, maxResults]
  );

  return {
    messages,
    isLoading: query.isLoading && enabled,
    isFetching: query.isFetching,
    isError: query.isError,
    enabled: Boolean(enabled)
  };
}

// How far ahead the Upcoming card looks. The Composio GOOGLECALENDAR_EVENTS_LIST
// read returns nothing for a bare `timeMin` (no upper bound), so we pass an
// explicit `timeMax` window. 30 days comfortably surfaces the next handful of
// events for an active calendar without pulling a long tail.
const CALENDAR_HORIZON_DAYS = 30;

export function useConnectorCalendar({ enabled = true, maxResults = 6 } = {}) {
  const query = useQuery({
    queryKey: ['workbench-connector-calendar', maxResults],
    enabled: Boolean(enabled),
    staleTime: 60_000,
    retry: 1,
    throwOnError: false,
    queryFn: ({ signal }) => {
      // Computed at call time so the window always starts "now" and the
      // react-query cache key (which excludes the timestamps) still de-dupes.
      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(
        now.getTime() + CALENDAR_HORIZON_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();
      return connectorRead({
        toolkit: 'googlecalendar',
        tool: 'GOOGLECALENDAR_EVENTS_LIST',
        arguments: {
          calendarId: 'primary',
          maxResults,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime'
        },
        signal
      });
    }
  });

  const events = React.useMemo(
    () => (query.isError ? [] : normalizeCalendarEvents(query.data, { limit: maxResults })),
    [query.data, query.isError, maxResults]
  );

  return {
    events,
    isLoading: query.isLoading && enabled,
    isFetching: query.isFetching && enabled,
    isError: query.isError,
    enabled: Boolean(enabled)
  };
}

// Ambient Drive read: the user's most recently modified files. Read-only LIST
// with an explicit `fields` projection (the default omits modifiedTime and
// webViewLink). Degrades to [] on failure; never fabricates a file.
export function useConnectorDrive({ enabled = true, maxResults = DRIVE_FILE_LIMIT } = {}) {
  const query = useQuery({
    queryKey: ['workbench-connector-drive', maxResults],
    enabled: Boolean(enabled),
    staleTime: 60_000,
    retry: 1,
    throwOnError: false,
    queryFn: ({ signal }) =>
      connectorRead({
        toolkit: 'googledrive',
        tool: 'GOOGLEDRIVE_LIST_FILES',
        arguments: {
          page_size: maxResults,
          order_by: 'modifiedTime desc',
          fields: 'files(id,name,mimeType,modifiedTime,webViewLink,iconLink)'
        },
        signal
      })
  });

  const files = React.useMemo(
    () => (query.isError ? [] : normalizeDriveFiles(query.data, { limit: maxResults })),
    [query.data, query.isError, maxResults]
  );

  return {
    files,
    isLoading: query.isLoading && enabled,
    isFetching: query.isFetching && enabled,
    isError: query.isError,
    enabled: Boolean(enabled)
  };
}

// Ambient Notion read: the most recently edited pages. SEARCH with an empty
// query returns pages ordered by recency. Degrades to [] on failure.
export function useConnectorNotion({ enabled = true, maxResults = NOTION_PAGE_LIMIT } = {}) {
  const query = useQuery({
    queryKey: ['workbench-connector-notion', maxResults],
    enabled: Boolean(enabled),
    staleTime: 60_000,
    retry: 1,
    throwOnError: false,
    queryFn: ({ signal }) =>
      connectorRead({
        toolkit: 'notion',
        tool: 'NOTION_SEARCH_NOTION_PAGE',
        arguments: { query: '', page_size: maxResults },
        signal
      })
  });

  const pages = React.useMemo(
    () => (query.isError ? [] : normalizeNotionPages(query.data, { limit: maxResults })),
    [query.data, query.isError, maxResults]
  );

  return {
    pages,
    isLoading: query.isLoading && enabled,
    isFetching: query.isFetching && enabled,
    isError: query.isError,
    enabled: Boolean(enabled)
  };
}

// Ambient GitHub read: the authenticated user's unread notifications (mentions,
// review requests, assignments). Read-only LIST. Degrades to [] on failure.
export function useConnectorGithub({
  enabled = true,
  maxResults = GITHUB_NOTIFICATION_LIMIT
} = {}) {
  const query = useQuery({
    queryKey: ['workbench-connector-github', maxResults],
    enabled: Boolean(enabled),
    staleTime: 60_000,
    retry: 1,
    throwOnError: false,
    queryFn: ({ signal }) =>
      connectorRead({
        toolkit: 'github',
        tool: 'GITHUB_LIST_NOTIFICATIONS_FOR_THE_AUTHENTICATED_USER',
        arguments: { per_page: maxResults, all: false },
        signal
      })
  });

  const notifications = React.useMemo(
    () => (query.isError ? [] : normalizeGithubNotifications(query.data, { limit: maxResults })),
    [query.data, query.isError, maxResults]
  );

  return {
    notifications,
    isLoading: query.isLoading && enabled,
    isFetching: query.isFetching && enabled,
    isError: query.isError,
    enabled: Boolean(enabled)
  };
}

// On-demand Slack blocker search. Unlike the ambient inbox/calendar polls, this
// runs ONLY when the user asks ("Find Slack blockers" or a catch-up briefing) —
// `enabled` is the request latch from the page. It is a read-only SEARCH
// (SLACK_SEARCH_MESSAGES), sorted by recency, and degrades to [] on any failure.
// Slack search treats spaces as AND, so the blocker synonyms are OR'd in
// SLACK_BLOCKER_QUERY.
export function useConnectorSlackBlockers({ enabled = false, maxResults = 8 } = {}) {
  const query = useQuery({
    queryKey: ['workbench-connector-slack-blockers', maxResults],
    enabled: Boolean(enabled),
    staleTime: 30_000,
    retry: 1,
    throwOnError: false,
    queryFn: ({ signal }) =>
      connectorRead({
        toolkit: 'slack',
        tool: 'SLACK_SEARCH_MESSAGES',
        arguments: { query: SLACK_BLOCKER_QUERY, count: maxResults, sort: 'timestamp' },
        signal
      })
  });

  const rows = React.useMemo(
    () => (query.isError ? [] : normalizeSlackBlockers(query.data, { limit: maxResults })),
    [query.data, query.isError, maxResults]
  );

  return {
    rows,
    isLoading: (query.isLoading || query.isFetching) && Boolean(enabled),
    isFetching: query.isFetching && Boolean(enabled),
    isError: query.isError,
    enabled: Boolean(enabled)
  };
}

// Fetch a single full Gmail message by id for the reading panel. This is a
// READ tool (GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID — the GET segment passes the
// read-only route guard), so it never writes. The query is keyed on the
// message id and only runs when one is set, so opening the panel triggers the
// fetch and closing it (id => null) leaves the last result cached.
export function useConnectorMessage(messageId) {
  const id = typeof messageId === 'string' ? messageId.trim() : '';
  const query = useQuery({
    queryKey: ['workbench-connector-message', id],
    enabled: Boolean(id),
    staleTime: 60_000,
    retry: 1,
    throwOnError: false,
    queryFn: ({ signal }) =>
      connectorRead({
        toolkit: 'gmail',
        tool: 'GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID',
        arguments: { message_id: id, format: 'full' },
        signal
      })
  });

  const message = React.useMemo(() => {
    if (!id) return null;
    if (query.isError) return null;
    if (!query.data) return null;
    return normalizeFullMessage(query.data);
  }, [id, query.data, query.isError]);

  return {
    message,
    isLoading: query.isLoading && Boolean(id),
    isError: query.isError,
    enabled: Boolean(id)
  };
}
