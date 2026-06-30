import { QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { App } from './app/app.js';
import { html } from './lib/html.js';
import { queryClient } from './lib/query-client.js';
import { I18nProvider } from './lib/i18n.js';
import { bootstrapDesktopSession, storeToken } from './lib/api.js';
import { maybeRunPackagedWebviewSmoke } from './lib/packaged-smoke.js';
import { installZoomControls } from './lib/zoom.js';
// Only English is eager-loaded into cold boot. The other ten packs (~340KB) are
// fetched on demand by setLang() / loadLanguagePack() in lib/i18n.js when the
// user actually switches — or once on boot if a non-English language is detected.
import './i18n/en.js';
import { ensureDetectedLanguagePack } from './lib/i18n.js';

async function boot() {
  maybeRunPackagedWebviewSmoke();
  installZoomControls();

  // If the saved/detected language is not English, load that pack before first
  // paint so the UI never flashes English then re-renders translated.
  try {
    await ensureDetectedLanguagePack();
  } catch (err) {
    console.warn('[ironclaw] locale pack load failed; falling back to English', err);
  }

  try {
    const desktopSession = await bootstrapDesktopSession();
    if (desktopSession?.token) {
      storeToken(desktopSession.token);
    }
  } catch (err) {
    console.warn('[ironclaw] desktop bootstrap failed; falling back to browser auth', err);
  }

  createRoot(document.getElementById('v2-root')).render(html`
    <${I18nProvider}>
      <${QueryClientProvider} client=${queryClient}>
        <${App} />
      <//>
    <//>
  `);

  setTimeout(() => {
    maybeRunPackagedWebviewSmoke();
  }, 0);
}

boot();
