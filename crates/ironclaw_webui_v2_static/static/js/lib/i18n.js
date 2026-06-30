import { React, html } from './html.js';

const STORAGE_KEY = 'ironclaw_language';

function detectLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  } catch (_) {}
  const nav = navigator.language || '';
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('de')) return 'de';
  if (nav.startsWith('pt')) return 'pt-BR';
  if (nav.startsWith('ja')) return 'ja';
  if (nav.startsWith('ar')) return 'ar';
  if (nav.startsWith('hi')) return 'hi';
  if (nav.startsWith('uk')) return 'uk';
  if (nav.startsWith('zh')) return 'zh-CN';
  if (nav.startsWith('ko')) return 'ko';
  return 'en';
}

// Right-to-left locales. Arabic ships + auto-detects, so the shell must set the
// document direction or the whole UI renders mirrored-wrong.
const RTL_LANGUAGES = new Set(['ar']);

export function directionFor(lang) {
  return RTL_LANGUAGES.has(String(lang || '')) ? 'rtl' : 'ltr';
}

const packs = {};

export function registerPack(lang, translations) {
  packs[lang] = translations;
}

// English is bundled eagerly (imported by main.js); every other pack is a
// dynamic import so it stays out of the cold-boot bundle. Each loader registers
// itself via registerPack as a side effect of importing.
const PACK_LOADERS = {
  es: () => import('../i18n/es.js'),
  fr: () => import('../i18n/fr.js'),
  de: () => import('../i18n/de.js'),
  'pt-BR': () => import('../i18n/pt-BR.js'),
  ja: () => import('../i18n/ja.js'),
  ar: () => import('../i18n/ar.js'),
  hi: () => import('../i18n/hi.js'),
  uk: () => import('../i18n/uk.js'),
  'zh-CN': () => import('../i18n/zh-CN.js'),
  ko: () => import('../i18n/ko.js')
};

const packLoads = {};

// Resolve a single language pack: already-registered packs and English are no-ops;
// otherwise the matching dynamic import runs once and is memoized.
export function loadLanguagePack(lang) {
  if (!lang || lang === 'en' || packs[lang]) return Promise.resolve();
  const loader = PACK_LOADERS[lang];
  if (!loader) return Promise.resolve();
  if (!packLoads[lang]) {
    packLoads[lang] = loader().catch((err) => {
      delete packLoads[lang];
      throw err;
    });
  }
  return packLoads[lang];
}

// Boot helper: ensure the saved/detected language's pack is present before the
// first render so a non-English user does not flash English.
export function ensureDetectedLanguagePack() {
  return loadLanguagePack(detectLanguage());
}

export function getRegisteredPacks() {
  return { ...packs };
}

function translate(lang, key, params = {}) {
  const text = packs[lang]?.[key] || packs['en']?.[key] || key;
  if (!params || typeof text !== 'string') return text;
  return text.replace(/\{(\w+)\}/g, (match, k) => (params[k] !== undefined ? params[k] : match));
}

const I18nContext = React.createContext({
  lang: 'en',
  setLang: () => {},
  t: (key, params) => translate('en', key, params)
});

export function I18nProvider({ children }) {
  const [lang, setLangState] = React.useState(detectLanguage);

  const commitLang = React.useCallback((next) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) {}
    document.documentElement.lang = next;
    document.documentElement.dir = directionFor(next);
  }, []);

  const setLang = React.useCallback(
    (next) => {
      if (!PACK_LOADERS[next] && next !== 'en') return;
      // English is already bundled; every other pack is lazy-loaded on first use,
      // then the switch is committed so the UI re-renders fully translated.
      if (next === 'en' || packs[next]) {
        commitLang(next);
        return;
      }
      loadLanguagePack(next)
        .then(() => commitLang(next))
        .catch((err) => {
          console.warn('[ironclaw] failed to load language pack', next, err);
        });
    },
    [commitLang]
  );

  React.useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = directionFor(lang);
  }, [lang]);

  const t = React.useCallback((key, params) => translate(lang, key, params), [lang]);

  const ctx = React.useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return html`<${I18nContext.Provider} value=${ctx}>${children}<//>`;
}

export function useI18n() {
  return React.useContext(I18nContext);
}

export function useT() {
  return React.useContext(I18nContext).t;
}

export const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', native: 'Português (Brasil)' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'ko', name: 'Korean', native: '한국어' }
];
