import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useOutletContext } from 'react-router';
import { Icon } from '../../design-system/icons.js';
import { connectorWrite, createThread, sendMessage, fetchTimeline } from '../../lib/api.js';
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
// workbench-brief-synth is loaded lazily (dynamic import in runBriefing) so the
// synthesis engine + its prompts stay out of the cold-start bundle — it is only
// needed once a catch-up briefing is actually requested.
import { isSlackBlockerIntent } from './lib/workbench-slack.js';
import { buildReplyDraft, createdDraftId, draftWriteArguments } from './lib/workbench-draft.js';
import { generateSuggestedReply } from './lib/workbench-reply.js';
import { WORKBENCH_DRAFT_KEY, useWorkbenchStart } from './hooks/useWorkbenchStart.js';
import { useDialogFocus } from './hooks/useDialogFocus.js';
import { useWorkbenchSourceReadiness } from './hooks/useWorkbenchSourceReadiness.js';
import { approvalsFeedReadSupported, fetchApprovalsFeed } from './lib/approvals-feed-api.js';
import { fetchReceiptsFeed, receiptsFeedReadSupported } from './lib/receipts-feed-api.js';
import { fetchWorkbenchFeed, workbenchFeedReadSupported } from './lib/workbench-feed-api.js';
import { buildWorkbenchStateRail } from './lib/workbench-state.js';
import { readTierOverrides } from './lib/workbench-profile-overrides.js';
import { readDismissals, dismissRow, learnedIgnoreSenders } from './lib/workbench-dismissals.js';
import { selectTriageInbox, answeredThreadIndex } from './lib/workbench-connectors.js';
import { firstArtifact } from './lib/workbench-work-items.js';
import {
  useConnectedAccounts,
  useConnectorCalendar,
  useConnectorDrive,
  useConnectorGithub,
  useConnectorInbox,
  useConnectorSent,
  useConnectorNotion,
  useConnectorSlackBlockers,
  useConnectorSlackDeep
} from './hooks/useWorkbenchConnectors.js';
import { WorkbenchColdStart, WorkbenchDecisions } from './components/workbench-arrived.js';
import { WorkbenchApprove } from './components/workbench-approve.js';
import { WorkbenchBriefing } from './components/workbench-briefing.js';
// The rich briefing renders only AFTER a synthesis turn (never on cold start), so
// lazy-load it to keep its weight out of the cold-start bundle. React.lazy wants a
// default export, so map the named WorkbenchBrief onto `.default`.
const WorkbenchBrief = React.lazy(() =>
  import('./components/workbench-brief.js').then((m) => ({ default: m.WorkbenchBrief }))
);
import { WorkbenchSlackBlockers } from './components/workbench-slack-blockers.js';
import { WorkbenchCommandSurface } from './components/workbench-command.js';
import { WorkbenchReadingPanel } from './components/workbench-reading-panel.js';
import { WorkbenchWorkspaceFiles } from './components/workbench-files.js';
import { LibraryView } from './components/workbench-library.js';
import { MemoryView } from './components/workbench-memory.js';
// Calendar is a secondary view — lazy-load it so its time-grid styles + layout
// logic stay out of the cold-start bundle. React.lazy wants a default export, so
// map the named CalendarView onto `.default`.
const CalendarView = React.lazy(() =>
  import('./components/workbench-calendar.js').then((m) => ({ default: m.CalendarView }))
);
import { WorkPacketPreview } from './components/workbench-packet.js';
import { WorkbenchSceneWorkspace } from './components/workbench-scenes.js';
import { WorkbenchDock, WorkbenchNav, WorkbenchTop } from './components/workbench-shell.js';
import { WorkbenchCommandPalette } from './components/workbench-command-palette.js';
import { WorkbenchShortcuts } from './components/workbench-shortcuts.js';
import { WorkbenchSourcesInspector } from './components/workbench-sources-inspector.js';
import { WorkModeInspector } from './components/workbench-work-mode.js';
import { WORKBENCH_STYLE } from './workbench-styles.js';

