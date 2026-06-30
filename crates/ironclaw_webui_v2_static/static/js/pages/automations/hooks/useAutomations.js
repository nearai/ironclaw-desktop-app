import { useQuery } from '@tanstack/react-query';
import { React } from '../../../lib/html.js';
import { listAutomations } from '../../../lib/automations-api.js';

import { automationSummary, normalizeAutomations } from '../lib/automations-presenters.js';

const AUTOMATIONS_PAGE_LIMIT = 50;
const AUTOMATION_RUNS_LIMIT = 25;

export function useAutomations() {
  const query = useQuery({
    queryKey: ['automations'],
    queryFn: () =>
      listAutomations({ limit: AUTOMATIONS_PAGE_LIMIT, runLimit: AUTOMATION_RUNS_LIMIT }),
    refetchInterval: 30000,
    refetchIntervalInBackground: false
  });

  const automations = React.useMemo(() => normalizeAutomations(query.data), [query.data]);
  const summary = React.useMemo(() => automationSummary(automations), [automations]);

  return {
    automations,
    summary,
    schedulerEnabled: query.data?.scheduler_enabled !== false,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    error: query.error || null,
    refetch: query.refetch
  };
}
