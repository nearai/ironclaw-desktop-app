import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useOutletContext } from 'react-router';
import { Icon } from '../../design-system/icons.js';
import { connectorWrite } from '../../lib/api.js';
import { listAutomations } from '../../lib/automations-api.js';
import { React, html } from '../../lib/html.js';
import { useThreadAttentionDetails } from '../../lib/thread-attention-details.js';
import { useThreadStates } from '../../lib/thread-state.js';
import { cn } from '../../utils/cn.js';
import { normalizeAutomations } from '../automations/lib/automations-presenters.js';
import { useChat } from '../chat/hooks/useChat.js';
import { useComposerAttachments } from '../chat/hooks/useComposerAttachments.js';
import { NEW_DRAFT_KEY, setDraft, setStagedAttachments } from '../chat/lib/draft-store.js';
import {
  fetchSavedWorkSnapshot,
  mergeSavedWorkSnapshots,
  readSavedWorkSnapshot,
  savedWorkServerReadSupported
} from '../chat/lib/work-product-save.js';
import { useConnectExtension, useExtensions } from '../extensions/hooks/useExtensions.js';
import { WORKBENCH_AUTO_SOURCE_SCOPE } from './lib/workbench-plan.js';
import { buildBriefing, isBriefingIntent } from './lib/workbench-briefing.js';
import { isSlackBlockerIntent } from './lib/workbench-slack.js';
import { buildReplyDraft, createdDraftId, draftWriteArguments } from './lib/workbench-draft.js';
import { WORKBENCH_DRAFT_KEY, useWorkbenchStart } from './hooks/useWorkbenchStart.js';
import { useDialogFocus } from './hooks/useDialogFocus.js';
import { useWorkbenchSourceReadiness } from './hooks/useWorkbenchSourceReadiness.js';
import { approvalsFeedReadSupported, fetchApprovalsFeed } from './lib/approvals-feed-api.js';
import { fetchReceiptsFeed, receiptsFeedReadSupported } from './lib/receipts-feed-api.js';
import { fetchWorkbenchFeed, workbenchFeedReadSupported } from './lib/workbench-feed-api.js';
import { buildWorkbenchStateRail } from './lib/workbench-state.js';
import { firstArtifact } from './lib/workbench-work-items.js';
import {
  useConnectedAccounts,
  useConnectorCalendar,
  useConnectorDrive,
  useConnectorGithub,
  useConnectorInbox,
  useConnectorNotion,
  useConnectorSlackBlockers
} from './hooks/useWorkbenchConnectors.js';
import {
  SourceReadinessStrip,
  WorkbenchArrived,
  WorkbenchDecisions,
  WorkbenchUpcoming
} from './components/workbench-arrived.js';
import { WorkbenchApprove } from './components/workbench-approve.js';
import { WorkbenchBriefing } from './components/workbench-briefing.js';
import { WorkbenchSlackBlockers } from './components/workbench-slack-blockers.js';
import { WorkbenchCommandSurface } from './components/workbench-command.js';
import { WorkbenchReadingPanel } from './components/workbench-reading-panel.js';
import { WorkbenchWorkspaceFiles } from './components/workbench-files.js';
import { LibraryView } from './components/workbench-library.js';
import { MemoryView } from './components/workbench-memory.js';
import { WorkPacketPreview } from './components/workbench-packet.js';
import { WorkbenchSceneWorkspace } from './components/workbench-scenes.js';
import { WorkbenchDock, WorkbenchNav, WorkbenchTop } from './components/workbench-shell.js';
import { WorkbenchSourcesInspector } from './components/workbench-sources-inspector.js';
import { WorkModeInspector } from './components/workbench-work-mode.js';
import { WORKBENCH_STYLE } from './workbench-styles.js';

// Groups that have a dedicated, richer main-column surface and so are not
// repeated as triage cards: unread mail renders as decision cards
// (WorkbenchDecisions) and calendar events render in the Upcoming card
// (WorkbenchUpcoming). They still appear as compact rows in the rail.
const TRIAGE_EXCLUDED_GROUPS = new Set(['needs-reply', 'upcoming']);

