export const WORKBENCH_EFFORT_LEVELS = Object.freeze([
  {
    id: 'standard',
    label: 'Standard',
    draftLabel: 'Standard effort: answer directly, call out uncertainty.'
  },
  {
    id: 'careful',
    label: 'Careful',
    draftLabel: 'Careful effort: inspect sources, compare conflicts, and show assumptions.'
  },
  {
    id: 'background',
    label: 'Background',
    draftLabel: 'Background effort: break the work into steps and report back with drafts.'
  }
]);

export const WORKBENCH_SOURCE_OPTIONS = Object.freeze([
  {
    id: 'email',
    label: 'Email',
    draftLabel: 'Email, if connected'
  },
  {
    id: 'slack',
    label: 'Slack',
    draftLabel: 'Slack, if connected'
  },
  {
    id: 'docs',
    label: 'Docs',
    draftLabel: 'Docs and knowledge apps, if connected'
  },
  {
    id: 'web',
    label: 'Web',
    draftLabel: 'Public web and HTTP checks'
  },
  {
    id: 'local-files',
    label: 'Local files',
    draftLabel: 'Attached or workspace-local files'
  }
]);

export const WORKBENCH_AUTO_SOURCE_SCOPE = Object.freeze({
  id: 'auto',
  label: 'Auto sources',
  draftLabel:
    'Auto sources: use available connected tools, attached files, and local context that fit the request; do not claim disconnected tools are available.'
});

export const WORKBENCH_SOURCE_CAPABILITY_MAP = Object.freeze({
  email: ['gmail'],
  slack: ['slack'],
  docs: ['google-drive', 'notion'],
  web: ['web-http'],
  'local-files': ['workspace']
});

export const WORKBENCH_VISIBLE_SUGGESTIONS = Object.freeze([
  {
    id: 'needs-me',
    label: 'What needs me today?',
    fill: 'Tell me what needs my attention today across the sources you can actually access. Group it by urgency, show why each item matters, and do not take external action.',
    domain: 'executive'
  },
  {
    id: 'changed-while-away',
    label: 'Catch me up',
    fill: 'Summarize what changed since I was last here across available threads, messages, docs, and saved work. Call out blockers, decisions, and useful follow-ups.',
    domain: 'executive'
  },
  {
    id: 'slack-blockers',
    label: 'Find Slack blockers',
    fill: 'Check available Slack context for blockers or unanswered decisions. Summarize the issue, propose a response, and flag anything that needs my approval before posting.',
    domain: 'operations'
  },
  {
    id: 'tee-vendors',
    label: 'Research TEE vendors',
    fill: 'Research privacy-preserving TEE vendors for business use and give me a shortlist with tradeoffs, source links, and open questions.',
    domain: 'research'
  },
  {
    id: 'investor-update',
    label: 'Prepare investor update',
    fill: 'Prepare an investor update draft from available context. Include wins, risks, metrics to confirm, and items that need my review before sharing.',
    domain: 'finance'
  },
  {
    id: 'file-memo',
    label: 'Turn a file into a memo',
    fill: 'Turn the attached or selected file into a clear memo with summary, key decisions, risks, and recommended next actions.',
    domain: 'general'
  },
  {
    id: 'review-send-package',
    label: 'Review a send package',
    fill: 'Review the prepared send package. Show me the exact draft, destination, attachments, risks, and what would need approval before anything leaves IronClaw.',
    domain: 'general'
  },
  {
    id: 'competitor-watch',
    label: 'Watch this weekly',
    fill: 'Set up the shape of a weekly watch on this topic. Tell me what sources you can use, what you would monitor, and what still needs a backed automation before it can run.',
    domain: 'marketing'
  },
  {
    id: 'channel-growth',
    label: 'Grow a channel',
    fill: 'Help me plan a channel-growth workflow. Research the audience, propose content themes, and list any public actions that would require approval before posting or following.',
    domain: 'marketing'
  },
  {
    id: 'interview-brief',
    label: 'Prepare interview brief',
    fill: 'Prepare an interview brief from available calendar, email, docs, and web context. Include candidate or company context, themes to ask about, and risks or gaps.',
    domain: 'people'
  },
  {
    id: 'questionnaire-answers',
    label: 'Draft questionnaire answers',
    fill: 'Draft answers for this questionnaire using available evidence. Cite sources, mark uncertain answers, and hold anything external for my approval.',
    domain: 'security_compliance'
  }
]);

