import { useLocation } from 'react-router';
import { React } from '../../../lib/html.js';
import { queryOperatorLogs } from '../../../lib/logs-api.js';
import { normalizeOperatorLogsResponse } from '../lib/logs-data.js';

const POLL_INTERVAL_MS = 2000;
const LOG_LIMIT = 500;
const HIDDEN_ENTRY_ID_CAP = 2000;
const TERMINAL_UNSUPPORTED_STATUSES = new Set([403, 404]);
const SCOPE_QUERY_PARAMS = [
  ['threadId', 'thread_id', 'logs.scope.thread'],
  ['runId', 'run_id', 'logs.scope.run'],
  ['turnId', 'turn_id', 'logs.scope.turn'],
  ['toolCallId', 'tool_call_id', 'logs.scope.toolCall'],
  ['toolName', 'tool_name', 'logs.scope.tool'],
  ['source', 'source', 'logs.scope.source']
];

export function readLogScopeFromLocation(location = globalThis.location) {
  const params = new URLSearchParams(location?.search || '');
  return SCOPE_QUERY_PARAMS.reduce(
    (scope, [key, param, labelKey]) => {
      const value = params.get(param)?.trim();
      if (value) {
        scope[key] = value;
        scope.active.push({ key, param, labelKey, value });
      } else {
        scope[key] = null;
      }
      return scope;
    },
    { active: [] }
  );
}

export function useLogs() {
  const location = useLocation();
  const scope = React.useMemo(() => readLogScopeFromLocation(location), [location.search]);
  const [entries, setEntries] = React.useState([]);
  const [levelFilter, setLevelFilter] = React.useState('all');
  const [targetFilter, setTargetFilter] = React.useState('');
  const [paused, setPaused] = React.useState(false);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [isUnsupported, setIsUnsupported] = React.useState(false);
  const hiddenEntryIdsRef = React.useRef(new Set());
  const requestIdRef = React.useRef(0);
  const inFlightRef = React.useRef(false);
  const needsReloadRef = React.useRef(false);
  const activeRequestKeyRef = React.useRef('');
  const latestLoadLogsRef = React.useRef(null);

  const loadLogs = React.useCallback(async () => {
    if (isUnsupported) return;
    const request = {
      limit: LOG_LIMIT,
      level: levelFilter === 'all' ? null : levelFilter,
      target: targetFilter.trim() || null,
      threadId: scope.threadId,
      runId: scope.runId,
      turnId: scope.turnId,
      toolCallId: scope.toolCallId,
      toolName: scope.toolName,
      source: scope.source
    };
    const requestKey = JSON.stringify(request);
    if (inFlightRef.current) {
      if (requestKey !== activeRequestKeyRef.current) {
        requestIdRef.current += 1;
      }
      needsReloadRef.current = true;
      return;
    }
    inFlightRef.current = true;
    activeRequestKeyRef.current = requestKey;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    try {
      const response = await queryOperatorLogs(request);
      if (requestId !== requestIdRef.current) return;
      const hidden = hiddenEntryIdsRef.current;
      const logs = normalizeOperatorLogsResponse(response);
      const nextEntries = logs.entries.filter((entry) => !hidden.has(entry.id));
      setEntries(nextEntries);
      setError(null);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (TERMINAL_UNSUPPORTED_STATUSES.has(err?.status)) {
        setEntries([]);
        setError(null);
        setIsUnsupported(true);
        return;
      }
      setError(err);
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
      inFlightRef.current = false;
      activeRequestKeyRef.current = '';
      if (needsReloadRef.current) {
        needsReloadRef.current = false;
        latestLoadLogsRef.current?.();
      }
    }
  }, [isUnsupported, levelFilter, scope, targetFilter]);
  latestLoadLogsRef.current = loadLogs;

  React.useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  React.useEffect(() => {
    if (paused || isUnsupported) return undefined;
    const timer = setInterval(loadLogs, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isUnsupported, loadLogs, paused]);

  const togglePause = React.useCallback(() => {
    setPaused((value) => !value);
  }, []);

  const clearEntries = React.useCallback(() => {
    const hidden = [...hiddenEntryIdsRef.current, ...entries.map((entry) => entry.id)].slice(
      -HIDDEN_ENTRY_ID_CAP
    );
    hiddenEntryIdsRef.current = new Set(hidden);
    setEntries([]);
  }, [entries]);

  return {
    entries,
    totalCount: entries.length,
    paused,
    togglePause,
    clearEntries,
    levelFilter,
    setLevelFilter,
    targetFilter,
    setTargetFilter,
    autoScroll,
    setAutoScroll,
    serverLevel: null,
    changeServerLevel: async () => {},
    scope,
    status: isUnsupported ? 'unsupported' : error ? 'error' : isLoading ? 'loading' : 'ready',
    isLoading,
    error,
    isUnsupported
  };
}
