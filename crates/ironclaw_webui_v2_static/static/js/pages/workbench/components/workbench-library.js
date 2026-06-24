import { Link } from 'react-router';

import { Icon } from '../../../design-system/icons.js';
import { React, html } from '../../../lib/html.js';
import { readLibraryItems, removeLibraryItem } from '../lib/workbench-library-store.js';
import { firstArtifact, savedWorkHref } from '../lib/workbench-work-items.js';

const DEFAULT_SAVED_WORK_SNAPSHOT = Object.freeze({
  statusLabel: 'Local profile',
  label: 'This desktop',
  detail:
    'Showing artifacts saved from this desktop profile. Server-backed Work history is not wired yet.'
});

export function LibraryView({ savedItems, savedWorkSnapshot, onView }) {
  const [query, setQuery] = React.useState('');
  // Work you've kept on this device (e.g. a brief you exported), persisted locally.
  const [saved, setSaved] = React.useState(() => readLibraryItems());
  const source = savedWorkSnapshot || DEFAULT_SAVED_WORK_SNAPSHOT;
  const needle = query.trim().toLowerCase();

  const artifactRows = (Array.isArray(savedItems) ? savedItems : [])
    .map((item) => ({ item, artifact: firstArtifact(item) }))
    .filter((row) => row.artifact);
  const visibleArtifacts = artifactRows.filter(({ item, artifact }) => {
    const haystack = `${item?.title || ''} ${artifact?.title || ''} ${
      artifact?.filename || ''
    }`.toLowerCase();
    return !needle || haystack.includes(needle);
  });
  const visibleSaved = saved.filter(
    (it) => !needle || `${it.title} ${it.kind}`.toLowerCase().includes(needle)
  );
  const isEmpty = visibleSaved.length === 0 && visibleArtifacts.length === 0;

  const onForget = (id) => setSaved(removeLibraryItem(id));

  return html`
    <main className="wb13-main" data-testid="workbench-library">
      <div className="wb13-page">
        <div className="wb13-wide">
          <div className="wb13-head">
            <h1>Library</h1>
            <span className="meta">Saved work and review history</span>
          </div>
          <div className="wb13-library-source" data-testid="workbench-library-source">
            <span className="wb13-library-source-badge">
              <${Icon} name="file" /> ${source.statusLabel || source.label || 'Saved work'}
            </span>
            <span>${source.detail || DEFAULT_SAVED_WORK_SNAPSHOT.detail}</span>
          </div>
          <label className="wb13-pill-control" style=${{ width: 'min(420px, 100%)' }}>
            <${Icon} name="search" />
            <input
              type="search"
              aria-label="Search library"
              placeholder="Search saved work..."
              value=${query}
              onInput=${(event) => setQuery(event.currentTarget.value)}
            />
          </label>
          <div className="wb13-section wb13-list" data-testid="workbench-library-list">
            ${visibleSaved.map(
              (it) => html`
                <div key=${it.id} className="wb13-row">
                  <span className="wb13-row-icon"><${Icon} name="file" /></span>
                  <span>
                    <span className="wb13-row-title">${it.title}</span>
                    <span className="wb13-row-copy">${it.kind}</span>
                  </span>
                  <button
                    type="button"
                    className="wb13-button is-sm"
                    aria-label=${`Remove ${it.title} from library`}
                    onClick=${() => onForget(it.id)}
                  >
                    Remove
                  </button>
                </div>
              `
            )}
            ${visibleArtifacts.map(
              ({ item, artifact }) => html`
                <${Link} key=${item.id} to=${savedWorkHref(item)} className="wb13-row">
                  <span className="wb13-row-icon"><${Icon} name="file" /></span>
                  <span>
                    <span className="wb13-row-title">${item.title || 'Saved work'}</span>
                    <span className="wb13-row-copy"
                      >${artifact.title || artifact.filename || 'Saved artifact'}</span
                    >
                  </span>
                  <span className="wb13-row-meta">open</span>
                <//>
              `
            )}
            ${isEmpty
              ? html`<div className="wb13-empty">
                  ${needle
                    ? `No saved work matches "${query.trim()}".`
                    : 'Nothing saved yet. Briefings and work you export are filed here.'}
                  <button
                    type="button"
                    className="wb13-button is-sm"
                    onClick=${() => onView('home')}
                  >
                    Back to Work
                  </button>
                </div>`
              : null}
          </div>
        </div>
      </div>
    </main>
  `;
}
