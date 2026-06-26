import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKBENCH_AUTO_SOURCE_SCOPE,
  WORKBENCH_EFFORT_LEVELS,
  WORKBENCH_SCENARIO_COVERAGE,
  WORKBENCH_SOURCE_CAPABILITY_MAP,
  WORKBENCH_SOURCE_OPTIONS,
  WORKBENCH_VISIBLE_SUGGESTIONS,
  WORKBENCH_WIRING_ASSUMPTIONS,
  buildWorkbenchChatDraft,
  buildWorkbenchLiveSourcePacket,
  buildWorkbenchLiveSourceStatus,
  selectedWorkbenchSources,
  workbenchSuggestionFill,
  workbenchHasBackendEndpoint
} from './workbench-plan.js';
import {
  CORE_CONNECTIONS,
  WORKBENCH_SOURCE_FAMILIES
} from '../../extensions/lib/registry-catalog.js';

test('buildWorkbenchChatDraft packages model, effort, sources, and approval boundaries', () => {
  const draft = buildWorkbenchChatDraft({
    brief: 'Prepare the Friday stakeholder brief from messages and docs.',
    modelId: 'z-ai/glm-4.5',
    modelLabel: 'GLM 4.5 (z-ai/glm-4.5)',
    effort: 'careful',
    sourceIds: ['email', 'docs', 'web']
  });

  assert.match(draft, /^Workbench request/);
  assert.match(draft, /Prepare the Friday stakeholder brief from messages and docs/);
  assert.match(draft, /GLM 4\.5 \(z-ai\/glm-4\.5\)/);
  assert.match(draft, /Careful effort/);
  assert.match(draft, /Email, if connected/);
  assert.match(draft, /Docs and knowledge apps, if connected/);
  assert.match(draft, /Public web and HTTP checks/);
  assert.match(draft, /wait for approval/);
  assert.doesNotMatch(draft, /Slack, if connected/);
});

test('buildWorkbenchChatDraft carries live connected source status without private data', () => {
  const draft = buildWorkbenchChatDraft({
    brief: 'Tell me what needs my attention.',
    sourceMode: WORKBENCH_AUTO_SOURCE_SCOPE.id,
    connectorFamilies: [
      { id: 'gmail', label: 'Gmail', state: 'ready', via: 'Composio' },
      { id: 'slack', label: 'Slack', state: 'ready', via: 'Composio' },
      { id: 'notion', label: 'Notion', state: 'initiated', via: 'Composio' }
    ]
  });

  assert.match(draft, /Live source status:/);
  assert.match(draft, /Gmail ready via Composio \(email reads\)/);
  assert.match(draft, /Slack ready via Composio \(Slack message search\)/);
  assert.doesNotMatch(draft, /Notion ready/);
  assert.doesNotMatch(draft, /api[_ -]?key|secret|bearer|access[_ -]?token/i);
});

test('buildWorkbenchLiveSourceStatus is honest when no live connector account is verified', () => {
  assert.equal(
    buildWorkbenchLiveSourceStatus({
      connectorFamilies: [{ id: 'notion', label: 'Notion', state: 'initiated', via: 'Composio' }]
    }),
    'No live connector accounts were verified on the Workbench surface yet.'
  );
});

test('buildWorkbenchLiveSourcePacket summarizes already-loaded connector rows', () => {
  const packet = buildWorkbenchLiveSourcePacket({
    inboxMessages: [
      {
        sender: 'Avery',
        subject: 'Budget approval',
        unread: true,
        preview: 'Need your signoff before noon.'
      },
      {
        sender: 'Blair',
        subject: 'api_key=sk-test should not leak',
        preview: 'access token: abc123 should also be redacted'
      }
    ],
    calendarEvents: [{ title: 'Partner call', when: 'Mon Jun 22 - 9:00 AM' }],
    githubNotifications: [{ repo: 'near/agent', title: 'Review requested', reason: 'review' }],
    driveFiles: [{ kind: 'Doc', name: 'Q3 plan', when: 'Jun 20' }],
    notionPages: [{ title: 'Launch notes', when: 'Jun 19' }],
    limit: 1
  });

  assert.match(packet, /Gmail rows already loaded:/);
  assert.match(packet, /Gmail: unread - from Avery - Budget approval/);
  assert.match(packet, /Calendar: Partner call - Mon Jun 22 - 9:00 AM/);
  assert.match(packet, /GitHub: near\/agent - Review requested - review/);
  assert.match(packet, /Drive: Doc - Q3 plan - Jun 20/);
  assert.match(packet, /Notion: Launch notes - Jun 19/);
  assert.doesNotMatch(packet, /Blair/);
  assert.doesNotMatch(packet, /sk-test|abc123/);

  const redacted = buildWorkbenchLiveSourcePacket({
    inboxMessages: [
      {
        sender: 'Blair',
        subject: 'api_key=sk-test should not leak',
        preview: 'access token: abc123 should also be redacted'
      }
    ]
  });
  assert.match(redacted, /api_key=\[redacted\]/);
  assert.match(redacted, /access token=\[redacted\]/);
  assert.doesNotMatch(redacted, /sk-test|abc123/);
});

