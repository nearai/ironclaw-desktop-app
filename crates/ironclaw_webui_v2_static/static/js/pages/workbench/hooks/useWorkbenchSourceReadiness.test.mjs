import assert from 'node:assert/strict';
import test from 'node:test';

import {
  availableWorkbenchSourceEntries,
  deriveWorkbenchSourceReadiness,
  genericWorkbenchMcpReadiness
} from './useWorkbenchSourceReadiness.js';

test('workbench source entries flatten registry groups in page order', () => {
  const tool = { id: 'tool' };
  const channel = { id: 'channel' };
  const mcp = { id: 'mcp' };

  assert.deepEqual(
    availableWorkbenchSourceEntries({
      toolRegistry: [tool],
      channelRegistry: [channel],
      mcpRegistry: [mcp]
    }),
    [tool, channel, mcp]
  );
});

test('workbench source readiness preserves catalog unavailable and gateway offline states', () => {
  const catalogUnavailable = sourcesById(
    deriveWorkbenchSourceReadiness({
      availableSourceEntries: [],
      extensions: [],
      isLoading: false,
      loadError: null
    })
  );
  assert.equal(catalogUnavailable.gmail.statusLabel, 'Catalog unavailable');
  assert.equal(
    catalogUnavailable.gmail.body,
    'Gmail cannot be connected until the app catalog responds.'
  );
  assert.equal(catalogUnavailable.web.statusLabel, 'Available');

  const gatewayOffline = sourcesById(
    deriveWorkbenchSourceReadiness({
      availableSourceEntries: [],
      extensions: [],
      isLoading: false,
      loadError: new Error('offline')
    })
  );
  assert.equal(gatewayOffline.gmail.statusLabel, 'Gateway offline');
  assert.equal(
    gatewayOffline.gmail.body,
    'Gmail setup cannot start until the local gateway responds.'
  );
});

test('workbench source readiness keeps available entries and installed extensions active', () => {
  const available = sourcesById(
    deriveWorkbenchSourceReadiness({
      availableSourceEntries: [{ id: 'gmail', package_ref: { id: 'tools/gmail' } }],
      extensions: [],
      isLoading: false,
      loadError: null
    })
  );
  assert.equal(available.gmail.statusLabel, 'Available');

  const installed = sourcesById(
    deriveWorkbenchSourceReadiness({
      availableSourceEntries: [],
      extensions: [{ id: 'slack', package_ref: { id: 'channels/slack' }, active: true }],
      isLoading: false,
      loadError: null
    })
  );
  assert.equal(installed.slack.statusLabel, 'Ready');
  assert.equal(
    installed.slack.body,
    'Slack is ready for channel summaries, prepared replies, and urgent asks.'
  );

  const installedNeedsSetup = sourcesById(
    deriveWorkbenchSourceReadiness({
      availableSourceEntries: [],
      extensions: [{ id: 'gmail', package_ref: { id: 'gmail' }, kind: 'first_party' }],
      isLoading: false,
      loadError: null
    })
  );
  assert.equal(installedNeedsSetup.gmail.statusLabel, 'Blocked by setup');
  assert.equal(
    installedNeedsSetup.gmail.body,
    'Gmail setup or activation must finish before work can use it.'
  );
});

test('workbench source readiness exposes active generic MCP routers without overclaiming app access', () => {
  const generic = genericWorkbenchMcpReadiness([
    {
      kind: 'mcp_server',
      display_name: 'Composio',
      package_ref: { id: 'custom-mcp' },
      active: true
    },
    {
      kind: 'mcp_server',
      display_name: 'NEAR AI',
      package_ref: { id: 'nearai' },
      active: true
    }
  ]);

  assert.equal(generic.length, 1);
  assert.equal(generic[0].id, 'mcp-custom-mcp');
  assert.equal(generic[0].displayName, 'Composio');
  assert.equal(generic[0].statusLabel, 'Ready');
  assert.match(generic[0].body, /app-specific access is checked at run time/);
});

function sourcesById(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}
