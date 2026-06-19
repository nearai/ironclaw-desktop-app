import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function sourceForTest() {
  const source = readFileSync(
    new URL('./automation-delivery-defaults-panel.js', import.meta.url),
    'utf8'
  );
  const lines = [];
  for (const line of source.split('\n')) {
    if (line.startsWith('import ')) continue;
    lines.push(
      line.replace(
        'export function AutomationDeliveryDefaultsPanel',
        'function AutomationDeliveryDefaultsPanel'
      )
    );
  }
  return `${lines.join('\n')}\nglobalThis.__testExports = { AutomationDeliveryDefaultsPanel };`;
}

function html(strings, ...values) {
  return { strings: Array.from(strings), values };
}

function depsChanged(previous, next) {
  if (!previous || !next || previous.length !== next.length) return true;
  return next.some((value, index) => !Object.is(value, previous[index]));
}

function textContent(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join(' ');
  if (typeof node === 'object' && Array.isArray(node.strings)) {
    return node.strings
      .map((part, index) => `${part} ${textContent(node.values[index])}`)
      .join(' ');
  }
  return '';
}

function visibleTextContent(node) {
  return textContent(node).replace(/<!--[\s\S]*?-->/g, ' ');
}

function valuesAfter(node, fragment) {
  const values = [];
  const visit = (value) => {
    if (value == null || value === false) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object' && Array.isArray(value.strings)) {
      value.strings.forEach((part, index) => {
        if (part.includes(fragment)) values.push(value.values[index]);
        visit(value.values[index]);
      });
    }
  };
  visit(node);
  return values;
}

function createContext() {
  const state = { hookIndex: 0, values: {}, refs: {}, effectDeps: {}, cleanups: {} };
  const copy = {
    'automations.delivery.eyebrow': 'Delivery defaults',
    'automations.delivery.title': 'Where triggered results are sent',
    'automations.delivery.explainer':
      'Choose the default place for final replies from triggered automations.',
    'automations.delivery.currentDefault': 'Current default',
    'automations.delivery.changeTarget': 'Change target',
    'automations.delivery.availableTargets': 'Available targets',
    'automations.delivery.none': 'None',
    'automations.delivery.webOption': 'Web app only (no external delivery)',
    'automations.delivery.webOptionDesc':
      'Keep replies inside the IronClaw web app until another target is selected.',
    'automations.delivery.unpairedNotice': 'Slack DM — not available',
    'automations.delivery.unpairedDesc':
      'Pair Slack before scheduled replies can be delivered there.',
    'automations.delivery.loadFailedTitle': 'Delivery defaults unavailable',
    'automations.delivery.loadFailedDesc':
      'IronClaw could not confirm delivery targets from the gateway, so it will not assume web-only delivery or save a default.',
    'automations.delivery.retry': 'Retry',
    'automations.delivery.save': 'Save',
    'automations.delivery.clear': 'Clear',
    'automations.delivery.saved': 'Saved',
    'automations.delivery.saveFailed': 'Could not save delivery defaults.',
    'automations.delivery.footnote':
      'External replies still respect approval gates; reply with {command} when a gate asks.',
    'automations.delivery.pill.ready': 'Ready',
    'automations.delivery.pill.unavailable': 'Unavailable',
    'automations.delivery.pill.notSet': 'Not set',
    'automations.delivery.pill.notPaired': 'Not paired',
    'automations.delivery.pill.fallback': 'Fallback'
  };
  const context = {
    Badge: 'Badge',
    Button: 'Button',
    Icon: 'Icon',
    Panel: 'Panel',
    React: {
      useState(initial) {
        const index = state.hookIndex++;
        if (!(index in state.values)) {
          state.values[index] = typeof initial === 'function' ? initial() : initial;
        }
        return [
          state.values[index],
          (next) => {
            state.values[index] = typeof next === 'function' ? next(state.values[index]) : next;
          }
        ];
      },
      useEffect(effect, deps) {
        const index = state.hookIndex++;
        if (depsChanged(state.effectDeps[index], deps)) {
          state.effectDeps[index] = deps;
          const cleanup = effect();
          if (typeof cleanup === 'function') state.cleanups[index] = cleanup;
        }
      },
      useRef(initial) {
        const index = state.hookIndex++;
        if (!(index in state.refs)) state.refs[index] = { current: initial };
        return state.refs[index];
      }
    },
    clearTimeout: () => {},
    setTimeout: () => 1,
    cn: (...parts) => parts.filter(Boolean).join(' '),
    globalThis: {},
    html,
    useT: () => (key) => copy[key] || key
  };
  vm.runInNewContext(sourceForTest(), context);
  return {
    render(props) {
      state.hookIndex = 0;
      return context.globalThis.__testExports.AutomationDeliveryDefaultsPanel(props);
    }
  };
}

