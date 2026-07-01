import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function sourceForTest() {
  const source = readFileSync(new URL('./inference-tab.js', import.meta.url), 'utf8');
  const lines = [];
  let skippingImport = false;
  for (const line of source.split('\n')) {
    if (!skippingImport && line.startsWith('import ')) {
      skippingImport = !line.trimEnd().endsWith(';');
      continue;
    }
    if (skippingImport) {
      skippingImport = !line.trimEnd().endsWith(';');
      continue;
    }
    lines.push(line.replace(/^export function /, 'function '));
  }
  return `${lines.join('\n')}\nglobalThis.__testExports = { InferenceTab, ModelSourceChip };`;
}

function html(strings, ...values) {
  return { strings: Array.from(strings), values };
}

function visit(node, fn) {
  if (Array.isArray(node)) {
    for (const item of node) visit(item, fn);
    return;
  }
  if (!node || typeof node !== 'object') return;
  fn(node);
  if (Array.isArray(node.values)) {
    for (const value of node.values) visit(value, fn);
  }
}

function includesComponent(root, component) {
  let found = false;
  visit(root, (node) => {
    if (Array.isArray(node.values) && node.values.includes(component)) found = true;
  });
  return found;
}

function collectScalars(root) {
  const scalars = [];
  visit(root, (node) => {
    if (!Array.isArray(node.values)) return;
    for (const value of node.values) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        scalars.push(value);
      }
    }
  });
  return scalars;
}

function collectTemplateText(root) {
  const text = [];
  visit(root, (node) => {
    if (Array.isArray(node.strings)) text.push(...node.strings);
  });
  return text.join('');
}

function renderInferenceTab({ searchQuery = '' } = {}) {
  const ProviderManagement = 'ProviderManagement';
  const context = {
    Badge: 'Badge',
    Button: 'Button',
    Card: 'Card',
    GoogleOauthCard: 'GoogleOauthCard',
    INFERENCE_FIELDS: [],
    ProviderLoginStatus: 'ProviderLoginStatus',
    ProviderManagement,
    useProviderLogin: () => ({
      nearaiBusy: false,
      nearaiError: '',
      startNearai: () => {},
      startNearaiWallet: () => {}
    }),
    React: {
      useEffect: () => {},
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}]
    },
    SettingsGroup: 'SettingsGroup',
    SettingsSearchEmpty: 'SettingsSearchEmpty',
    filterSettingsSections: () => [],
    globalThis: {},
    html,
    matchesSearch: (query, values) => {
      if (!query) return true;
      const needle = String(query).toLowerCase();
      return values.some((value) => String(value).toLowerCase().includes(needle));
    },
    modelExecutionReadiness: () => ({
      description: 'Gateway has not verified execution yet.',
      label: 'Verification pending',
      tone: 'warning'
    }),
    useT: () => (key) => key
  };

  vm.runInNewContext(sourceForTest(), context);
  const rendered = context.globalThis.__testExports.InferenceTab({
    settings: {},
    gatewayStatus: {},
    onSave: () => {},
    savedKeys: {},
    isLoading: false,
    searchQuery
  });
  return {
    rendered,
    ProviderManagement,
    ModelSourceChip: context.globalThis.__testExports.ModelSourceChip
  };
}

test('InferenceTab leads with a single Model Source Chip and demotes multi-provider to Advanced', () => {
  const { rendered, ProviderManagement, ModelSourceChip } = renderInferenceTab();
  const templateText = collectTemplateText(rendered);

  // The multi-provider taxonomy stays reachable but only behind the native
  // "Advanced · custom provider" disclosure — never a peer of the connect chip.
  assert.equal(includesComponent(rendered, ProviderManagement), true);
  assert.ok(templateText.includes('Advanced · custom provider'));

  // Disclosure is a native <details>, not an aria-driven gate, and never uses a
  // "Hide" affordance on this surface.
  assert.equal(templateText.includes('aria-expanded='), false);
  assert.equal(templateText.includes('Hide'), false);

  // The provider summary now renders through the single ModelSourceChip rather
  // than a bespoke inline Connect card with a duplicated Google/GitHub bank.
  let sawChip = false;
  visit(rendered, (node) => {
    if (Array.isArray(node.values) && node.values.some((v) => v === ModelSourceChip))
      sawChip = true;
  });
  assert.equal(sawChip, true);
  assert.equal(templateText.includes('Continue with Google'), false);
  assert.equal(templateText.includes('Continue with GitHub'), false);
});

test('English AI setup copy avoids generic provider jargon', () => {
  const source = readFileSync(new URL('../../../i18n/en.js', import.meta.url), 'utf8');

  assert.match(source, /'inference\.provider': 'AI runtime'/);
  assert.match(source, /'inference\.backend': 'Model access'/);
  assert.match(source, /'inference\.model': 'Active model'/);
  assert.doesNotMatch(source, /'inference\.provider': 'Model path'/);
  assert.doesNotMatch(source, /'inference\.backend': 'Backend'/);
});

test('InferenceTab opens provider management when settings search targets it', () => {
  const { rendered, ProviderManagement } = renderInferenceTab({ searchQuery: 'near ai cloud' });

  assert.equal(includesComponent(rendered, ProviderManagement), true);
});
