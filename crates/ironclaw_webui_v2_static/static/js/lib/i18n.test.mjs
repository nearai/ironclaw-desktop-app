import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadI18n() {
  let source = readFileSync(new URL('./i18n.js', import.meta.url), 'utf8');
  source = source
    .split('\n')
    .filter((line) => !line.startsWith('import '))
    .join('\n');
  source = source.replaceAll('() => import(', '() => __dynamicImport(');
  source = source.replaceAll('export function ', 'function ');
  source = source.replaceAll('export const ', 'const ');
  source +=
    '\nglobalThis.__testExports = { ensurePack, registerPack, packs, loaders, I18nProvider };';

  const setItemCalls = [];
  const stateSetters = [];
  let stateIndex = 0;

  const context = {
    __dynamicImport: () => {
      throw new Error('locale loader was not overridden in this test');
    },
    Promise,
    React: {
      createContext: (value) => ({ Provider: function Provider() {}, _default: value }),
      useState: (initial) => {
        const index = stateIndex++;
        let value = typeof initial === 'function' ? initial() : initial;
        return [
          value,
          (next) => {
            value = typeof next === 'function' ? next(value) : next;
            stateSetters.push({ index, value });
          }
        ];
      },
      useRef: (initial) => ({ current: initial }),
      useCallback: (fn) => fn,
      useEffect: () => {},
      useMemo: (fn) => fn()
    },
    html: (strings, ...values) => ({ strings: Array.from(strings), values }),
    localStorage: {
      getItem: () => null,
      setItem: (key, value) => setItemCalls.push({ key, value })
    },
    navigator: { language: 'en' },
    document: { documentElement: {} },
    globalThis: {}
  };

  vm.runInNewContext(source, context);
  return { ...context.globalThis.__testExports, setItemCalls, stateSetters };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('ensurePack: unknown locale resolves null', async () => {
  const { ensurePack } = loadI18n();
  assert.equal(await ensurePack('zz-unknown'), null);
});

test('ensurePack: a known locale resolves and populates its pack', async () => {
  const { ensurePack, registerPack, loaders, packs } = loadI18n();
  loaders.es = () => {
    registerPack('es', { greet: 'hola' });
    return Promise.resolve();
  };
  assert.deepEqual(await ensurePack('es'), { greet: 'hola' });
  assert.deepEqual(packs.es, { greet: 'hola' });
});

test('ensurePack: an already-registered pack resolves without invoking the loader', async () => {
  const { ensurePack, registerPack, loaders } = loadI18n();
  registerPack('es', { greet: 'hola' });
  let calls = 0;
  loaders.es = () => {
    calls += 1;
    return Promise.resolve();
  };
  assert.deepEqual(await ensurePack('es'), { greet: 'hola' });
  assert.equal(calls, 0);
});

test('ensurePack: concurrent calls fire the import exactly once', async () => {
  const { ensurePack, registerPack, loaders } = loadI18n();
  let calls = 0;
  loaders.es = () => {
    calls += 1;
    registerPack('es', { greet: 'hola' });
    return Promise.resolve();
  };
  const [a, b] = await Promise.all([ensurePack('es'), ensurePack('es')]);
  assert.equal(calls, 1);
  assert.deepEqual(a, { greet: 'hola' });
  assert.deepEqual(b, { greet: 'hola' });
});

test('ensurePack: a failed import resolves null, never rejects, and is retryable', async () => {
  const { ensurePack, registerPack, loaders } = loadI18n();
  let calls = 0;
  loaders.es = () => {
    calls += 1;
    return Promise.reject(new Error('network'));
  };
  assert.equal(await ensurePack('es'), null);

  loaders.es = () => {
    calls += 1;
    registerPack('es', { greet: 'hola' });
    return Promise.resolve();
  };
  assert.deepEqual(await ensurePack('es'), { greet: 'hola' });
  assert.equal(calls, 2);
});

test('setLang: a stale pack load resolving last does not clobber the newer language', async () => {
  const { I18nProvider, registerPack, loaders, setItemCalls } = loadI18n();

  const defer = () => {
    let resolve;
    const promise = new Promise((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };
  const esLoad = defer();
  const frLoad = defer();
  loaders.es = () => {
    registerPack('es', { greet: 'hola' });
    return esLoad.promise;
  };
  loaders.fr = () => {
    registerPack('fr', { greet: 'bonjour' });
    return frLoad.promise;
  };

  const tree = I18nProvider({ children: null });
  const ctx = tree.values.find(
    (value) => value && typeof value === 'object' && typeof value.setLang === 'function'
  );
  assert.ok(ctx);

  ctx.setLang('es');
  ctx.setLang('fr');

  frLoad.resolve();
  await tick();
  esLoad.resolve();
  await tick();

  assert.deepEqual(
    setItemCalls.map((call) => call.value),
    ['fr']
  );
});
