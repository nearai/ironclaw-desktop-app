import { React, html } from '../../../lib/html.js';
import { Card } from '../../../design-system/card.js';
import { ConfirmDialog } from '../../../design-system/confirm-dialog.js';
import { useT } from '../../../lib/i18n.js';
import { useSkills } from '../hooks/useSkills.js';
import { matchesSearch } from '../lib/settings-search.js';
import { SkillCard } from './skill-card.js';
import { SkillInstallPanel } from './skill-install-panel.js';
import { SettingsSearchEmpty } from './settings-search-empty.js';

export function SkillsTab({ searchQuery = '' }) {
  const t = useT();
  const { skills, query, status, installSkill, removeSkill, isInstalling, isRemoving } =
    useSkills();
  const [actionError, setActionError] = React.useState('');
  const [actionResult, setActionResult] = React.useState('');
  const [confirmRemove, setConfirmRemove] = React.useState(null);

  // Skills are wired to the v2 endpoint, but the import form only renders when
  // the backend is PROVEN reachable (useSkills sets status:'ready' solely on a
  // successful fetch; a loading/errored fetch stays 'todo'). Rendering it over an
  // unproven backend would imply a capability the gateway cannot prove, so keep
  // it gated and preserve the dignified installed/empty states ("No fake readiness").
  const installPanel =
    status !== 'todo'
      ? html`<${SkillInstallPanel} onInstall=${installSkill} isInstalling=${isInstalling} />`
      : null;

  const handleRemove = React.useCallback(
    (name) => {
      setConfirmRemove({
        message: t('skills.confirmRemove', { name }),
        title: t('skills.removeTitle'),
        confirmLabel: t('skills.removeConfirm'),
        tone: 'danger',
        onConfirm: async () => {
          setActionError('');
          setActionResult('');
          const response = await removeSkill(name);
          if (!response?.success) {
            // Throw so the dialog stays open and shows the reason inline.
            throw new Error(response?.message || t('skills.removeFailed'));
          }
          setActionResult(response.message || t('skills.removed', { name }));
        }
      });
    },
    [removeSkill, t]
  );

  if (query.isLoading) {
    return html`
      <div className="space-y-4">
        ${installPanel}
        <${Card} padding="md">
          <div className="v2-skeleton mb-4 h-3 w-24 rounded" />
          ${[1, 2, 3].map(
            (i) => html`
              <div
                key=${i}
                className="flex items-center justify-between border-t border-[var(--v2-panel-border)] py-4 first:border-0"
              >
                <div>
                  <div className="v2-skeleton h-4 w-32 rounded" />
                  <div className="v2-skeleton mt-1 h-3 w-48 rounded" />
                </div>
                <div className="v2-skeleton h-6 w-20 rounded-full" />
              </div>
            `
          )}
        <//>
      </div>
    `;
  }

  if (query.error) {
    return html`
      <div className="space-y-4">
        ${installPanel}
        <${Card} padding="md">
          <p className="text-sm text-[var(--v2-danger-text)]">
            ${t('skills.failedLoad', { message: query.error.message })}
          </p>
        <//>
      </div>
    `;
  }

  const filteredSkills = skills.filter((skill) =>
    matchesSearch(searchQuery, [
      skill.name,
      skill.id,
      skill.description,
      skill.keywords,
      skill.trust_level,
      skill.version
    ])
  );

  if (skills.length === 0) {
    return html`
      <div className="space-y-4">
        ${installPanel}
        <${Card} padding="lg">
          <h3 className="text-lg font-semibold text-[var(--v2-text-strong)]">
            ${t('skills.noInstalled')}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--v2-text-muted)]">
            ${t('skills.noInstalledDesc')}
          </p>
        <//>
      </div>
    `;
  }

  if (filteredSkills.length === 0) {
    return html`
      <div className="space-y-4">
        ${installPanel}
        <${SettingsSearchEmpty} query=${searchQuery} />
      </div>
    `;
  }

  return html`
    <div className="space-y-4">
      ${installPanel}
      <${SkillActionResult} error=${actionError} result=${actionResult} />
      <${Card} padding="md">
        <h3
          className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--v2-accent-text)]"
        >
          ${t('skills.installed')}
        </h3>
        ${filteredSkills.map(
          (skill) => html`
            <${SkillCard}
              key=${skill.name || skill.id}
              skill=${skill}
              onRemove=${handleRemove}
              isRemoving=${isRemoving}
            />
          `
        )}
      <//>
      <${ConfirmDialog} request=${confirmRemove} onClose=${() => setConfirmRemove(null)} />
    </div>
  `;
}

function SkillActionResult({ error, result }) {
  if (!error && !result) return null;
  return html`
    <div
      className=${error
        ? 'rounded-xl border border-[color-mix(in_srgb,var(--v2-danger-text)_36%,var(--v2-panel-border))] bg-[var(--v2-danger-soft)] px-4 py-3 text-sm text-[var(--v2-danger-text)]'
        : 'rounded-xl border border-[color-mix(in_srgb,var(--v2-positive-text)_36%,var(--v2-panel-border))] bg-[var(--v2-positive-soft)] px-4 py-3 text-sm text-[var(--v2-positive-text)]'}
    >
      ${error || result}
    </div>
  `;
}
