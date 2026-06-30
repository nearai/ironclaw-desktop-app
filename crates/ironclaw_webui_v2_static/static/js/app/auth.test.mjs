import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function authSourceForTest() {
  const source = readFileSync(new URL('./auth.js', import.meta.url), 'utf8');
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
    lines.push(line.replace('export function useAuthSession', 'function useAuthSession'));
  }
  return `${lines.join('\n')}\nglobalThis.__testExports = { useAuthSession };`;
}

function depsChanged(previous, next) {
  if (!previous || !next || previous.length !== next.length) return true;
  return next.some((value, index) => !Object.is(value, previous[index]));
}

function createAuthHarness({ href = 'https://app.test/v2', storedToken = '', exchangeToken } = {}) {
  const scopeEvents = [];
  const storedTokens = [];
  const queryClears = [];
  const clearCalls = [];
  const logoutCalls = [];
  const pendingEffects = [];
  const hooks = [];
  let hookIndex = 0;
  let token = storedToken;
  const location = new URL(href);

  const React = {
    useCallback(fn, deps) {
      const index = hookIndex++;
      const hook = hooks[index];
      if (!hook || depsChanged(hook.deps, deps)) {
        hooks[index] = { deps, value: fn };
      }
      return hooks[index].value;
    },
    useEffect(fn, deps) {
      const index = hookIndex++;
      const hook = hooks[index];
      if (!hook || depsChanged(hook.deps, deps)) {
        hooks[index] = { deps };
        pendingEffects.push(fn);
      }
    },
    useState(initial) {
      const index = hookIndex++;
      if (!hooks[index]) {
        hooks[index] = {
          value: typeof initial === 'function' ? initial() : initial
        };
      }
      const setValue = (next) => {
        hooks[index].value = typeof next === 'function' ? next(hooks[index].value) : next;
      };
      return [hooks[index].value, setValue];
    }
  };

  const context = {
    React,
    URL,
    URLSearchParams,
    clearAllDrafts: () => clearCalls.push('drafts'),
    clearAllPins: () => clearCalls.push('pins'),
    exchangeLoginTicket: async () => exchangeToken || 'exchanged-token',
    globalThis: {},
    logoutRequest: async () => {
      logoutCalls.push(true);
    },
    queryClient: {
      clear: () => queryClears.push(true)
    },
    readStoredToken: () => token,
    scopeFromBearerToken: (value) => (value ? `scope:${value}` : null),
    setAuthScope: (value) => scopeEvents.push(value || null),
    storeToken: (value) => {
      token = value;
      storedTokens.push(value);
    },
    window: {
      history: {
        replaceState: (_state, _title, nextPath) => {
          const nextUrl = new URL(nextPath, location.origin);
          location.pathname = nextUrl.pathname;
          location.search = nextUrl.search;
          location.hash = nextUrl.hash;
        }
      },
      get location() {
        return {
          href: location.href,
          pathname: location.pathname,
          search: location.search,
          hash: location.hash
        };
      }
    }
  };
  vm.runInNewContext(authSourceForTest(), context);

  return {
    clearCalls,
    logoutCalls,
    queryClears,
    scopeEvents,
    storedTokens,
    render() {
      hookIndex = 0;
      pendingEffects.length = 0;
      return context.globalThis.__testExports.useAuthSession();
    },
    async runEffects() {
      const effects = pendingEffects.splice(0);
      for (const effect of effects) effect();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }
  };
}

test('useAuthSession sets private auth scope for stored token, exchange, signIn, and signOut', async () => {
  const stored = createAuthHarness({ storedToken: 'stored-token' });
  let session = stored.render();
  await stored.runEffects();
  assert.equal(session.token, 'stored-token');
  assert.deepEqual(stored.scopeEvents, ['scope:stored-token']);

  const exchanged = createAuthHarness({
    href: 'https://app.test/v2?login_ticket=ticket-1',
    exchangeToken: 'ticket-token'
  });
  session = exchanged.render();
  assert.equal(session.isChecking, true);
  await exchanged.runEffects();
  session = exchanged.render();
  assert.equal(session.token, 'ticket-token');
  assert.deepEqual(exchanged.storedTokens, ['ticket-token']);
  assert.deepEqual(exchanged.scopeEvents, [null, 'scope:ticket-token']);
  assert.equal(exchanged.queryClears.length, 1);

  session.signIn('manual-token');
  session = exchanged.render();
  assert.equal(session.token, 'manual-token');
  assert.deepEqual(exchanged.storedTokens, ['ticket-token', 'manual-token']);
  assert.equal(exchanged.scopeEvents.at(-1), 'scope:manual-token');

  session.signOut();
  session = exchanged.render();
  assert.equal(session.token, '');
  assert.equal(exchanged.scopeEvents.at(-1), null);
  assert.deepEqual(exchanged.clearCalls, ['pins', 'drafts']);
  assert.deepEqual(exchanged.storedTokens, ['ticket-token', 'manual-token', '']);
  assert.equal(exchanged.logoutCalls.length, 1);
});