test('buildWorkbenchChatDraft carries bounded live source data into Chat handoff', () => {
  const draft = buildWorkbenchChatDraft({
    brief: 'Use current context to tell me what needs action.',
    sourceMode: WORKBENCH_AUTO_SOURCE_SCOPE.id,
    connectorFamilies: [{ id: 'gmail', label: 'Gmail', state: 'ready', via: 'Composio' }],
    liveSourceData: {
      inboxMessages: [
        {
          sender: 'Avery',
          subject: 'Budget approval',
          unread: true,
          preview: 'Need your signoff before noon.'
        }
      ]
    }
  });

  assert.match(draft, /Live connector rows already loaded in Workbench:/);
  assert.match(draft, /Gmail: unread - from Avery - Budget approval/);
  assert.match(draft, /It may be partial; do not invent missing rows/);
});

test('buildWorkbenchChatDraft packages auto source and cadence preferences without fake scheduling', () => {
  const draft = buildWorkbenchChatDraft({
    brief: 'Watch competitor launches and brief me Friday.',
    modelId: 'gpt-oss-120b',
    modelLabel: 'GPT OSS 120B (gpt-oss-120b)',
    effort: 'background',
    sourceMode: WORKBENCH_AUTO_SOURCE_SCOPE.id,
    cadence: 'Every Friday morning'
  });

  assert.match(draft, /Watch competitor launches and brief me Friday/);
  assert.match(draft, /GPT OSS 120B \(gpt-oss-120b\)/);
  assert.match(draft, /Background effort/);
  assert.match(draft, /Auto sources: use available connected tools/);
  assert.match(draft, /Timing: Every Friday morning/);
  assert.match(draft, /wait for approval/);
  assert.doesNotMatch(draft, /schedule the routine/i);
});

test('buildWorkbenchChatDraft preserves actual selected model id when no label is supplied', () => {
  const draft = buildWorkbenchChatDraft({
    brief: 'Compare vendor options.',
    modelId: 'deepseek-ai/DeepSeek-V4-Flash',
    effort: 'careful',
    sourceIds: ['web']
  });

  assert.match(draft, /Model: deepseek-ai\/DeepSeek-V4-Flash/);
  assert.match(draft, /Careful effort/);
  assert.doesNotMatch(draft, /Deep work/i);
});

test('buildWorkbenchChatDraft refuses empty work instead of opening a hollow route handoff', () => {
  assert.equal(buildWorkbenchChatDraft({ brief: '   ' }), '');
});

test('workbench effort levels stay separate from fake model-mode labels', () => {
  const effortText = WORKBENCH_EFFORT_LEVELS.map((level) => `${level.id} ${level.label}`).join(' ');

  assert.doesNotMatch(effortText, /Deep work/i);
  assert.deepEqual(
    WORKBENCH_EFFORT_LEVELS.map((level) => level.id),
    ['standard', 'careful', 'background']
  );
});

test('workbench source selection ignores unknown ids', () => {
  assert.deepEqual(
    selectedWorkbenchSources(['slack', 'missing', 'local-files']).map((source) => source.id),
    ['slack', 'local-files']
  );
});

test('workbench replacement has explicit wiring assumptions and no fake backend endpoint', () => {
  assert.equal(workbenchHasBackendEndpoint(), false);
  assert.deepEqual(
    WORKBENCH_WIRING_ASSUMPTIONS.map((item) => [item.id, item.target]),
    [
      ['chat-runtime', '/chat'],
      ['model-settings', '/settings/inference'],
      ['source-setup', '/extensions/registry'],
      ['saved-work', '/work']
    ]
  );
});

