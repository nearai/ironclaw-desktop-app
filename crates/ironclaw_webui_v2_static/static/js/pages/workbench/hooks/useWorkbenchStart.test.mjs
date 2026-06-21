import assert from 'node:assert/strict';
import test from 'node:test';

import { WORKBENCH_AUTO_SOURCE_SCOPE } from '../lib/workbench-plan.js';
import {
  connectorFamiliesToSourceReadiness,
  defaultWorkbenchModelId,
  deriveWorkbenchModelOptions,
  manualSourceBlockReason,
  modelCatalogBlockReason,
  modelOptionLabel,
  startedWorkPreferences,
  workbenchModelSwitchErrorMessage
} from './useWorkbenchStart.js';

test('workbench model options come only from the real model catalog', () => {
  assert.deepEqual(
    deriveWorkbenchModelOptions([
      'z-ai/glm-4.5',
      { id: 'z-ai/glm-4.5' },
      { model: 'gpt-oss-120b' },
      '',
      null
    ]),
    ['z-ai/glm-4.5', 'gpt-oss-120b']
  );

  assert.deepEqual(deriveWorkbenchModelOptions(['auto', 'google/gemini-2.5-pro']), [
    'auto',
    'google/gemini-2.5-pro'
  ]);
});

test('workbench model default selection prefers catalog-backed values', () => {
  assert.equal(defaultWorkbenchModelId('gpt-oss-120b', ['auto', 'gpt-oss-120b']), 'gpt-oss-120b');
  assert.equal(
    defaultWorkbenchModelId('missing-active-model', ['z-ai/glm-4.5', 'gpt-oss-120b']),
    'z-ai/glm-4.5'
  );
  assert.equal(defaultWorkbenchModelId('missing-active-model', []), 'missing-active-model');
});

test('workbench blocks starts when an active listable provider cannot verify its model catalog', () => {
  assert.equal(
    modelCatalogBlockReason({
      activeProvider: { id: 'nearai', name: 'NEAR AI Cloud', can_list_models: true },
      modelsResult: { ok: false, models: [] }
    }),
    'NEAR AI Cloud model access is not available right now. Open Settings / Inference to refresh provider access before starting work.'
  );

  assert.equal(
    modelCatalogBlockReason({
      activeProvider: { id: 'openrouter', name: 'OpenRouter', can_list_models: false },
      modelsResult: { ok: false, models: [] }
    }),
    ''
  );

  assert.equal(
    modelCatalogBlockReason({
      activeProvider: { id: 'nearai', name: 'NEAR AI Cloud', can_list_models: true },
      modelsLoading: true
    }),
    ''
  );
});

test('workbench model labels and preferences preserve selected catalog model ids', () => {
  assert.equal(modelOptionLabel('z-ai/glm-4.5'), 'GLM 4.5 (z-ai/glm-4.5)');

  assert.deepEqual(
    startedWorkPreferences({
      modelId: 'gpt-oss-120b',
      effort: 'background',
      sourceMode: WORKBENCH_AUTO_SOURCE_SCOPE.id,
      sourceIds: ['slack'],
      cadence: 'Friday morning'
    }),
    {
      model: 'GPT OSS 120B (gpt-oss-120b)',
      effort: 'Background',
      sources: WORKBENCH_AUTO_SOURCE_SCOPE.label,
      timing: 'Friday morning'
    }
  );
});

test('workbench model switch failure message keeps Chat start blocked and draft-saved copy', () => {
  assert.equal(
    workbenchModelSwitchErrorMessage(
      new Error('selected model unavailable'),
      'GPT OSS 120B (gpt-oss-120b)'
    ),
    'Could not switch to GPT OSS 120B (gpt-oss-120b). Chat was not started. Your draft is saved here. selected model unavailable'
  );
});

test('manual source selection blocks unavailable connectors instead of pretending they work', () => {
  assert.equal(
    manualSourceBlockReason({
      sourceMode: WORKBENCH_AUTO_SOURCE_SCOPE.id,
      sourceIds: ['slack'],
      sourceReadiness: []
    }),
    ''
  );

  assert.equal(
    manualSourceBlockReason({
      sourceMode: 'manual',
      sourceIds: ['slack'],
      sourceReadiness: [
        {
          id: 'slack',
          state: 'available',
          statusLabel: 'Available',
          iconSource: { id: 'slack' }
        }
      ]
    }),
    "Slack is not connected yet. Open What's allowed to connect it, or switch to Auto sources."
  );

  assert.equal(
    manualSourceBlockReason({
      sourceMode: 'manual',
      sourceIds: ['docs'],
      sourceReadiness: [
        {
          id: 'drive',
          state: 'ready',
          statusLabel: 'Ready',
          iconSource: { id: 'google-drive' }
        }
      ]
    }),
    ''
  );
});

test('manual source selection honors active connector families from Composio', () => {
  const connectorFamilies = [
    { id: 'gmail', label: 'Gmail', state: 'ready', statusLabel: 'Ready', via: 'Composio' },
    { id: 'drive', label: 'Drive', state: 'ready', statusLabel: 'Ready', via: 'Composio' },
    { id: 'slack', label: 'Slack', state: 'ready', statusLabel: 'Ready', via: 'Composio' },
    { id: 'notion', label: 'Notion', state: 'initiated', statusLabel: 'Setup needed' }
  ];

  assert.deepEqual(connectorFamiliesToSourceReadiness(connectorFamilies), [
    {
      id: 'gmail',
      state: 'ready',
      statusLabel: 'Ready',
      displayName: 'Gmail',
      category: 'Connector via Composio',
      iconSource: { id: 'gmail' }
    },
    {
      id: 'google-drive',
      state: 'ready',
      statusLabel: 'Ready',
      displayName: 'Drive',
      category: 'Connector via Composio',
      iconSource: { id: 'google-drive' }
    },
    {
      id: 'slack',
      state: 'ready',
      statusLabel: 'Ready',
      displayName: 'Slack',
      category: 'Connector via Composio',
      iconSource: { id: 'slack' }
    }
  ]);

  assert.equal(
    manualSourceBlockReason({
      sourceMode: 'manual',
      sourceIds: ['email'],
      sourceReadiness: [],
      connectorFamilies
    }),
    ''
  );
  assert.equal(
    manualSourceBlockReason({
      sourceMode: 'manual',
      sourceIds: ['slack'],
      sourceReadiness: [],
      connectorFamilies
    }),
    ''
  );
  assert.equal(
    manualSourceBlockReason({
      sourceMode: 'manual',
      sourceIds: ['docs'],
      sourceReadiness: [],
      connectorFamilies
    }),
    ''
  );
});
