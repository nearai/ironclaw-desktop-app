import { useQuery, useQueryClient } from '@tanstack/react-query';
import { React } from '../../../lib/html.js';
import {
  formatProviderLabel,
  normalizeModelEntries,
  uniqueModelsByDisplayLabel,
  visibleLlmSnapshot
} from '../../chat/components/chat-model-utils.js';
import { NEW_DRAFT_KEY, clearStagedAttachments, setDraft } from '../../chat/lib/draft-store.js';
import { buildRuntimeContext } from '../../chat/lib/runtime-context.js';
import { modelDisplayName } from '../../settings/lib/llm-providers.js';
import {
  fetchLlmProviders,
  listLlmProviderModels,
  setActiveLlm
} from '../../settings/lib/settings-api.js';
import {
  WORKBENCH_AUTO_SOURCE_SCOPE,
  WORKBENCH_EFFORT_LEVELS,
  WORKBENCH_SOURCE_CAPABILITY_MAP,
  buildWorkbenchChatDraft,
  selectedWorkbenchSources
} from '../lib/workbench-plan.js';
import { sourceReadinessUsable } from './useWorkbenchSourceReadiness.js';
import { inferWorkbenchScene } from '../lib/workbench-scenes-registry.js';

export const WORKBENCH_DRAFT_KEY = '__workbench__';

function userTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (_) {
    return '';
  }
}

export function workbenchStartErrorMessage(err) {
  const message = String(err?.message || '').trim();
  if (!message) return 'Could not start this through Chat. Your draft is saved here.';
  return `Could not start this through Chat. ${message}`;
}

export function workbenchModelSwitchErrorMessage(err, modelLabel) {
  const message = String(err?.message || '').trim();
  const target = String(modelLabel || '').trim() || 'the selected model';
  const detail = message ? ` ${message}` : '';
  return `Could not switch to ${target}. Chat was not started. Your draft is saved here.${detail}`;
}

export function gatewayModelBlockReason(gatewayStatus) {
  return (
    [
      gatewayStatus?.model_readiness_reason,
      gatewayStatus?.modelReadinessReason,
      gatewayStatus?.model_execution_failure_summary,
      gatewayStatus?.modelExecutionFailureSummary
    ]
      .map((value) => String(value || '').trim())
      .find(Boolean) || ''
  );
}

export function normalizeWorkbenchModelId(value) {
  return String(value || '').trim() || 'auto';
}

export function modelOptionLabel(model) {
  const id = normalizeWorkbenchModelId(model);
  const label = modelDisplayName(id) || id;
  return id === 'auto' ? label : `${label} (${id})`;
}

export function workModeLabel(modelId, effort) {
  const model = modelDisplayName(normalizeWorkbenchModelId(modelId)) || 'Auto';
  const level = WORKBENCH_EFFORT_LEVELS.find((item) => item.id === effort);
  if (effort === 'standard') return model;
  return [model, level?.label].filter(Boolean).join(' - ') || 'Model';
}

export function startedWorkPreferences({ modelId, effort, sourceMode, sourceIds, cadence }) {
  const level = WORKBENCH_EFFORT_LEVELS.find((item) => item.id === effort);
  const sources =
    sourceMode === WORKBENCH_AUTO_SOURCE_SCOPE.id
      ? WORKBENCH_AUTO_SOURCE_SCOPE.label
      : selectedWorkbenchSources(sourceIds)
          .map((source) => source.label)
          .join(', ') || 'Current chat context';
  return {
    model: modelOptionLabel(modelId || 'auto'),
    effort: level?.label || 'Standard',
    sources,
    timing: cadence?.trim() || 'Not specified'
  };
}

export function deriveWorkbenchModelOptions(models) {
  return Array.from(new Set(uniqueModelsByDisplayLabel(normalizeModelEntries(models))));
}

export function defaultWorkbenchModelId(activeModelId, modelOptions) {
  const normalizedActiveModelId = normalizeWorkbenchModelId(activeModelId);
  return modelOptions.includes(normalizedActiveModelId)
    ? normalizedActiveModelId
    : modelOptions[0] || normalizedActiveModelId;
}

export function modelCatalogBlockReason({
  activeProvider,
  modelsResult,
  modelsError,
  modelsLoading,
  activeModelId
} = {}) {
  if (!activeProvider || modelsLoading || activeProvider.can_list_models === false) return '';
  if (!modelsError && modelsResult?.ok !== false) return '';
  // The catalog listing failed — but if a concrete model is already active for
  // this provider, the model is usable even when list-models returns empty
  // (verified live: NEAR AI `zai-org/GLM-5.1-FP8` completes turns while
  // list-models returns 0). Don't hard-block the user from starting work over a
  // listing miss; a genuinely broken model surfaces as an error at send time.
  const activeModel = normalizeWorkbenchModelId(
    activeModelId || activeProvider.active_model || activeProvider.model || ''
  );
  if (activeModel !== 'auto') return '';
  const providerLabel = formatProviderLabel(activeProvider.id, activeProvider.name);
  return `${providerLabel} model access is not available right now. Open Settings / Inference to refresh provider access before starting work.`;
}