function TriageSection({ groups, hasDecisions = false }) {
  const populatedGroups = groups.filter(
    (group) => group.rows.length > 0 && !TRIAGE_EXCLUDED_GROUPS.has(group.id)
  );

  // When real unread mail is already rendered as decision cards above, an empty
  // "Nothing needs you" box would be a false negative — suppress it.
  if (!populatedGroups.length && hasDecisions) return null;

  // v13 fidelity: when nothing is actionable, render ONE graceful all-clear line
  // instead of stacking three dashed "Nothing… " boxes. Keep a genuinely
  // actionable group visible the moment it has rows.
  if (!populatedGroups.length) {
    return html`
      <div className="wb13-section" data-testid="workbench-triage">
        <div className="wb13-group">
          <div className="wb13-group-title">Needs a decision<span></span></div>
          <div className="wb13-allclear">
            Nothing needs you right now. Active work shows in the rail, and new arrivals appear
            above.
          </div>
        </div>
      </div>
    `;
  }

  return html`
    <div className="wb13-section" data-testid="workbench-triage">
      ${populatedGroups.map((group) => {
        const tone =
          group.id === 'needs-approval'
            ? 'hold'
            : group.id === 'blocked'
              ? 'danger'
              : group.id === 'working'
                ? 'run'
                : group.id === 'receipts'
                  ? 'done'
                  : 'ready';
        return html`
          <div key=${group.id} className="wb13-group">
            <div
              className=${cn(
                'wb13-group-title',
                group.id === 'needs-approval' && 'is-hold',
                group.id === 'blocked' && 'is-danger'
              )}
            >
              ${group.id === 'needs-approval' ? 'Needs a decision' : group.label}
              <span>${group.total ? `· ${group.total}` : ''}</span>
            </div>
            ${group.rows.map(
              (row) => html`<${TriageCard} key=${row.id} row=${row} tone=${tone} />`
            )}
          </div>
        `;
      })}
    </div>
  `;
}

function triageCtaLabel(row, tone) {
  if (tone === 'hold') return 'Review and decide';
  if (tone === 'danger') {
    if (/reconnect/i.test(row.detail || '') || /reconnect/i.test(row.badge || '')) {
      return 'Reconnect source';
    }
    return 'Recover run';
  }
  if (tone === 'run') return 'Open live thread';
  if (tone === 'done') return 'View receipt';
  return 'Open';
}

function TriageCard({ row, tone }) {
  const ctaLabel = triageCtaLabel(row, tone);
  return html`
    <div className="wb13-card">
      <div
        className=${cn(
          'wb13-action-icon',
          tone === 'hold' && 'is-hold',
          tone === 'danger' && 'is-danger',
          tone === 'done' && 'is-done',
          row.badge === 'Needs recovery' && 'is-danger'
        )}
      >
        <${Icon} name=${row.icon || 'spark'} />
      </div>
      <div className="wb13-card-main">
        <div className="wb13-card-title">${row.title}</div>
        <div className="wb13-card-copy">${row.detail}</div>
        <div className="wb13-card-trigger">
          <${Icon} name=${row.icon || 'shield'} />
          <span>${row.badge}</span>
        </div>
      </div>
      <div className="wb13-card-actions">
        <${Link}
          to=${row.href}
          className=${cn('wb13-button is-sm', tone === 'hold' && 'is-primary')}
        >
          ${ctaLabel}
        <//>
      </div>
    </div>
  `;
}

