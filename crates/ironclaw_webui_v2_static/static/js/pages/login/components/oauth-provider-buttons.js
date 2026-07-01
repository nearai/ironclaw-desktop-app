import { Button } from '../../../design-system/button.js';
import { html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';

const OAUTH_PROVIDER_LABELS = {
  google: 'Google',
  github: 'GitHub',
  apple: 'Apple'
};

function oauthHref(provider, redirectAfter) {
  return `/auth/login/${encodeURIComponent(provider)}?redirect_after=${encodeURIComponent(
    redirectAfter
  )}`;
}

export function OAuthProviderButtons({ providers, redirectAfter }) {
  const t = useT();

  if (!providers.length) return null;

  return html`
    <div className="mt-6 space-y-3">
      <div className="v2-text-meta flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--v2-panel-border)]"></span>
        <span>${t('login.oauthDivider')}</span>
        <span className="h-px flex-1 bg-[var(--v2-panel-border)]"></span>
      </div>
      <div className="grid gap-2">
        ${providers.map(
          (provider) => html`
            <${Button}
              key=${provider}
              as="a"
              href=${oauthHref(provider, redirectAfter)}
              variant="secondary"
              fullWidth
            >
              ${t('login.oauthProvider', {
                provider: OAUTH_PROVIDER_LABELS[provider] || provider
              })}
            <//>
          `
        )}
      </div>
    </div>
  `;
}