test('AutomationDeliveryDefaultsPanel shows an explicit gateway error instead of fallback delivery', () => {
  const { render } = createContext();
  const tree = render({
    deliveryState: {
      currentTarget: null,
      currentStatus: 'none_configured',
      targets: [
        {
          capabilities: { final_replies: true },
          target: { target_id: 'slack:dm', display_name: 'Slack DM', status: 'available' }
        }
      ],
      finalReplyTargets: [
        {
          capabilities: { final_replies: true },
          target: { target_id: 'slack:dm', display_name: 'Slack DM', status: 'available' }
        }
      ],
      isLoading: false,
      isRefreshing: false,
      isSaving: false,
      error: new Error('gateway unavailable'),
      saveError: null,
      refetch: () => {},
      saveFinalReplyTarget: () => Promise.resolve()
    }
  });
  const visible = visibleTextContent(tree);

  assert.match(visible, /Delivery defaults unavailable/);
  assert.match(visible, /could not confirm delivery targets/);
  assert.match(visible, /Retry/);
  assert.doesNotMatch(visible, /Web app only/);
  assert.doesNotMatch(visible, /Slack DM/);
  assert.doesNotMatch(visible, /External replies still respect approval gates/);
  assert.doesNotMatch(visible, /\bSave\b/);
  assert.doesNotMatch(visible, /\bClear\b/);
});

test('AutomationDeliveryDefaultsPanel clears stale saved state before rendering save failures', async () => {
  const { render } = createContext();
  const saveCalls = [];
  let shouldReject = false;
  const deliveryState = {
    currentTarget: null,
    currentStatus: 'none_configured',
    targets: [
      {
        capabilities: { final_replies: true },
        target: { target_id: 'slack:dm', display_name: 'Slack DM', status: 'available' }
      }
    ],
    finalReplyTargets: [
      {
        capabilities: { final_replies: true },
        target: { target_id: 'slack:dm', display_name: 'Slack DM', status: 'available' }
      }
    ],
    isLoading: false,
    isRefreshing: false,
    isSaving: false,
    error: null,
    saveError: null,
    refetch: () => {},
    saveFinalReplyTarget: (targetId) => {
      saveCalls.push(targetId);
      return shouldReject ? Promise.reject(new Error('gateway rejected')) : Promise.resolve();
    }
  };

  let tree = render({ deliveryState });
  valuesAfter(tree, 'onChange=')[0]();
  tree = render({ deliveryState });
  valuesAfter(tree, 'onClick=')[0]();
  await Promise.resolve();

  tree = render({ deliveryState });
  assert.match(visibleTextContent(tree), /\bSaved\b/);

  shouldReject = true;
  valuesAfter(tree, 'onClick=')[0]();
  deliveryState.saveError = new Error('gateway rejected');
  await Promise.resolve();
  tree = render({ deliveryState });
  const visible = visibleTextContent(tree);

  assert.deepEqual(saveCalls, ['slack:dm', 'slack:dm']);
  assert.match(visible, /Could not save delivery defaults/);
  assert.doesNotMatch(visible, /\bSaved\b/);
});
