import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Refresh stale reads when the user returns to the app. Without this, connector
      // reads (inbox, Slack, Notion, GitHub, calendar) stayed frozen for the whole
      // session — "nothing new ever surfaces". Foreground-only (on focus), so it does
      // not poll in the background or run up connector cost while idle.
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 10_000
    }
  }
});