// Groups NOT repeated as main-column triage cards. The home is a briefing, not an
// ops console: unread mail renders as decision cards (WorkbenchDecisions); the
// recent-ACTIVITY feeds (github notifications, recent Notion pages, recent Drive
// files) are low-signal context that belongs in the rail, not stacked as a wall
// of cards in the main column (they were the bulk of the home's noise — e.g. six
// CI-failure cards). All of these still appear as compact rows in the left rail.
// 'upcoming' is a LIVE backend-feed rail group (server-advertised calendar/upcoming
// items — see workbench-feed-api.js); the Calendar tab owns the schedule. The
// triage still surfaces genuinely-actionable work-STATUS (approvals, blocked,
// working, ready-to-review, receipts, scheduled).
// Not dead config — do not remove 'upcoming' without dropping the feed pathway.
const TRIAGE_EXCLUDED_GROUPS = new Set(['needs-reply', 'upcoming', 'github', 'notion', 'drive']);

// Profile that scopes the rich briefing's "Worth weighing in" radar (role -> domain
// + the channels the radar may scan). The radar module (workbench-radar.js) is
// generic; the profile is supplied at runtime. For the first test user it is
// configured here from known facts.
// TODO: wire a real profile source (a live Slack profile read or in-app settings)
// so this is not hardcoded — see the briefing-as-home plan.
const WORKBENCH_PROFILE = Object.freeze({
  name: 'Abhishek Vaidyanathan',
  title: 'Chief Legal Officer',
  // Email is the key that resolves the signed-in user inside the Slack workspace
  // (SLACK_LIST_ALL_USERS, matched by profile.email) so the briefing can tell apart
  // "you were @-mentioned" from "a decision is forming without you". When it does not
  // match a workspace member the deep read degrades to the blocker fallback.
  // TODO: source this from the connected Gmail/Slack identity rather than hardcoding.
  email: 'abby.vaidyanathan@gmail.com',
  channels: [
    '#x-intents',
    '#t-agentmarket',
    '#x-nearai-compliance',
    '#kyc_status',
    '#wallet_status'
  ],
  // Real examples of how this user writes replies — the needsYou synthesis turn
  // few-shots off these so suggested replies sound like the user (lowercase, first-
  // person, a specific legal position), not a generic assistant. TODO: source from
  // the user's recent sent Slack/email instead of hardcoding.
  voiceSample: [
    "fine to match the NF terms, but i'm not signing uncapped liability on directorship services — make the liability cap mutual and carve out gross negligence / wilful misconduct on the indemnities. if they won't move, note the residual exposure and we accept it consciously. hold signature until i've seen the final clause.",
    "devhub grant terms don't cover this — external BD with full crm access needs at minimum an NDA with a non-solicit over anything in the NF pipeline. don't grant access until that's signed."
  ]
});

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
        <div className=${cn('wb13-wrap', props.startedWork && 'is-wide')}>
          <${WorkbenchCommandSurface} ...${props.commandProps} />
          <${WorkbenchColdStart}
            families=${props.connectorFamilies}
            isLoading=${props.connectorsLoading}
            onConnect=${props.onConnectSources}
          />
          ${props.briefing?.kind === 'rich'
            ? html`<${React.Suspense} fallback=${null}>
                <${WorkbenchBrief}
                  briefing=${props.briefing}
                  onDraftReply=${props.onBriefDraftReply}
                  onDismiss=${props.onDismissBriefing}
                />
              </${React.Suspense}>`
            : html`<${WorkbenchBriefing}
                briefing=${props.briefing}
                onOpenMessage=${props.onOpenMessage}
                onDismiss=${props.onDismissBriefing}
              />`}
          <${WorkbenchSlackBlockers}
            active=${props.slackBlockersActive}
            rows=${props.slackBlockers.rows}
            isLoading=${props.slackBlockers.isLoading}
            isError=${props.slackBlockers.isError}
            onDismiss=${props.onDismissSlackBlockers}
          />
          <${WorkbenchDecisions}
            gmailReady=${props.gmailReady}
            messages=${props.decisionMessages}
            onOpenMessage=${props.onOpenMessage}
            onDraftMessage=${props.onDraftMessage}
            onDismiss=${props.onDismissDecision}
          />
          <${WorkbenchSceneWorkspace} work=${props.startedWork} />
          <${TriageSection}
            groups=${props.groups}
            hasDecisions=${props.gmailReady &&
            props.decisionMessages.some((message) => message.unread)}
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
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);

  // Keyboard layer (DESIGN.md Law 5, native-to-the-Mac; the critique's §7).
  // Cmd/Ctrl+K opens the palette from anywhere (even inside a field). Bare-key
  // shortcuts (/, ?, the "g" nav chord) only fire when focus is NOT in a text
  // field, so typing in the command box is never hijacked.
  React.useEffect(() => {
    let gPending = false;
    let gTimer = 0;
    const inField = (el) =>
      Boolean(el) && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    const onKey = (event) => {
      // Esc closes the shortcuts overlay from anywhere (the palette handles its
      // own Esc on its input); a no-op when nothing is open.
      if (event.key === 'Escape') {
        setShortcutsOpen(false);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((value) => !value);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (inField(document.activeElement)) return;
      if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen((value) => !value);
        return;
      }
      if (event.key === '/') {
        event.preventDefault();
        document.querySelector('[data-testid="workbench-brief-input"]')?.focus();
        return;
      }
      if (event.key === 'g') {
        gPending = true;
        window.clearTimeout(gTimer);
        gTimer = window.setTimeout(() => {
          gPending = false;
        }, 800);
        return;
      }
      if (gPending) {
        gPending = false;
        const target = { w: 'home', m: 'memory', l: 'library' }[event.key];
        if (target) {
          event.preventDefault();
          setView(target);
        } else if (event.key === 't') {
          event.preventDefault();
          navigate('/extensions/registry');
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(gTimer);
    };
  }, [navigate]);

  const paletteCommands = React.useMemo(
    () => [
      {
        id: 'nav-work',
        label: 'Go to Work',
        icon: 'layers',
        keywords: 'home triage queue',
        run: () => setView('home')
      },
      {
        id: 'nav-memory',
        label: 'Go to Memory',
        icon: 'book',
        keywords: 'context preferences',
        run: () => setView('memory')
      },
      {
        id: 'nav-library',
        label: 'Go to Library',
        icon: 'file',
        keywords: 'saved work packets',
        run: () => setView('library')
      },
      {
        id: 'nav-chat',
        label: 'Open Chat',
        icon: 'chat',
        keywords: 'thread conversation',
        run: () => navigate('/chat')
      },
      {
        id: 'nav-automations',
        label: 'Automations',
        icon: 'clock',
        keywords: 'recurring schedule',
        run: () => navigate('/automations')
      },
      {
        id: 'nav-tools',
        label: 'Tools & connectors',
        icon: 'plug',
        keywords: 'extensions composio mcp sources',
        run: () => navigate('/extensions/registry')
      },
      {
        id: 'nav-settings',
        label: 'Settings',
        icon: 'settings',
        keywords: 'model inference account',
        run: () => navigate('/settings/inference')
      }
    ],
    [navigate]
  );

  // Compose from the palette: prefill the command box and surface Home — never
  // auto-send (the user reviews + hits Ask), so it sidesteps the start hook's
  // closure timing and keeps the gated posture.
  const composeFromPalette = React.useCallback(
    (text) => {
      setBrief(text);
      setView('home');
    },
    [setBrief]
  );
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
  // While a reply is being drafted by the agent, the modal shows a generating
  // state. A token guards against a second "Draft reply" landing its result on the
  // wrong (newer) draft if the user opens another mid-generation.
  const [draftGenerating, setDraftGenerating] = React.useState(false);
  // The agent-drafted reply, passed to the modal separately from the (empty)
  // draft context so a late arrival fills the body only if untouched — never
  // clobbering what the user typed, and never re-seeding on reopen.
  const [draftSuggestion, setDraftSuggestion] = React.useState('');
  const draftTokenRef = React.useRef(0);
  // The source message of the open draft, so "Pre-draft reply" can generate on demand.
  const draftMessageRef = React.useRef(null);
  // Guards the async briefing synthesis: a late/failed synthesis only swaps in the
  // rich briefing if it is still the current request (not dismissed or superseded).
  const briefingTokenRef = React.useRef(0);
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
    setDraftSuggestion('');
    setDraftGenerating(false);
    // Open the draft empty — pre-drafting is opt-in (the "Pre-draft reply" button),
    // not automatic, so no turn fires unless the user asks. Stash the source message
    // + invalidate any in-flight generation from a prior draft.
    draftMessageRef.current = message;
    draftTokenRef.current += 1;
    setDraftContext(buildReplyDraft({ message, selected: message }));
  }, []);
  // On-demand: draft a reply in the user's voice via a short agent turn. Replaces
  // the body with the result (the user asked for it); '' on failure (never fabricated).
  const generateDraftReply = React.useCallback(() => {
    const message = draftMessageRef.current;
    if (!message) return;
    const token = (draftTokenRef.current += 1);
    setDraftSuggestion('');
    setDraftGenerating(true);
    let timezone;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (_) {
      timezone = undefined;
    }
    generateSuggestedReply({
      message,
      deps: { createThread, sendMessage, fetchTimeline, timezone }
    })
      .then((reply) => {
        if (reply && draftTokenRef.current === token) setDraftSuggestion(reply);
      })
      .finally(() => {
        if (draftTokenRef.current === token) setDraftGenerating(false);
      });
  }, []);
  const closeDraft = React.useCallback(() => {
    draftTokenRef.current += 1;
    setDraftContext(null);
    setDraftResult(null);
    setDraftBusy(false);
    setDraftGenerating(false);
    setDraftSuggestion('');
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
    maxResults: 12
  });
  // The reply-state read: recent sent mail, used only to suppress already-answered
  // threads from triage (selectTriageInbox's reply-state gate). Gated on Gmail.
  const connectorSent = useConnectorSent({ enabled: connectedAccounts.gmailReady });
  // Read a fuller window — the Calendar tab groups these by day. (Calendar is no
  // longer duplicated on the home rail; the Calendar tab owns the schedule.)
  const connectorCalendar = useConnectorCalendar({
    enabled: connectedAccounts.calendarReady,
    maxResults: 25
  });
  // Slack is a first-class rail source (always-visible blocker triage), so the read
  // runs whenever Slack is connected — like Gmail/Calendar/GitHub/Drive/Notion — and
  // the "Slack blockers" rail group populates on cold load. The catch-up briefing
  // still shows "Reading Slack" while that read is in-flight (briefingLoadingSources),
  // exactly as it does for the other eager sources.
  const slackBlockers = useConnectorSlackBlockers({
    enabled: connectedAccounts.slackReady,
    maxResults: 8
  });
  // Slack-first sourcing for the catch-up briefing: read the user's channels deeply
  // and classify into awaiting-reply (you were tagged) vs decision-forming (a thread
  // you're absent from). Eager when Slack is connected — like the blocker search —
  // so the home's Slack-first data is ready by the time a briefing is requested; the
  // result is cached (60s staleTime) and degrades to [] (identity unresolved / read
  // failure), leaving the blocker fallback. Channel fan-out is capped to bound cost.
  const slackDeep = useConnectorSlackDeep({
    enabled: connectedAccounts.slackReady,
    email: WORKBENCH_PROFILE.email,
    channelLimit: 6
  });
  const connectorDrive = useConnectorDrive({ enabled: connectedAccounts.driveReady });
  const connectorNotion = useConnectorNotion({ enabled: connectedAccounts.notionReady });
  const connectorGithub = useConnectorGithub({ enabled: connectedAccounts.githubReady });
  const liveSourceData = React.useMemo(
    () => ({
      inboxMessages: connectorInbox.messages,
      calendarEvents: connectorCalendar.events,
      slackBlockers: slackBlockers.rows,
      githubNotifications: connectorGithub.notifications,
      driveFiles: connectorDrive.files,
      notionPages: connectorNotion.pages
    }),
    [
      connectorInbox.messages,
      connectorCalendar.events,
      slackBlockers.rows,
      connectorGithub.notifications,
      connectorDrive.files,
      connectorNotion.pages
    ]
  );

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
    liveSourceData,
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

  // Per-sender tier corrections from the "You" surface; re-read on mount so a
  // correction made there reorders this rail when you return. Drives reply rank.
  const tierOverrides = React.useMemo(() => readTierOverrides(), []);
  // Rows the user X-ed out with a reason ("Just context", "Already handled", …).
  // They stop being surfaced and the reason is recorded so the profile can learn.
  const [dismissals, setDismissals] = React.useState(() => readDismissals());
  const onDismissDecision = React.useCallback((message, reason) => {
    if (!message) return;
    const key = String(message.messageId || message.id || '');
    if (!key) return;
    setDismissals(dismissRow(key, { reason, sender: message.fromEmail || message.sender || '' }));
  }, []);
  // Triage-worthy inbox = what may be surfaced on the Workbench (Needs-a-decision,
  // Arrived). Drops bulk/newsletters/notes (e.g. gemini-notes meeting summaries),
  // ignore-corrected senders, and rows the user dismissed — mirroring the rail's
  // Needs-a-reply. The raw inbox still feeds the rail + briefing, which filter
  // themselves.
  // The "it learns" set: senders filed ≥2× for sender-level reasons are
  // auto-suppressed from triage going forward (overridable on the You surface).
  const learnedIgnore = React.useMemo(() => learnedIgnoreSenders(dismissals), [dismissals]);
  // Reply-state index: threadId -> latest sent timestamp, so triage can file
  // threads the user already answered (they spoke last).
  const sentThreadIndex = React.useMemo(
    () => answeredThreadIndex(connectorSent.messages),
    [connectorSent.messages]
  );
  const triageInbox = React.useMemo(
    () =>
      selectTriageInbox(connectorInbox.messages, {
        overrides: tierOverrides,
        dismissals,
        learnedIgnore,
        sentThreadIndex
      }),
    [connectorInbox.messages, tierOverrides, dismissals, learnedIgnore, sentThreadIndex]
  );
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
        inbox: { messages: triageInbox },
        calendar: { events: connectorCalendar.events },
        slackBlockers: slackBlockers.rows,
        githubNotifications: connectorGithub.notifications,
        notionPages: connectorNotion.pages,
        driveFiles: connectorDrive.files,
        tierOverrides,
        limit: 4
      }),
    [
      automations,
      approvalsFeedQuery.data,
      receiptsFeedQuery.data,
      workbenchFeedQuery.data,
      connectorCalendar.events,
      triageInbox,
      slackBlockers.rows,
      connectorGithub.notifications,
      connectorNotion.pages,
      connectorDrive.files,
      outletThreadsState?.threads,
      savedItems,
      sourceReadiness,
      threadAttentionDetails,
      threadStates,
      tierOverrides
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
      connectedAccounts.slackReady && (slackBlockers.enabled || slackDeep.enabled),
      slackBlockers.isLoading ||
        slackBlockers.isFetching ||
        slackDeep.isLoading ||
        slackDeep.isFetching,
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
    slackDeep.enabled,
    slackDeep.isLoading,
    slackDeep.isFetching,
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
    // The deterministic briefing renders INSTANTLY and is the fallback: if the
    // synthesis turn fails or times out, this stays on screen — never blank.
    const det = buildBriefing({
      inboxMessages: connectorInbox.messages,
      calendarEvents: connectorCalendar.events,
      railGroups,
      slackBlockers: slackBlockers.rows,
      slackAwaiting: slackDeep.awaiting,
      slackWeighIn: slackDeep.weighIn,
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
      tierOverrides,
      sentThreadIndex,
      now: new Date()
    });
    setBriefing(det);
    setBrief('');
    // Upgrade to the RICH briefing via a tool-free synthesis turn (no tool calls →
    // does not hit the long multi-tool wedge). On success, swap in the five-section
    // brief; on null/failure the deterministic briefing already on screen remains.
    const token = (briefingTokenRef.current += 1);
    let timezone;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (_) {
      timezone = undefined;
    }
    // Lazy-load the synthesis engine so its prompts stay out of the cold bundle.
    import('./lib/workbench-brief-synth.js')
      .then(({ synthesizeBriefing }) =>
        synthesizeBriefing({
          briefing: det,
          profile: WORKBENCH_PROFILE,
          deps: { createThread, sendMessage, fetchTimeline, timezone },
          // Progressive: render the needsYou half (with the deterministic radar) the
          // moment turn A lands, then the final upgrades worthWeighingIn when turn B
          // lands. Both guarded by the token so a stale run can never overwrite a newer.
          onPartial: (partial) => {
            if (briefingTokenRef.current === token) setBriefing({ ...partial, kind: 'rich' });
          }
        })
      )
      .then((rich) => {
        if (rich && briefingTokenRef.current === token) setBriefing({ ...rich, kind: 'rich' });
      })
      .catch(() => {});
  }, [
    connectorInbox.messages,
    connectorCalendar.events,
    railGroups,
    slackBlockers.rows,
    slackBlockers.enabled,
    slackDeep.awaiting,
    slackDeep.weighIn,
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
    tierOverrides,
    sentThreadIndex,
    setError
  ]);
  React.useEffect(() => {
    if (!briefingPending || briefingReadsPending) return;
    runBriefing();
  }, [briefingPending, briefingReadsPending, runBriefing]);

  const dismissBriefing = React.useCallback(() => {
    setBriefingPending(false);
    setBriefingSlackActive(false);
    // Invalidate any in-flight synthesis so a late result can't re-open the brief.
    briefingTokenRef.current += 1;
    setBriefing(null);
  }, []);
  // "Save as draft" from a rich-brief Needs-you item: map it back to its inbox
  // message by id and open the gated draft modal pre-filled with the edited reply.
  const onBriefDraftReply = React.useCallback(
    ({ item, body } = {}) => {
      // Defense-in-depth: a Slack item never reaches the Gmail-draft path (the card
      // shows Reply-in-Slack + Copy-reply for those and never calls this). Slack has
      // no draft API, so there is nothing gated to open here.
      if (item?.source === 'Slack') return;
      const id = String(item?.id || '');
      const message = (connectorInbox.messages || []).find(
        (m) => String(m.id || m.messageId || m.threadId || '') === id
      );
      if (!message) return;
      openDraftReply(message);
      // The modal seeds an empty body; fill it with the (possibly edited) reply via
      // the same suggestedBody path the "Pre-draft reply" button uses.
      setDraftSuggestion(String(body || '').trim());
    },
    [connectorInbox.messages, openDraftReply]
  );

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
          : view === 'calendar'
            ? html`<${React.Suspense}
                fallback=${html`<main className="wb13-main">
                  <div className="wb13-page">
                    <div className="wb13-wrap">
                      <div className="wb13-head"><h1>Your week</h1></div>
                    </div>
                  </div>
                </main>`}
              >
                <${CalendarView}
                  events=${connectorCalendar.events}
                  calendarReady=${connectedAccounts.calendarReady}
                  calendarError=${connectorCalendar.isError}
                  onConnect=${() => setShowSources(true)}
                />
              </${React.Suspense}>`
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
                  onBriefDraftReply=${onBriefDraftReply}
                  slackBlockersActive=${slackBlockersActive}
                  slackBlockers=${slackBlockers}
                  onDismissSlackBlockers=${() => setSlackBlockersActive(false)}
                  onOpenMessage=${openMessage}
                  groups=${railGroups}
                  savedItems=${savedItems}
                  packageTab=${packageTab}
                  onPackageTab=${setPackageTab}
                  connectorFamilies=${connectedAccounts.families}
                  connectorsLoading=${connectedAccounts.isLoading}
                  onConnectSources=${() => setShowSources(true)}
                  gmailReady=${connectedAccounts.gmailReady}
                  decisionMessages=${triageInbox}
                  calendarReady=${connectedAccounts.calendarReady}
                  calendarEvents=${connectorCalendar.events}
                  calendarError=${connectorCalendar.isError}
                  onAttachWorkspaceFile=${(file) => attachmentsState.addFiles([file])}
                  onDraftMessage=${openDraftReply}
                  onDismissDecision=${onDismissDecision}
                />`}
        ${showSources
          ? html`<${WorkbenchSourcesInspector}
              sourceReadiness=${sourceReadiness}
              connectorFamilies=${connectedAccounts.families}
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
          generating=${draftGenerating}
          suggestedBody=${draftSuggestion}
          onGenerate=${generateDraftReply}
          result=${draftResult}
          onCancel=${closeDraft}
          onSubmit=${submitDraft}
        />
        <${WorkbenchCommandPalette}
          open=${paletteOpen}
          onClose=${() => setPaletteOpen(false)}
          commands=${paletteCommands}
          onCompose=${composeFromPalette}
        />
        <${WorkbenchShortcuts} open=${shortcutsOpen} onClose=${() => setShortcutsOpen(false)} />
      </div>
    </div>
  `;
}
