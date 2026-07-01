import { useForm } from 'react-hook-form';
import { Button } from '../../design-system/button.js';
import { Card } from '../../design-system/card.js';
import { Input, FormField } from '../../design-system/input.js';
import { Icon } from '../../design-system/icons.js';
import { useInterfaceTheme } from '../../design-system/theme.js';
import { html } from '../../lib/html.js';
import { useT } from '../../lib/i18n.js';
import { cn } from '../../utils/cn.js';
import { OAuthProviderButtons } from './components/oauth-provider-buttons.js';
import { useOAuthProviders } from './hooks/useOAuthProviders.js';

export function LoginPage({ initialToken, error, oauthRedirectAfter = '/v2', onSubmit }) {
  const t = useT();
  const { theme, toggleTheme } = useInterfaceTheme();
  const oauthProviders = useOAuthProviders();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register
  } = useForm({
    defaultValues: { token: initialToken || '' }
  });

  return html`
    <main
      className="relative flex min-h-[100dvh] items-center justify-center bg-[var(--v2-canvas)] px-4 py-8 sm:px-6 lg:px-12"
    >
      <!-- Theme toggle -->
      <${Button}
        variant="secondary"
        size="icon"
        onClick=${toggleTheme}
        aria-label=${theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
        title=${theme === 'dark' ? t('theme.light') : t('theme.dark')}
        className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6"
      >
        <${Icon} name=${theme === 'dark' ? 'sun' : 'moon'} className="h-4 w-4" />
      <//>

      <!-- Login form (centered, single column) -->
      <${Card} as="section" radius="lg" padding="lg" className="w-full max-w-md shadow-none">
        <div className="mb-8 grid gap-3">
          <p className="v2-text-label text-[var(--v2-accent-text)]">${t('login.tagline')}</p>
          <h1 className="v2-text-display">${t('login.console')}</h1>
          <p className="v2-text-body text-[var(--v2-text-muted)]">${t('login.secureSub')}</p>
        </div>

        <form className="space-y-4" onSubmit=${handleSubmit(({ token }) => onSubmit(token))}>
          <${FormField}
            label=${t('login.tokenLabel')}
            htmlFor="v2-token"
            error=${errors.token?.message ?? ''}
          >
            <${Input}
              id="v2-token"
              type="password"
              error=${!!errors.token}
              ...${register('token', {
                required: t('login.tokenRequired'),
                setValueAs: (v) => v.trim()
              })}
              placeholder=${t('login.tokenPlaceholder')}
              autocomplete="current-password"
            />
          <//>

          <!-- Where's my token? A quiet disclosure so the input never dead-ends. -->
          <details className="group">
            <summary
              className="v2-text-label inline-flex cursor-pointer list-none items-center gap-1.5 text-[var(--v2-text-muted)] hover:text-[var(--v2-text-strong)]"
            >
              <${Icon}
                name="chevron"
                className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
                aria-hidden=${true}
              />
              Where's my token?
            </summary>
            <p className="v2-text-body mt-2 pl-5 text-[var(--v2-text-muted)]">
              ${t('login.tokenHint')}
            </p>
          </details>

          ${error &&
          html`<p
            className=${cn(
              'rounded-[var(--v2-radius-control)] border px-3 py-2 text-sm',
              'border-[color-mix(in_srgb,var(--v2-danger-text)_36%,var(--v2-panel-border))]',
              'bg-[var(--v2-danger-soft)] text-[var(--v2-danger-text)]'
            )}
          >
            ${error}
          </p>`}

          <${Button} type="submit" variant="primary" fullWidth disabled=${isSubmitting}>
            ${t('login.connect')}
          <//>
        </form>

        <${OAuthProviderButtons} providers=${oauthProviders} redirectAfter=${oauthRedirectAfter} />
      <//>
    </main>
  `;
}
