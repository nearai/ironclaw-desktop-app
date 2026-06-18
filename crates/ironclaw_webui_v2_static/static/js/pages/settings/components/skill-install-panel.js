import { Button } from '../../../design-system/button.js';
import { Card } from '../../../design-system/card.js';
import { FormField, Input, Textarea } from '../../../design-system/input.js';
import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { useT } from '../../../lib/i18n.js';

export function SkillInstallPanel({ onInstall, isInstalling }) {
  const t = useT();
  const [name, setName] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [content, setContent] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState({ name: '', url: '', content: '' });
  const [formError, setFormError] = React.useState('');
  const [result, setResult] = React.useState('');

  const clearFieldErrorIfValid = React.useCallback((field, value, siblingValue = '') => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const trimmed = value.trim();
      const sibling = siblingValue.trim();
      const valid =
        field === 'url'
          ? !trimmed || trimmed.startsWith('https://')
          : field === 'content'
            ? Boolean(trimmed || sibling)
            : Boolean(trimmed);
      if (!valid) return current;
      return { ...current, [field]: '' };
    });
  }, []);

  const submit = React.useCallback(async () => {
    const payload = buildPayload({ name, url, content });
    const validationErrors = validatePayload(payload, t);
    if (validationErrors.name || validationErrors.url || validationErrors.content) {
      setFieldErrors(validationErrors);
      setFormError('');
      setResult('');
      return;
    }

    setFieldErrors({ name: '', url: '', content: '' });
    setFormError('');
    setResult('');
    try {
      const response = await onInstall(payload);
      if (!response?.success) {
        setFormError(response?.message || t('skills.installFailed'));
        return;
      }

      setName('');
      setUrl('');
      setContent('');
      setResult(response.message || t('skills.installedSuccess', { name: payload.name }));
    } catch (err) {
      setFormError(err.message || t('skills.installFailed'));
    }
  }, [content, name, onInstall, t, url]);

  return html`
    <${Card} padding="md">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--v2-accent-text)]"
          >
            ${t('skills.import')}
          </h3>
          <p className="mt-1 text-sm text-[var(--v2-text-muted)]">${t('skills.importDesc')}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        <${FormField} label=${t('skills.name')} error=${fieldErrors.name} required>
          <${Input}
            size="sm"
            error=${Boolean(fieldErrors.name)}
            aria-invalid=${fieldErrors.name ? 'true' : undefined}
            value=${name}
            placeholder=${t('skills.namePlaceholder')}
            onInput=${(event) => {
              const nextName = event.currentTarget.value;
              setName(nextName);
              clearFieldErrorIfValid('name', nextName);
            }}
          />
        <//>
        <${FormField} label=${t('skills.url')} hint=${t('skills.urlHint')} error=${fieldErrors.url}>
          <${Input}
            size="sm"
            error=${Boolean(fieldErrors.url)}
            aria-invalid=${fieldErrors.url ? 'true' : undefined}
            value=${url}
            placeholder=${t('skills.urlPlaceholder')}
            onInput=${(event) => {
              const nextUrl = event.currentTarget.value;
              setUrl(nextUrl);
              clearFieldErrorIfValid('url', nextUrl);
              clearFieldErrorIfValid('content', content, nextUrl);
            }}
          />
        <//>
      </div>

      <${FormField}
        className="mt-3"
        label=${t('skills.content')}
        error=${fieldErrors.content}
        hint=${t('skills.contentHint')}
      >
        <${Textarea}
          rows=${5}
          error=${Boolean(fieldErrors.content)}
          aria-invalid=${fieldErrors.content ? 'true' : undefined}
          value=${content}
          placeholder=${t('skills.contentPlaceholder')}
          onInput=${(event) => {
            const nextContent = event.currentTarget.value;
            setContent(nextContent);
            clearFieldErrorIfValid('content', nextContent, url);
          }}
        />
      <//>

      ${formError &&
      html`<p className="mt-3 text-sm text-[var(--v2-danger-text)]">${formError}</p>`}
      ${result && html`<p className="mt-3 text-sm text-[var(--v2-positive-text)]">${result}</p>`}

      <div className="mt-4 flex justify-end">
        <${Button} type="button" size="sm" disabled=${isInstalling} onClick=${submit}>
          <${Icon} name="upload" className="h-4 w-4" />
          ${isInstalling ? t('skills.installing') : t('skills.install')}
        <//>
      </div>
    <//>
  `;
}

function buildPayload({ name, url, content }) {
  const payload = { name: name.trim() };
  if (url.trim()) payload.url = url.trim();
  if (content.trim()) payload.content = content.trim();
  return payload;
}

function validatePayload(payload, t) {
  return {
    name: payload.name ? '' : t('skills.nameRequired'),
    url: payload.url && !payload.url.startsWith('https://') ? t('skills.httpsRequired') : '',
    content: payload.url || payload.content ? '' : t('skills.importSourceRequired')
  };
}
