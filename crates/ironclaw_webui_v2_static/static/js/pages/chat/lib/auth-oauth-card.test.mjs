import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const COPY = {
  'authGate.cancel': 'Cancel',
  'authGate.oauthProviderFallback': 'the provider',
  'authGate.oauthTitle': 'Authorization required',
  'authGate.oauthWaiting': 'Waiting for authorization to complete...',
  'authGate.openAuthorization': 'Open {provider} authorization',
  'authGate.pillAuthorize': 'Authorize',
  'authGate.reopenAuthorization': 'Re-open {provider} authorization',
  'authGate.serviceUnavailable': 'Service unavailable'
};

function authOauthCardSourceForTest() {
  const source = readFileSync(new URL('../components/auth-oauth-card.js', import.meta.url), 'utf8');
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
    lines.push(line.replace('export function AuthOauthCard', 'function AuthOauthCard'));
  }
  return `${lines.join('\n')}\nglobalThis.__testExports = { AuthOauthCard };`;
}

function depsChanged(previous, next) {
  if (!previous || !next || previous.length !== next.length) return true;
  return next.some((value, index) => !Object.is(value, previous[index]));
}

function collectScalars(node) {
  const scalars = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        scalars.push(value);
      }
      return;
    }
    if (Array.isArray(value.values)) {
      for (const child of value.values) visit(child);
    }
  };
  visit(node);
  return scalars;
}

function componentProps(rendered, component, allComponents) {
  const props = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object' || !Array.isArray(node.values)) return;
    for (let index = 0; index < node.values.length; index += 1) {
      if (node.values[index] !== component) continue;
      const current = {};
      for (let propIndex = index + 1; propIndex < node.values.length; propIndex += 1) {
        if (allComponents.has(node.values[propIndex])) break;
        const name = node.strings[propIndex]?.match(/([A-Za-z][A-Za-z0-9-]*)=\s*$/)?.[1];
        if (name) current[name] = node.values[propIndex];
      }
      props.push(current);
    }
    for (const value of node.values) visit(value);
  };
  visit(rendered);
  return props;
}

function createHarness() {
  let cursor = 0;
  const hooks = [];
  const opened = [];

  function AuthGateShell() {}
  function Button() {}
  function Icon() {}

  const React = {
    useCallback(fn) {
      return fn;
    },
    useEffect(fn, deps) {
      const index = cursor++;
      const hook = hooks[index];
      if (!hook || depsChanged(hook.deps, deps)) {
        hooks[index] = { deps };
        fn();
      }
    },
    useMemo(fn, deps) {
      const index = cursor++;
      const hook = hooks[index];
      if (!hook || depsChanged(hook.deps, deps)) {
        hooks[index] = { deps, value: fn() };
      }
      return hooks[index].value;
    },
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [
        hooks[index].value,
        (next) => {
          hooks[index].value = typeof next === 'function' ? next(hooks[index].value) : next;
        }
      ];
    }
  };

  const context = {
    AuthGateShell,
    Button,
    Icon,
    React,
    URL,
    globalThis: {},
    html: (strings, ...values) => ({ strings: Array.from(strings), values }),
    openExternalUrl: (url) => opened.push(url),
    useT: () => (key, values = {}) => {
      let value = COPY[key] || key;
      for (const [name, replacement] of Object.entries(values)) {
        value = value.replace(`{${name}}`, replacement);
      }
      return value;
    }
  };
  vm.runInNewContext(authOauthCardSourceForTest(), context);
  const allComponents = new Set([AuthGateShell, Button, Icon]);

  return {
    Button,
    opened,
    props(rendered, component) {
      return componentProps(rendered, component, allComponents);
    },
    render(gate) {
      cursor = 0;
      return context.globalThis.__testExports.AuthOauthCard({ gate, onCancel: () => {} });
    }
  };
}

test('AuthOauthCard keeps missing OAuth URLs actionable and shows unavailable copy', () => {
  const harness = createHarness();
  const gate = {
    authorizationUrl: null,
    gateRef: 'gate-auth',
    provider: 'google',
    runId: 'run-auth'
  };
  let rendered = harness.render(gate);
  let buttons = harness.props(rendered, harness.Button);

  assert.equal(buttons[0].disabled, undefined);
  buttons[0].onClick({ preventDefault() {} });
  assert.deepEqual(harness.opened, []);

  rendered = harness.render(gate);
  assert.ok(collectScalars(rendered).includes('Service unavailable'));
});

test('AuthOauthCard opens valid HTTPS URLs through the desktop external opener', () => {
  const harness = createHarness();
  const gate = {
    authorizationUrl: 'https://accounts.example.test/auth',
    gateRef: 'gate-auth',
    provider: 'google',
    runId: 'run-auth'
  };
  let rendered = harness.render(gate);
  let buttons = harness.props(rendered, harness.Button);

  assert.equal(buttons[0].href, 'https://accounts.example.test/auth');
  buttons[0].onClick({ preventDefault() {} });
  assert.deepEqual(harness.opened, ['https://accounts.example.test/auth']);

  rendered = harness.render(gate);
  assert.ok(collectScalars(rendered).includes('Waiting for authorization to complete...'));
});