test('workbench source labels map to currently surfaced connector or builtin capabilities', () => {
  const sourceIds = new Set(WORKBENCH_SOURCE_OPTIONS.map((source) => source.id));
  const catalogIds = new Set(CORE_CONNECTIONS.map((entry) => entry.id));
  const familySurfaceIds = new Set(WORKBENCH_SOURCE_FAMILIES.map((entry) => entry.surfaceId));

  assert.deepEqual(Object.keys(WORKBENCH_SOURCE_CAPABILITY_MAP).sort(), [...sourceIds].sort());

  for (const [sourceId, capabilityIds] of Object.entries(WORKBENCH_SOURCE_CAPABILITY_MAP)) {
    assert.ok(sourceIds.has(sourceId), `${sourceId} should be a visible Workbench source option`);
    assert.ok(capabilityIds.length > 0, `${sourceId} should map to at least one capability`);
    for (const capabilityId of capabilityIds) {
      assert.ok(
        catalogIds.has(capabilityId),
        `${sourceId} maps to missing catalog capability ${capabilityId}`
      );
      assert.ok(
        familySurfaceIds.has(capabilityId),
        `${sourceId} maps to missing Workbench source family ${capabilityId}`
      );
    }
  }
});

test('workbench hidden coverage spans broad domains without rendering a function directory', () => {
  const domains = new Set(WORKBENCH_SCENARIO_COVERAGE.map((scenario) => scenario.domain));
  assert.ok(domains.size >= 5, 'coverage corpus should span at least five hidden domains');

  for (const scenario of WORKBENCH_SCENARIO_COVERAGE) {
    assert.ok(scenario.ask, `${scenario.id} should keep a natural-language ask`);
    assert.ok(scenario.expectedArtifact, `${scenario.id} should name a domain-neutral artifact`);
    assert.ok(
      scenario.approvalBoundary,
      `${scenario.id} should name the approval boundary instead of assuming action`
    );
  }
});

test('visible workbench suggestions are action language and not legal-only examples', () => {
  const labels = WORKBENCH_VISIBLE_SUGGESTIONS.map((suggestion) => suggestion.label);
  const visibleText = labels.join(' ');
  const departmentNames = new Set([
    'Finance',
    'Legal',
    'Operations',
    'Engineering',
    'People',
    'Sales',
    'Marketing',
    'Security',
    'Compliance',
    'Research'
  ]);
  const legalOnlyTerms = /\b(redline|MSA|matter|agreement|amendment|counter|contract|legal)\b/i;

  assert.ok(labels.length >= 4, 'Workbench should render several starter suggestions');
  assert.ok(labels.includes('What needs me today?'));
  assert.ok(labels.includes('Catch me up'));
  assert.ok(labels.includes('Review a send package'));
  assert.ok(labels.includes('Research TEE vendors'));
  assert.ok(labels.includes('Grow a channel'));
  for (const label of labels) {
    assert.equal(departmentNames.has(label.replace(/[.?!]$/, '')), false);
    assert.doesNotMatch(label, /\.$/, `${label} should not read like a checklist item`);
  }
  assert.equal(
    labels.every((label) => legalOnlyTerms.test(label)),
    false,
    'visible suggestions must not collapse to legal/document-only examples'
  );
  assert.equal(
    labels.slice(0, 6).some((label) => legalOnlyTerms.test(label)),
    false,
    'primary visible suggestions must not lead with legal/document-only examples'
  );
});

test('visible workbench suggestions fill complete natural instructions', () => {
  const byId = new Map(
    WORKBENCH_VISIBLE_SUGGESTIONS.map((suggestion) => [suggestion.id, suggestion])
  );
  const tee = byId.get('tee-vendors');
  const slack = byId.get('slack-blockers');
  const watch = byId.get('competitor-watch');

  assert.notEqual(workbenchSuggestionFill(tee), tee.label);
  assert.match(workbenchSuggestionFill(tee), /privacy-preserving TEE vendors/);
  assert.match(workbenchSuggestionFill(tee), /shortlist/);
  assert.match(workbenchSuggestionFill(slack), /approval before posting/);
  assert.match(workbenchSuggestionFill(watch), /backed automation/);

  for (const suggestion of WORKBENCH_VISIBLE_SUGGESTIONS) {
    const fill = workbenchSuggestionFill(suggestion);
    assert.ok(fill.length > suggestion.label.length, `${suggestion.id} should fill a fuller ask`);
    assert.doesNotMatch(fill, /^\s*$/, `${suggestion.id} should have fill text`);
  }
});