function readinessMatchesCapability(item, capabilityId) {
  const keys = new Set([
    item?.id,
    item?.iconSource?.id,
    item?.iconSource?.package_ref?.id,
    item?.iconSource?.packageRef?.id
  ]);
  return keys.has(capabilityId);
}

const CONNECTOR_FAMILY_CAPABILITY_IDS = Object.freeze({
  gmail: 'gmail',
  calendar: 'calendar',
  drive: 'google-drive',
  notion: 'notion',
  slack: 'slack'
});

export function connectorFamiliesToSourceReadiness(connectorFamilies = []) {
  return (connectorFamilies || [])
    .filter((family) => family?.state === 'ready')
    .map((family) => {
      const capabilityId = CONNECTOR_FAMILY_CAPABILITY_IDS[family.id] || family.id;
      return {
        id: capabilityId,
        state: 'ready',
        statusLabel: family.statusLabel || 'Ready',
        displayName: family.label || capabilityId,
        category: family.via ? `Connector via ${family.via}` : 'Connector',
        iconSource: { id: capabilityId }
      };
    });
}

export function manualSourceBlockReason({
  sourceMode,
  sourceIds,
  sourceReadiness = [],
  connectorFamilies = []
} = {}) {
  if (sourceMode === WORKBENCH_AUTO_SOURCE_SCOPE.id) return '';

  const readiness = [
    ...(sourceReadiness || []),
    ...connectorFamiliesToSourceReadiness(connectorFamilies)
  ];
  const selectedSources = selectedWorkbenchSources(sourceIds);
  for (const source of selectedSources) {
    const capabilityIds = WORKBENCH_SOURCE_CAPABILITY_MAP[source.id] || [];
    const capabilityItems = capabilityIds.flatMap((capabilityId) =>
      readiness.filter((item) => readinessMatchesCapability(item, capabilityId))
    );
    if (capabilityItems.length === 0) {
      return `${source.label} is not available from this gateway yet. Use Auto sources or connect it first.`;
    }
    if (!capabilityItems.some(sourceReadinessUsable)) {
      return `${source.label} is not connected yet. Open What's allowed to connect it, or switch to Auto sources.`;
    }
  }

  return '';
}