function HomeView(props) {
  const hasReviewableSavedWork = props.savedItems.some((item) => firstArtifact(item));
  const showWorkspaceFiles =
    props.commandProps.sourceMode !== WORKBENCH_AUTO_SOURCE_SCOPE.id &&
    props.commandProps.sourceIds.includes('local-files');

  return html`
    <main className="wb13-main">
      <div className="wb13-page">
        <div className="wb13-wrap">
          <${WorkbenchCommandSurface} ...${props.commandProps} />
          <${WorkbenchBriefing}
            briefing=${props.briefing}
            onOpenMessage=${props.onOpenMessage}
            onDismiss=${props.onDismissBriefing}
          />
          <${WorkbenchSlackBlockers}
            active=${props.slackBlockersActive}
            rows=${props.slackBlockers.rows}
            isLoading=${props.slackBlockers.isLoading}
            isError=${props.slackBlockers.isError}
            onDismiss=${props.onDismissSlackBlockers}
          />
          <${WorkbenchDecisions}
            gmailReady=${props.gmailReady}
            messages=${props.inboxMessages}
            onOpenMessage=${props.onOpenMessage}
            onDraftMessage=${props.onDraftMessage}
          />
          <${SourceReadinessStrip} families=${props.connectorFamilies} />
          <${WorkbenchArrived}
            gmailReady=${props.gmailReady}
            messages=${props.inboxMessages}
            isLoading=${props.inboxLoading}
            isError=${props.inboxError}
            onOpenMessage=${props.onOpenMessage}
          />
          <${WorkbenchUpcoming}
            calendarReady=${props.calendarReady}
            events=${props.calendarEvents}
            isError=${props.calendarError}
          />
          <${WorkbenchSceneWorkspace} work=${props.startedWork} />
          <${TriageSection}
            groups=${props.groups}
            hasDecisions=${props.gmailReady &&
            props.inboxMessages.some((message) => message.unread)}
          />
          ${hasReviewableSavedWork
            ? html`<${WorkPacketPreview}
                savedItems=${props.savedItems}
                activeTab=${props.packageTab}
                onTab=${props.onPackageTab}
              />`
            : null}
          ${showWorkspaceFiles
            ? html`<${WorkbenchWorkspaceFiles} onAttachFile=${props.onAttachWorkspaceFile} />`
            : null}
        </div>
      </div>
    </main>
  `;
}

function CadenceInspector({ cadence, setCadence, onClose }) {
  const presets = ['Today', 'Tomorrow morning', 'Friday morning', 'Every Friday, 8 AM'];
  const { panelRef } = useDialogFocus(true);
  return html`
    <div>
      <button
        type="button"
        className="wb13-scrim"
        aria-label="Close cadence inspector"
        onClick=${onClose}
      ></button>
      <aside
        ref=${panelRef}
        tabindex=${-1}
        className="wb13-inspector"
        aria-label="Due date or cadence"
      >
        <div className="wb13-inspector-head">
          <${Icon} name="clock" />
          Due date or cadence
          <button type="button" aria-label="Close" onClick=${onClose}>
            <${Icon} name="close" />
          </button>
        </div>
        <p className="wb13-inspector-sub">
          Tell IronClaw when you need this, or make it recurring.
        </p>
        <div className="wb13-inspector-block">
          <h5>Timing</h5>
          <label className="wb13-pill-control wb13-full-control">
            When
            <input
              type="text"
              value=${cadence}
              aria-label="Cadence inspector timing"
              placeholder="Due date or cadence"
              onInput=${(event) => setCadence(event.currentTarget.value)}
            />
          </label>
          <div className="wb13-chips">
            ${presets.map(
              (preset) => html`
                <button
                  key=${preset}
                  type="button"
                  className="wb13-chip"
                  onClick=${() => setCadence(preset)}
                >
                  ${preset}
                </button>
              `
            )}
          </div>
        </div>
        <div className="wb13-inspector-block">
          <h5>Recurring work always asks first</h5>
          <div className="wb13-inspector-note">
            Timing guidance is sent to the live thread. Creating or changing a recurring schedule
            still needs a backed automation flow and approval.
          </div>
        </div>
      </aside>
    </div>
  `;
}