export const WORKBENCH_SCENARIO_COVERAGE = Object.freeze([
  {
    id: 'runway-note',
    domain: 'finance',
    ask: 'Prepare a cash runway note for the board.',
    sourceIds: ['email', 'docs', 'local-files'],
    expectedArtifact: 'brief',
    approvalBoundary: 'Sharing board materials requires explicit approval.'
  },
  {
    id: 'agreement-counter',
    domain: 'legal',
    ask: 'Draft the vendor counter and show the key terms before approval.',
    sourceIds: ['email', 'docs', 'local-files'],
    expectedArtifact: 'review package',
    approvalBoundary: 'Sending external legal communications requires explicit approval.'
  },
  {
    id: 'launch-readiness',
    domain: 'operations',
    ask: 'Make a launch readiness checklist from messages and docs.',
    sourceIds: ['slack', 'docs'],
    expectedArtifact: 'checklist',
    approvalBoundary: 'Posting status updates or changing cadence requires explicit approval.'
  },
  {
    id: 'incident-followup',
    domain: 'engineering',
    ask: 'Prepare an incident follow-up from the discussion and repo context.',
    sourceIds: ['slack', 'local-files'],
    expectedArtifact: 'incident brief',
    approvalBoundary: 'Posting incident updates requires explicit approval.'
  },
  {
    id: 'interview-brief',
    domain: 'people',
    ask: 'Prepare my interview brief for tomorrow.',
    sourceIds: ['email', 'docs'],
    expectedArtifact: 'interview brief',
    approvalBoundary: 'Sending candidate or employee messages requires explicit approval.'
  },
  {
    id: 'account-followups',
    domain: 'sales',
    ask: 'Draft follow-ups for these five accounts.',
    sourceIds: ['email', 'slack', 'web'],
    expectedArtifact: 'reply batch',
    approvalBoundary: 'Sending prospect or customer messages requires explicit approval.'
  },
  {
    id: 'support-escalations',
    domain: 'customer_success',
    ask: 'Prepare escalation replies for unresolved customer threads.',
    sourceIds: ['email', 'slack', 'docs'],
    expectedArtifact: 'reply batch',
    approvalBoundary: 'Sending customer responses requires explicit approval.'
  },
  {
    id: 'competitor-watch',
    domain: 'marketing',
    ask: 'Monitor competitor launches and brief me Friday.',
    sourceIds: ['web', 'docs'],
    expectedArtifact: 'monitor brief',
    approvalBoundary: 'Starting or changing public monitors requires explicit approval.'
  },
  {
    id: 'questionnaire-answers',
    domain: 'security_compliance',
    ask: 'Draft questionnaire answers and show sources before anything leaves.',
    sourceIds: ['email', 'docs', 'web'],
    expectedArtifact: 'evidence-backed draft',
    approvalBoundary: 'Sharing evidence packs requires explicit approval.'
  }
]);

export const WORKBENCH_WIRING_ASSUMPTIONS = Object.freeze([
  {
    id: 'chat-runtime',
    label: 'Chat runtime',
    target: '/chat',
    description: 'Workbench starts work through the existing Chat thread and message runtime.'
  },
  {
    id: 'model-settings',
    label: 'Model settings',
    target: '/settings/inference',
    description:
      'Provider setup remains in Settings; Workbench can apply a selected NEAR AI Cloud model through the active-model route before starting Chat work.'
  },
  {
    id: 'source-setup',
    label: 'Connections',
    target: '/extensions/registry',
    description: 'Source availability remains owned by the existing Connections registry.'
  },
  {
    id: 'saved-work',
    label: 'Work reader',
    target: '/work',
    description: 'Generated artifacts are still saved and reopened through Work.'
  }
]);

function byId(collection, id, fallbackId) {
  return (
    collection.find((item) => item.id === id) ||
    collection.find((item) => item.id === fallbackId) ||
    collection[0]
  );
}

function cleanLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

export function selectedWorkbenchSources(sourceIds = []) {
  const ids = new Set(sourceIds);
  return WORKBENCH_SOURCE_OPTIONS.filter((source) => ids.has(source.id));
}

export function workbenchSuggestionFill(suggestion) {
  return cleanLines(suggestion?.fill || suggestion?.label || '');
}

export function buildWorkbenchChatDraft({
  brief,
  modelId = 'auto',
  modelLabel = '',
  effort = 'standard',
  sourceMode = 'manual',
  sourceIds = [],
  cadence = ''
} = {}) {
  const task = cleanLines(brief);
  if (!task) return '';

  const effortLevel = byId(WORKBENCH_EFFORT_LEVELS, effort, 'standard');
  const model = cleanLines(modelLabel || modelId || 'Active NEAR AI Cloud model');
  const sources = selectedWorkbenchSources(sourceIds);
  const timing = cleanLines(cadence);
  const sourceLine =
    sourceMode === WORKBENCH_AUTO_SOURCE_SCOPE.id
      ? WORKBENCH_AUTO_SOURCE_SCOPE.draftLabel
      : sources.length > 0
        ? sources.map((source) => source.draftLabel).join('; ')
        : 'Only the context already in this chat.';
  const timingLine = timing || 'Not specified; ask only if timing changes the action.';

  return [
    'Workbench request',
    '',
    'Task:',
    task,
    '',
    'Execution preferences:',
    `- Model: ${model}`,
    `- Effort: ${effortLevel.draftLabel}`,
    `- Sources to consider: ${sourceLine}`,
    `- Timing: ${timingLine}`,
    '',
    'Boundaries:',
    '- Use only attached files and available sources/tools already present in IronClaw.',
    '- If a requested source is unavailable, say that plainly and continue with available context.',
    '- Before sending, posting, filing, or changing anything in an external system, show the exact action and wait for approval.',
    '',
    'Output:',
    '- Put drafts, documents, and research notes in the thread so they can be saved to Work.'
  ].join('\n');
}

export function workbenchHasBackendEndpoint() {
  return false;
}