export function useWorkbenchStart({
  gatewayStatus,
  cooldownSeconds,
  send,
  attachmentsState,
  brief,
  setBrief,
  effort,
  sourceMode,
  sourceIds,
  sourceReadiness,
  connectorFamilies,
  liveSourceData,
  cadence,
  onStartedWork
}) {
  const queryClient = useQueryClient();
  const [modelId, setModelId] = React.useState('auto');
  const [modelSelectionDirty, setModelSelectionDirty] = React.useState(false);
  const [error, setError] = React.useState('');
  const [isStarting, setIsStarting] = React.useState(false);

  const providersQuery = useQuery({
    queryKey: ['llm-providers'],
    queryFn: fetchLlmProviders,
    staleTime: 60_000
  });
  const runtimeContext = React.useMemo(
    () => buildRuntimeContext({ gatewayStatus, activeThread: null }),
    [gatewayStatus]
  );
  const providersSnapshot = providersQuery.data;
  const providerSnapshot = visibleLlmSnapshot(providersSnapshot || {});
  const activeProvider =
    providerSnapshot.providers.find(
      (provider) => provider.id === providerSnapshot.active?.provider_id
    ) ||
    providerSnapshot.providers[0] ||
    null;
  const activeModelId = normalizeWorkbenchModelId(
    providerSnapshot.active?.model || activeProvider?.default_model || 'auto'
  );
  const modelsQuery = useQuery({
    queryKey: ['llm-models', activeProvider?.id],
    queryFn: () =>
      listLlmProviderModels({
        provider_id: activeProvider.id,
        adapter: activeProvider.adapter || activeProvider.id
      }),
    enabled: Boolean(activeProvider),
    staleTime: 60_000
  });
  const modelOptions = React.useMemo(
    () => deriveWorkbenchModelOptions(modelsQuery.data?.models || []),
    [modelsQuery.data?.models]
  );
  const preferredModelId = React.useMemo(
    () => defaultWorkbenchModelId(activeModelId, modelOptions),
    [activeModelId, modelOptions]
  );
  const providerSetupChecking = Boolean(!providersSnapshot && providersQuery.isLoading);
  const providerSetupFailed = Boolean(!providersSnapshot && providersQuery.error);
  const providerSetupRequired = Boolean(providersSnapshot && !providerSnapshot.active);
  const attachmentExtractionPending = attachmentsState.attachments.some(
    (attachment) => attachment.extraction === 'extracting'
  );
  const runtimeBlockReason = runtimeContext.sendBlocked
    ? gatewayModelBlockReason(gatewayStatus) || runtimeContext.sendBlockReason
    : '';
  const sourceBlockReason = manualSourceBlockReason({
    sourceMode,
    sourceIds,
    sourceReadiness,
    connectorFamilies
  });
  const catalogBlockReason = modelCatalogBlockReason({
    activeProvider,
    modelsResult: modelsQuery.data,
    modelsError: modelsQuery.error,
    modelsLoading: modelsQuery.isLoading,
    activeModelId
  });
  const startBlockReason =
    (attachmentExtractionPending && 'Finish reading attached files before starting work.') ||
    sourceBlockReason ||
    (providerSetupChecking && 'IronClaw is checking NEAR AI Cloud before it starts work.') ||
    (providerSetupRequired && 'Connect NEAR AI Cloud before starting work.') ||
    catalogBlockReason ||
    runtimeBlockReason ||
    (cooldownSeconds > 0 ? `Retry in ${cooldownSeconds}s.` : '');
  // A transient providers-query failure must NOT hard-disable Ask: the route is
  // frequently healthy and the check just failed to render. Surface it as a
  // compact, non-blocking notice and let the start path report the real error
  // if the provider genuinely cannot be reached.
  const startSoftNotice =
    !startBlockReason && providerSetupFailed
      ? "Could not re-check NEAR AI Cloud. You can still try; we'll confirm when work starts."
      : '';
  const startBlocked = Boolean(
    attachmentExtractionPending ||
    sourceBlockReason ||
    providerSetupChecking ||
    providerSetupRequired ||
    catalogBlockReason ||
    runtimeContext.sendBlocked ||
    cooldownSeconds > 0
  );

  React.useEffect(() => {
    if (!modelSelectionDirty && preferredModelId) setModelId(preferredModelId);
  }, [modelSelectionDirty, preferredModelId]);

  const selectModelId = React.useCallback((nextModelId) => {
    setModelSelectionDirty(true);
    setModelId(normalizeWorkbenchModelId(nextModelId));
  }, []);

  const draft = React.useMemo(
    () =>
      buildWorkbenchChatDraft({
        brief,
        modelId,
        modelLabel: modelOptionLabel(modelId),
        effort,
        sourceMode,
        sourceIds,
        cadence,
        connectorFamilies,
        liveSourceData
      }),
    [brief, modelId, effort, sourceMode, sourceIds, cadence, connectorFamilies, liveSourceData]
  );

  const startWorkbenchRequest = React.useCallback(async () => {
    if (!draft) {
      setError('Add the work you want IronClaw to handle.');
      return;
    }
    if (startBlocked) {
      setError(startBlockReason || 'Model access is not ready yet.');
      return;
    }
    setError('');
    setIsStarting(true);
    let chatSendStarted = false;

    try {
      if (activeProvider && modelId && modelId !== activeModelId) {
        await setActiveLlm({ provider_id: activeProvider.id, model: modelId });
        // Cache refresh is best-effort: a refetch rejection must not be reported
        // as a model-switch failure, since the switch above already succeeded.
        await queryClient.invalidateQueries({ queryKey: ['llm-providers'] }).catch(() => {});
        await queryClient.invalidateQueries({ queryKey: ['gateway-status'] }).catch(() => {});
      }
      chatSendStarted = true;
      const response = await send(draft, {
        timezone: userTimezone(),
        images: attachmentsState.images,
        attachments: attachmentsState.attachments
      });
      const threadId = response?.thread_id || '';
      if (!threadId) throw new Error('The runtime did not return a thread id.');
      const preferences = startedWorkPreferences({
        modelId,
        effort,
        sourceMode,
        sourceIds,
        cadence
      });
      clearStagedAttachments(WORKBENCH_DRAFT_KEY);
      attachmentsState.clearAttachments();
      onStartedWork({
        threadId,
        title: brief.trim(),
        scene: inferWorkbenchScene(brief),
        preferences,
        startedAt: new Date().toISOString()
      });
      setModelSelectionDirty(false);
      setBrief('');
    } catch (err) {
      setDraft(NEW_DRAFT_KEY, draft);
      setError(
        chatSendStarted
          ? workbenchStartErrorMessage(err)
          : workbenchModelSwitchErrorMessage(err, modelOptionLabel(modelId))
      );
    } finally {
      setIsStarting(false);
    }
  }, [
    activeProvider,
    activeModelId,
    attachmentsState.attachments,
    attachmentsState.clearAttachments,
    attachmentsState.images,
    brief,
    cadence,
    draft,
    effort,
    modelId,
    onStartedWork,
    queryClient,
    send,
    setBrief,
    sourceIds,
    sourceReadiness,
    sourceMode,
    startBlockReason,
    startBlocked
  ]);

  return {
    draft,
    error,
    setError,
    isStarting,
    modelId,
    selectModelId,
    modelOptions,
    modelsLoading: modelsQuery.isLoading,
    modelsError: Boolean(modelsQuery.error || (modelsQuery.data && modelsQuery.data.ok === false)),
    startBlocked,
    startBlockReason,
    startSoftNotice,
    startWorkbenchRequest
  };
}
