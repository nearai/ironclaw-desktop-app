// Pure helpers for the Direction-B "Triage" cockpit (the HomeView header + filter
// pills). Kept here, free of browser/React deps, so the count + filter logic is unit-
// testable — the blank-center bugs are exactly what these predicates must prevent.

// The cockpit filter pills, in order. 'all' renders every center section (the exact
// pre-cockpit behaviour); the rest narrow the center to one kind of attention.
export const CENTER_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'replies', label: 'Replies' },
  { id: 'blocked', label: 'Blocked' }
];

function groupTotalOf(groups, id) {
  const g = (Array.isArray(groups) ? groups : []).find((x) => x && x.id === id);
  if (!g) return 0;
  return Number.isFinite(g.total) ? g.total : Array.isArray(g.rows) ? g.rows.length : 0;
}

function groupRowsOf(groups, id) {
  const g = (Array.isArray(groups) ? groups : []).find((x) => x && x.id === id);
  return g && Array.isArray(g.rows) ? g.rows.length : 0;
}

// The header counts. needYou = items genuinely awaiting the user (unread decisions +
// approvals + blocked triage + Slack blockers WHEN the blocker search is active, so the
// count agrees with the Blocked pill). handled = completed receipts. The counts are the
// true totals (a group may render only its first few rows).
export function workbenchTriageCounts({
  gmailReady = false,
  decisionMessages = [],
  groups = [],
  slackBlockersActive = false,
  slackBlockerRows = 0,
  slackAwaitingRows = 0
} = {}) {
  const msgs = Array.isArray(decisionMessages) ? decisionMessages : [];
  const unreadDecisions = gmailReady ? msgs.filter((m) => m && m.unread).length : 0;
  const needYou =
    unreadDecisions +
    groupTotalOf(groups, 'needs-approval') +
    groupTotalOf(groups, 'blocked') +
    (slackBlockersActive ? slackBlockerRows : 0) +
    Math.max(0, Number(slackAwaitingRows) || 0);
  const handled = groupTotalOf(groups, 'receipts');
  return { unreadDecisions, needYou, handled };
}

// Will the given non-'all' filter actually render anything? This MUST mirror exactly
// what each section renders, or a pill shows a blank center with no "Show all" note:
//  - replies: WorkbenchDecisions renders only UNREAD messages (not all triage inbox);
//  - blocked: WorkbenchSlackBlockers renders only when the blocker search is ACTIVE.
export function centerFilterHasContent(
  filter,
  {
    gmailReady = false,
    decisionMessages = [],
    groups = [],
    slackBlockersActive = false,
    slackBlockerRows = 0,
    slackAwaitingRows = 0
  } = {}
) {
  if (filter === 'all') return true;
  const msgs = Array.isArray(decisionMessages) ? decisionMessages : [];
  if (filter === 'decisions') return groupRowsOf(groups, 'needs-approval') > 0;
  if (filter === 'replies')
    return (gmailReady && msgs.some((m) => m && m.unread)) || Number(slackAwaitingRows) > 0;
  if (filter === 'blocked') {
    return groupRowsOf(groups, 'blocked') > 0 || (slackBlockersActive && slackBlockerRows > 0);
  }
  return true;
}

// The triage status-group filter for a given cockpit filter (null = all groups).
export function triageStatusFilterFor(filter) {
  if (filter === 'decisions') return ['needs-approval'];
  if (filter === 'blocked') return ['blocked'];
  return null;
}
