const WORKBENCH_SCENES = [
  {
    id: 'packet',
    matcher: /\b(counter|redline|agreement|msa|contract|amendment|terms?)\b/,
    scene: {
      id: 'packet',
      label: 'Review workspace',
      title: 'Review workspace started',
      detail: 'IronClaw is preparing reviewable work. External sends remain gated.'
    },
    actionRows: [
      ['Prepare review workspace', 'Turn the request into a reviewable work item.', 'Private'],
      ['Draft artifacts', 'Keep documents, replies, and notes available for review.', 'Draft'],
      ['Hold external action', 'Any send, post, or filing waits for approval.', 'Approval']
    ],
    outputHint: 'prepared documents, response drafts, and approval details'
  },
  {
    id: 'growth',
    matcher: /\b(grow|channel|twitter|x account|audience|followers?|launch plan)\b/,
    scene: {
      id: 'growth',
      label: 'Growth workspace',
      title: 'Growth workspace started',
      detail: 'IronClaw will research, draft, and hold public actions for approval.'
    },
    actionRows: [
      [
        'Map audience privately',
        'Use available sources to shape the requested audience list.',
        'Private'
      ],
      ['Draft launch plan', 'Prepare positioning, first posts, and cadence for review.', 'Draft'],
      [
        'Hold public actions',
        'Following, posting, and outreach wait for explicit approval.',
        'Approval'
      ]
    ],
    outputHint: 'audience notes, launch drafts, and public-action approvals'
  },
  {
    id: 'monitor',
    matcher: /\b(watch|monitor|recurring|weekly|market|competitor|alert)\b/,
    scene: {
      id: 'monitor',
      label: 'Monitor',
      title: 'Monitor started',
      detail: 'Recurring delivery is staged as work that asks before anything leaves.'
    },
    actionRows: [
      ['Use timing guidance', 'Pass the requested cadence to the live thread.', 'Private'],
      ['Prepare brief', 'Draft source-linked changes with confidence and uncertainty.', 'Draft'],
      [
        'Ask before delivery',
        'Recurring work does not email, post, or change anything on its own.',
        'Approval'
      ]
    ],
    outputHint: 'source changes, private briefs, and delivery approvals'
  },
  {
    id: 'investor',
    matcher: /\b(investor|board|update|runway|finance|stakeholder)\b/,
    scene: {
      id: 'investor',
      label: 'Briefing workspace',
      title: 'Briefing workspace started',
      detail: 'IronClaw is preparing a private brief before anything is shared.'
    },
    actionRows: [
      [
        'Gather inputs',
        'Use available messages, files, and notes to assemble the brief.',
        'Private'
      ],
      ['Draft briefing', 'Shape the update into reviewable work before anything leaves.', 'Draft'],
      ['Hold send package', 'Sending to recipients requires a real approval gate.', 'Approval']
    ],
    outputHint: 'brief drafts, source gaps, and send-package approvals'
  },
  {
    id: 'research',
    matcher: /\b(research|vendors?|compare|deep dive|memo|brief)\b/,
    scene: {
      id: 'research',
      label: 'Research workspace',
      title: 'Research workspace started',
      detail: 'Sources, notes, and drafts should come back as reviewable work.'
    },
    actionRows: [
      ['Collect sources', 'Use available sources and local files that fit the request.', 'Private'],
      [
        'Flag uncertainty',
        'Call out missing evidence before presenting a recommendation.',
        'Draft'
      ],
      ['Hold sharing', 'Sharing a recommendation waits for approval.', 'Approval']
    ],
    outputHint: 'source notes, comparisons, and recommendation drafts'
  }
];

const FALLBACK_WORKBENCH_SCENE = {
  id: 'general',
  scene: {
    id: 'general',
    label: 'Work session',
    title: 'Work session started',
    detail: 'IronClaw is working through the Chat runtime and will keep approval boundaries intact.'
  },
  actionRows: [
    ['Start work', 'The request is queued in the existing Chat runtime.', 'Private'],
    ['Keep boundaries', 'External effects remain held until an approval gate exists.', 'Approval'],
    ['Save output', 'Drafts and artifacts can be saved back to Work.', 'Draft']
  ],
  outputHint: 'drafts, documents, research notes, and decisions'
};

function sceneEntry(sceneId) {
  return WORKBENCH_SCENES.find((scene) => scene.id === sceneId) || FALLBACK_WORKBENCH_SCENE;
}

function copyRows(rows) {
  return rows.map((row) => [...row]);
}

export function inferWorkbenchScene(brief) {
  const text = String(brief || '').toLowerCase();
  const entry = WORKBENCH_SCENES.find((scene) => scene.matcher.test(text));
  return { ...(entry || FALLBACK_WORKBENCH_SCENE).scene };
}

export function commandActionLabel(brief) {
  const text = String(brief || '').trim();
  if (!text) return 'Ask';
  switch (inferWorkbenchScene(text).id) {
    case 'packet':
      return 'Review';
    case 'growth':
      return 'Plan';
    case 'monitor':
      return 'Watch';
    case 'investor':
      return 'Prepare';
    case 'research':
      return 'Research';
    default:
      return 'Ask';
  }
}

export function actionRows(sceneId) {
  return copyRows(sceneEntry(sceneId).actionRows);
}

export function outputHint(sceneId) {
  return sceneEntry(sceneId).outputHint;
}