export function WorkbenchPage() {
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const { gatewayStatus, currentUser, threadsState: outletThreadsState } = outletContext;
  const { cooldownSeconds, send } = useChat(null);
  const threadStates = useThreadStates();
  const threadAttentionDetails = useThreadAttentionDetails();
  const extensionsState = useExtensions();
  const sourceConnection = useConnectExtension();
  const attachmentsState = useComposerAttachments(WORKBENCH_DRAFT_KEY);
  const automationsQuery = useQuery({
    queryKey: ['workbench-automations-rail'],
    queryFn: () => listAutomations({ limit: 50, runLimit: 5 }),
    staleTime: 30_000,
    retry: 1
  });
  const [view, setView] = React.useState('home');
  const [brief, setBrief] = React.useState('');
  const [effort, setEffort] = React.useState('standard');
  const [sourceMode, setSourceMode] = React.useState(WORKBENCH_AUTO_SOURCE_SCOPE.id);
  const [sourceIds, setSourceIds] = React.useState(['web', 'local-files']);
  const [cadence, setCadence] = React.useState('');
  const [savedWorkSnapshot, setSavedWorkSnapshot] = React.useState(() => readSavedWorkSnapshot());
  const [packageTab, setPackageTab] = React.useState('overview');
  const [startedWork, setStartedWork] = React.useState(null);
  // The deterministic briefing result, when the user asked a catch-up question
  // the Workbench can answer from connector data already in hand (no agent).
  const [briefing, setBriefing] = React.useState(null);
  const [briefingPending, setBriefingPending] = React.useState(false);
  // Latch for the on-demand "Find Slack blockers" search (a real read, not a
  // cached poll), so it only runs when the user explicitly asks.
  const [slackBlockersActive, setSlackBlockersActive] = React.useState(false);
  const [briefingSlackActive, setBriefingSlackActive] = React.useState(false);
  const [dockOpen, setDockOpen] = React.useState(false);
  const [showSources, setShowSources] = React.useState(false);
  const [showCadence, setShowCadence] = React.useState(false);
  const [showWorkMode, setShowWorkMode] = React.useState(false);
  // The inbox row/decision card currently open in the reading panel. Carries
  // the row's { messageId, threadId, sender, subject } so the panel can fetch
  // the full message (READ tool) and render the header while it loads.
  const [selectedMessage, setSelectedMessage] = React.useState(null);

  const openMessage = React.useCallback((message) => {
    if (!message) return;
    setSelectedMessage(message);
  }, []);
  const closeMessage = React.useCallback(() => setSelectedMessage(null), []);

  // Gated-write "Draft reply" flow. `draftContext` holds the editable reply
  // package; `draftResult` carries the create outcome. Creating a draft is the
  // ONLY write the UI initiates, and it never sends.
  const [draftContext, setDraftContext] = React.useState(null);
  const [draftBusy, setDraftBusy] = React.useState(false);
  const [draftResult, setDraftResult] = React.useState(null);
  const savedWorkReadEnabled = savedWorkServerReadSupported(gatewayStatus);
  const approvalsReadEnabled = approvalsFeedReadSupported(gatewayStatus);
  const receiptsReadEnabled = receiptsFeedReadSupported(gatewayStatus);
  const workbenchFeedReadEnabled = workbenchFeedReadSupported(gatewayStatus);
  const serverSavedWorkQuery = useQuery({
    queryKey: ['workbench-saved-work-server'],
    queryFn: ({ signal }) => fetchSavedWorkSnapshot({ signal }),
    enabled: savedWorkReadEnabled,
    staleTime: 30_000,
    retry: 1,
    throwOnError: false
  });
  const approvalsFeedQuery = useQuery({
    queryKey: ['workbench-approvals-feed'],
    queryFn: ({ signal }) => fetchApprovalsFeed({ signal }),
    enabled: approvalsReadEnabled,
    staleTime: 30_000,
    retry: 1,
    throwOnError: false
  });
  const receiptsFeedQuery = useQuery({
    queryKey: ['workbench-receipts-feed'],
    queryFn: ({ signal }) => fetchReceiptsFeed({ signal }),
    enabled: receiptsReadEnabled,
    staleTime: 30_000,
    retry: 1,
    throwOnError: false
  });
  const workbenchFeedQuery = useQuery({
    queryKey: ['workbench-feed'],
    queryFn: ({ signal }) => fetchWorkbenchFeed({ signal }),
    enabled: workbenchFeedReadEnabled,
    staleTime: 30_000,
    retry: 1,
    throwOnError: false
  });

  const openDraftReply = React.useCallback((message) => {
    setDraftResult(null);
    setDraftContext(buildReplyDraft({ message, selected: message }));
  }, []);
  const closeDraft = React.useCallback(() => {
    setDraftContext(null);
    setDraftResult(null);
    setDraftBusy(false);
  }, []);
  const submitDraft = React.useCallback(async (fields) => {
    setDraftBusy(true);
    setDraftResult(null);
    try {
      const response = await connectorWrite({
        toolkit: 'gmail',
        tool: 'GMAIL_CREATE_EMAIL_DRAFT',
        arguments: draftWriteArguments(fields)
      });
      const ok = Boolean(response) && response.successful !== false;
      setDraftResult({
        ok,
        draftId: ok ? createdDraftId(response) : '',
        error: ok ? '' : String(response?.error || 'The draft was not created.')
      });
    } catch (err) {
      setDraftResult({
        ok: false,
        draftId: '',
        error: String(err?.message || 'Could not create the draft.')
      });
    } finally {
      setDraftBusy(false);
    }
  }, []);

  const { sourceReadiness } = useWorkbenchSourceReadiness({
    ...extensionsState,
    connectState: sourceConnection.connectState
  });

  const connectedAccounts = useConnectedAccounts();
  const connectorInbox = useConnectorInbox({
    enabled: connectedAccounts.gmailReady,
    maxResults: 6
  });
  const connectorCalendar = useConnectorCalendar({
    enabled: connectedAccounts.calendarReady,
    maxResults: 6
  });
  const slackBlockers = useConnectorSlackBlockers({
    enabled: (slackBlockersActive || briefingSlackActive) && connectedAccounts.slackReady,
    maxResults: 8
  });
  const connectorDrive = useConnectorDrive({ enabled: connectedAccounts.driveReady });
  const connectorNotion = useConnectorNotion({ enabled: connectedAccounts.notionReady });
  const connectorGithub = useConnectorGithub({ enabled: connectedAccounts.githubReady });

  const {
    draft,
    error,
    setError,
    isStarting,
    modelId,
    selectModelId,
    modelOptions,
    modelsLoading,
    modelsError,
    startBlocked,
    startBlockReason,
    startSoftNotice,
    startWorkbenchRequest
  } = useWorkbenchStart({
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
    connectorFamilies: connectedAccounts.families,
    cadence,
    onStartedWork: setStartedWork
  });

  React.useEffect(() => {
    setSavedWorkSnapshot(readSavedWorkSnapshot());
  }, []);

  React.useEffect(() => {
    if (!savedWorkReadEnabled || !serverSavedWorkQuery.data) return;
    setSavedWorkSnapshot((localSnapshot) =>
      mergeSavedWorkSnapshots(serverSavedWorkQuery.data, localSnapshot)
    );
  }, [savedWorkReadEnabled, serverSavedWorkQuery.data]);

  const savedItems = savedWorkSnapshot.items;

  React.useEffect(() => {
    if (!showSources && !showCadence && !showWorkMode && !dockOpen && !selectedMessage) {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setShowSources(false);
      setShowCadence(false);
      setShowWorkMode(false);
      setDockOpen(false);
      setSelectedMessage(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSources, showCadence, showWorkMode, dockOpen, selectedMessage]);

  const automations = React.useMemo(
    () => normalizeAutomations(automationsQuery.data),
    [automationsQuery.data]
  );

  const selectSource = React.useCallback((id) => {
    setSourceMode('manual');
    setSourceIds([id]);
  }, []);

  const railGroups = React.useMemo(
    () =>
      buildWorkbenchStateRail({
        threads: outletThreadsState?.threads || [],
        threadStates,
        threadAttentionDetails,
        savedItems,
        automations,
        feedItems: workbenchFeedQuery.data || [],
        approvals: approvalsFeedQuery.data || [],
        receipts: receiptsFeedQuery.data || [],
        sourceReadiness,
        inbox: { messages: connectorInbox.messages },
        calendar: { events: connectorCalendar.events },
        limit: 4
      }),
    [
      automations,
      approvalsFeedQuery.data,
      receiptsFeedQuery.data,
      workbenchFeedQuery.data,
      connectorCalendar.events,
      connectorInbox.messages,
      outletThreadsState?.threads,
      savedItems,
      sourceReadiness,
      threadAttentionDetails,
      threadStates
    ]
  );

  // Answer a catch-up intent instantly from connector data already loaded —
  // unread inbox, upcoming calendar, Slack blocker search rows, and the
  // active-work rail — with no model or agent round-trip. Everything else still
  // routes through the Chat runtime.
  const canBrief =
    connectedAccounts.gmailReady ||
    connectedAccounts.calendarReady ||
    connectedAccounts.slackReady ||
    connectedAccounts.githubReady ||
    connectedAccounts.driveReady ||
    connectedAccounts.notionReady;
  const briefingReadySources = React.useMemo(() => {
    const sources = [];
    const add = (ready, id, label) => {
      if (ready) sources.push({ id, label });
    };
    add(connectedAccounts.gmailReady, 'gmail', 'Gmail');
    add(connectedAccounts.calendarReady, 'calendar', 'Calendar');
    add(connectedAccounts.slackReady, 'slack', 'Slack');
    add(connectedAccounts.githubReady, 'github', 'GitHub');
    add(connectedAccounts.driveReady, 'drive', 'Drive');
    add(connectedAccounts.notionReady, 'notion', 'Notion');
    return sources;
  }, [
    connectedAccounts.gmailReady,
    connectedAccounts.calendarReady,
    connectedAccounts.slackReady,
    connectedAccounts.githubReady,
    connectedAccounts.driveReady,
    connectedAccounts.notionReady
  ]);
  const briefingLoadingSources = React.useMemo(() => {
    const sources = [];
    const add = (ready, pending, id, label) => {
      if (!ready || !pending) return;
      sources.push({ id, label });
    };
    add(
      connectedAccounts.gmailReady,
      connectorInbox.isLoading || connectorInbox.isFetching,
      'gmail',
      'Gmail'
    );
    add(
      connectedAccounts.calendarReady,
      connectorCalendar.isLoading || connectorCalendar.isFetching,
      'calendar',
      'Calendar'
    );
    add(
      connectedAccounts.slackReady && slackBlockers.enabled,
      slackBlockers.isLoading || slackBlockers.isFetching,
      'slack',
      'Slack'
    );
    add(
      connectedAccounts.githubReady,
      connectorGithub.isLoading || connectorGithub.isFetching,
      'github',
      'GitHub'
    );
    add(
      connectedAccounts.driveReady,
      connectorDrive.isLoading || connectorDrive.isFetching,
      'drive',
      'Drive'
    );
    add(
      connectedAccounts.notionReady,
      connectorNotion.isLoading || connectorNotion.isFetching,
      'notion',
      'Notion'
    );
    return sources;
  }, [
    connectedAccounts.gmailReady,
    connectedAccounts.calendarReady,
    connectedAccounts.slackReady,
    connectedAccounts.githubReady,
    connectedAccounts.driveReady,
    connectedAccounts.notionReady,
    connectorInbox.isLoading,
    connectorInbox.isFetching,
    connectorCalendar.isLoading,
    connectorCalendar.isFetching,
    slackBlockers.enabled,
    slackBlockers.isLoading,
    slackBlockers.isFetching,
    connectorGithub.isLoading,
    connectorGithub.isFetching,
    connectorDrive.isLoading,
    connectorDrive.isFetching,
    connectorNotion.isLoading,
    connectorNotion.isFetching
  ]);
  const briefingReadsPending = briefingLoadingSources.length > 0;
  const briefingSourceProblems = React.useMemo(() => {
    const problems = [];
    const add = (isReady, isError, id, label) => {
      if (!isReady || !isError) return;
      problems.push({
        id,
        label,
        detail: `Could not read ${label} right now. Try again or reconnect if this keeps happening.`
      });
    };
    add(connectedAccounts.gmailReady, connectorInbox.isError, 'gmail', 'Gmail');
    add(connectedAccounts.calendarReady, connectorCalendar.isError, 'calendar', 'Calendar');
    add(
      connectedAccounts.slackReady && slackBlockers.enabled,
      slackBlockers.isError,
      'slack',
      'Slack'
    );
    add(connectedAccounts.githubReady, connectorGithub.isError, 'github', 'GitHub');
    add(connectedAccounts.driveReady, connectorDrive.isError, 'drive', 'Drive');
    add(connectedAccounts.notionReady, connectorNotion.isError, 'notion', 'Notion');
    return problems;
  }, [
    connectedAccounts.gmailReady,
    connectedAccounts.calendarReady,
    connectedAccounts.slackReady,
    slackBlockers.enabled,
    connectedAccounts.githubReady,
    connectedAccounts.driveReady,
    connectedAccounts.notionReady,
    connectorInbox.isError,
    connectorCalendar.isError,
    slackBlockers.isError,
    connectorGithub.isError,
    connectorDrive.isError,
    connectorNotion.isError
  ]);
  const runBriefing = React.useCallback(() => {
    setError('');
    setBriefingPending(false);
    setBriefing(
      buildBriefing({
        inboxMessages: connectorInbox.messages,
        calendarEvents: connectorCalendar.events,
        railGroups,
        slackBlockers: slackBlockers.rows,
        githubNotifications: connectorGithub.notifications,
        driveFiles: connectorDrive.files,
        notionPages: connectorNotion.pages,
        sourceProblems: briefingSourceProblems,
        gmailReady: connectedAccounts.gmailReady,
        calendarReady: connectedAccounts.calendarReady,
        slackReady: connectedAccounts.slackReady && (briefingSlackActive || slackBlockers.enabled),
        githubReady: connectedAccounts.githubReady,
        driveReady: connectedAccounts.driveReady,
        notionReady: connectedAccounts.notionReady,
        now: new Date()
      })
    );
    setBrief('');
  }, [
    connectorInbox.messages,
    connectorCalendar.events,
    railGroups,
    slackBlockers.rows,
    slackBlockers.enabled,
    connectorGithub.notifications,
    connectorDrive.files,
    connectorNotion.pages,
    briefingSourceProblems,
    connectedAccounts.gmailReady,
    connectedAccounts.calendarReady,
    connectedAccounts.slackReady,
    briefingSlackActive,
    connectedAccounts.githubReady,
    connectedAccounts.driveReady,
    connectedAccounts.notionReady,
    setError
  ]);
  React.useEffect(() => {
    if (!briefingPending || briefingReadsPending) return;
    runBriefing();
  }, [briefingPending, briefingReadsPending, runBriefing]);

  const dismissBriefing = React.useCallback(() => {
    setBriefingPending(false);
    setBriefingSlackActive(false);
    setBriefing(null);
  }, []);

  const handleAsk = React.useCallback(() => {
    // Slack-blocker intent is checked first (it is more specific than the
    // catch-up briefing) and only when Slack is a live account.
    if (connectedAccounts.slackReady && isSlackBlockerIntent(brief)) {
      setError('');
      setSlackBlockersActive(true);
      setBrief('');
      return;
    }
    if (canBrief && isBriefingIntent(brief)) {
      if (slackBlockersActive) setSlackBlockersActive(false);
      const shouldStartSlackBriefing = connectedAccounts.slackReady && !slackBlockers.enabled;
      if (shouldStartSlackBriefing || briefingReadsPending) {
        setError('');
        setSlackBlockersActive(false);
        if (shouldStartSlackBriefing) setBriefingSlackActive(true);
        setBriefingPending(true);
        setBriefing({
          isLoading: true,
          sources: shouldStartSlackBriefing ? briefingReadySources : briefingLoadingSources
        });
        setBrief('');
        return;
      }
      runBriefing();
      return;
    }
    startWorkbenchRequest();
  }, [
    brief,
    briefingLoadingSources,
    briefingReadySources,
    briefingReadsPending,
    canBrief,
    connectedAccounts.slackReady,
    runBriefing,
    slackBlockersActive,
    slackBlockers.enabled,
    setBrief,
    setError,
    startWorkbenchRequest
  ]);

  const openDraftInChat = React.useCallback(() => {
    if (!draft) {
      setError('Add the work you want IronClaw to handle.');
      return;
    }
    setError('');
    setDraft(NEW_DRAFT_KEY, draft);
    setStagedAttachments(NEW_DRAFT_KEY, {
      images: attachmentsState.images,
      attachments: attachmentsState.attachments
    });
    navigate('/chat', { state: { composerDraft: draft } });
  }, [attachmentsState.attachments, attachmentsState.images, draft, navigate, setError]);

  const openSourceSetup = React.useCallback(
    (entry) => {
      const ref = entry?.package_ref || entry?.packageRef;
      const id = typeof ref === 'string' ? ref : ref?.id || entry?.id || '';
      if (!id) {
        navigate('/extensions/registry');
        return;
      }
      const focus = id.includes('/') ? id.split('/').filter(Boolean).pop() : id;
      navigate(`/extensions/registry?setup=1&focus=${encodeURIComponent(focus)}`);
    },
    [navigate]
  );

  const commandProps = {
    brief,
    setBrief,
    modelId,
    effort,
    sourceMode,
    sourceIds,
    onAutoSource: () => setSourceMode(WORKBENCH_AUTO_SOURCE_SCOPE.id),
    onSelectSource: selectSource,
    onAsk: handleAsk,
    onOpenSources: () => setShowSources(true),
    onOpenCadence: () => setShowCadence(true),
    onOpenWorkMode: () => setShowWorkMode(true),
    isStarting,
    startBlocked,
    startBlockReason,
    startSoftNotice,
    error,
    openDraftInChat,
    attachmentsState
  };

  return html`
    <div className="wb13" data-testid="workbench-page">
      <style>
        ${WORKBENCH_STYLE}
      </style>
      <div className="wb13-shell">
        <${WorkbenchNav} view=${view} onView=${setView} />
        <${WorkbenchDock}
          groups=${railGroups}
          open=${dockOpen}
          onClose=${() => setDockOpen(false)}
          onOpenMessage=${openMessage}
          currentUser=${currentUser}
        />
        ${dockOpen
          ? html`<button
              type="button"
              className="wb13-dock-scrim"
              aria-label="Dismiss active work overlay"
              onClick=${() => setDockOpen(false)}
            />`
          : null}
        <${WorkbenchTop}
          view=${view}
          currentUser=${currentUser}
          dockOpen=${dockOpen}
          onHome=${() => setView('home')}
          onToggleDock=${() => setDockOpen((value) => !value)}
        />
        ${view === 'memory'
          ? html`<${MemoryView} />`
          : view === 'library'
            ? html`<${LibraryView}
                savedItems=${savedItems}
                savedWorkSnapshot=${savedWorkSnapshot}
                onView=${setView}
              />`
            : html`<${HomeView}
                commandProps=${commandProps}
                startedWork=${startedWork}
                briefing=${briefing}
                onDismissBriefing=${dismissBriefing}
                slackBlockersActive=${slackBlockersActive}
                slackBlockers=${slackBlockers}
                onDismissSlackBlockers=${() => setSlackBlockersActive(false)}
                onOpenMessage=${openMessage}
                groups=${railGroups}
                savedItems=${savedItems}
                packageTab=${packageTab}
                onPackageTab=${setPackageTab}
                connectorFamilies=${connectedAccounts.families}
                gmailReady=${connectedAccounts.gmailReady}
                inboxMessages=${connectorInbox.messages}
                inboxLoading=${connectorInbox.isLoading}
                inboxError=${connectorInbox.isError}
                calendarReady=${connectedAccounts.calendarReady}
                calendarEvents=${connectorCalendar.events}
                calendarError=${connectorCalendar.isError}
                onAttachWorkspaceFile=${(file) => attachmentsState.addFiles([file])}
                onDraftMessage=${openDraftReply}
              />`}
        ${showSources
          ? html`<${WorkbenchSourcesInspector}
              sourceReadiness=${sourceReadiness}
              isBusy=${extensionsState.isBusy}
              onConnectSource=${sourceConnection.connect}
              onManualSetupSource=${openSourceSetup}
              onClose=${() => setShowSources(false)}
            />`
          : null}
        ${showCadence
          ? html`<${CadenceInspector}
              cadence=${cadence}
              setCadence=${setCadence}
              onClose=${() => setShowCadence(false)}
            />`
          : null}
        ${showWorkMode
          ? html`<${WorkModeInspector}
              modelId=${modelId}
              setModelId=${selectModelId}
              modelOptions=${modelOptions}
              modelsLoading=${modelsLoading}
              modelsError=${modelsError}
              effort=${effort}
              setEffort=${setEffort}
              onClose=${() => setShowWorkMode(false)}
            />`
          : null}
        <${WorkbenchReadingPanel}
          selected=${selectedMessage}
          onClose=${closeMessage}
          onDraftReply=${openDraftReply}
        />
        <${WorkbenchApprove}
          context=${draftContext}
          sendEnabled=${false}
          busy=${draftBusy}
          result=${draftResult}
          onCancel=${closeDraft}
          onSubmit=${submitDraft}
        />
      </div>
    </div>
  `;
}
