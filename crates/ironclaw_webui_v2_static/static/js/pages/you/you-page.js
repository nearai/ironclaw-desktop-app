import { useQuery } from '@tanstack/react-query';

import { React, html } from '../../lib/html.js';
import { connectorRead } from '../../lib/api.js';
import { Icon } from '../../design-system/icons.js';
import { normalizeInboxMessages } from '../workbench/lib/workbench-connectors.js';
import { computeBehaviourProfile } from '../workbench/lib/workbench-profile.js';
import {
  applyTierOverrides,
  readTierOverrides,
  recountTiers,
  setTierOverride,
  TIER_OPTIONS
} from '../workbench/lib/workbench-profile-overrides.js';

// The "You" surface — what IronClaw has learned about how you actually work,
// from your own mail (who you reply to, how fast, who it auto-files). Everything
// is observed + shown with its evidence; nothing is sent. Tiers come from the
// same validated logic as triage (lib/workbench-profile.js + the standalone
// engine), so the day's ranking and this surface always agree.

const PRIMARY_INBOX_QUERY =
  'in:inbox -category:promotions -category:updates -category:forums -category:social';

const TIER_META = {
  vip: { label: 'VIP', tone: 'var(--v2-accent-text)' },
  respond: { label: 'Respond', tone: 'var(--v2-good-text, #1d6042)' },
  fyi: { label: 'FYI', tone: 'var(--v2-text-muted)' },
  ignore: { label: 'Filed', tone: 'var(--v2-text-faint)' }
};

// Self-contained styles (app-wide --v2-* tokens; Newsreader display per v13). The
// "You" route does not mount the workbench token sheet, so we own our layout here.
const YOU_STYLE = `
.wb13-you { max-width: 760px; margin: 0 auto; padding: 28px 24px 64px; color: var(--v2-text-strong); }
.wb13-you-head h1 { font-family: "Newsreader", Georgia, serif; font-size: 30px; line-height: 1.15; margin: 0 0 8px; color: var(--v2-text-strong); }
.wb13-you-lede { color: var(--v2-text-muted); font-size: 14px; line-height: 1.55; margin: 0 0 20px; max-width: 60ch; }
.wb13-you-stats { display: flex; flex-wrap: wrap; gap: 16px; padding: 12px 0; border-top: 1px solid var(--v2-panel-border); border-bottom: 1px solid var(--v2-panel-border); margin-bottom: 20px; }
.wb13-you-stats span { color: var(--v2-text-muted); font-size: 13px; }
.wb13-you-stats b { color: var(--v2-text-strong); font-size: 18px; margin-right: 4px; }
.wb13-you-section { margin: 20px 0; }
.wb13-you-section h2 { font-family: "Newsreader", Georgia, serif; font-size: 18px; margin: 0 0 10px; color: var(--v2-text-strong); }
.wb13-you-patterns { margin: 0; padding-left: 18px; color: var(--v2-text); }
.wb13-you-patterns li { margin: 4px 0; font-size: 14px; line-height: 1.5; }
.wb13-you-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--v2-hairline, var(--v2-panel-border)); }
.wb13-you-badge { flex: none; font: 600 11px/1 var(--v2-font, inherit); letter-spacing: 0.04em; text-transform: uppercase; border: 1px solid currentColor; border-radius: 6px; padding: 4px 7px; }
.wb13-you-rowmain { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
.wb13-you-email { color: var(--v2-text-strong); font-size: 14px; font-weight: 500; overflow-wrap: anywhere; }
.wb13-you-meta { color: var(--v2-text-muted); font-size: 12.5px; }
.wb13-you-select { flex: none; margin-left: auto; font: 12px var(--v2-font, inherit); color: var(--v2-text-strong); background: var(--v2-input-bg, transparent); border: 1px solid var(--v2-panel-border); border-radius: 7px; padding: 5px 7px; cursor: pointer; }
.wb13-you-restore { flex: none; margin-left: auto; font: 600 12px var(--v2-font, inherit); color: var(--v2-accent-text, var(--v2-text-strong)); background: transparent; border: 1px solid var(--v2-panel-border); border-radius: 7px; padding: 5px 9px; cursor: pointer; }
.wb13-you-restore:hover { border-color: color-mix(in srgb, var(--v2-accent) 40%, var(--v2-panel-border)); background: var(--v2-surface-soft, transparent); }
.wb13-you-empty { color: var(--v2-text-muted); font-size: 14px; padding: 12px 0; }
.wb13-you-foot { display: flex; align-items: center; gap: 8px; margin-top: 24px; color: var(--v2-text-faint); font-size: 12.5px; }
.wb13-you-foot svg { width: 15px; height: 15px; }
`;

// Read up to `pages` × `perPage` messages for a query, following the connector's
// nextPageToken. Tiering needs a fuller sent window than one page so reply-threads
// match the inbox (one page tiers everyone "fyi"); each 25-row page is reliable
// where a single large read 503s. Degrades to whatever pages succeed.
async function readPaged(query, { signal, pages = 1, perPage = 25 } = {}) {
  const rows = [];
  let pageToken;
  for (let i = 0; i < pages; i++) {
    const args = { max_results: perPage, query };
    if (pageToken) args.page_token = pageToken;
    const res = await connectorRead({
      toolkit: 'gmail',
      tool: 'GMAIL_FETCH_EMAILS',
      arguments: args,
      signal
    }).catch(() => null);
    if (!res) break;
    rows.push(...normalizeInboxMessages(res, { limit: perPage }));
    pageToken = res?.data?.nextPageToken || res?.data?.next_page_token;
    if (!pageToken) break;
  }
  return rows;
}

async function readProfile({ signal, sentPages = 4, inboxPages = 2 }) {
  // Sent is paged deeper (≈100) so VIP/respond tiers actually surface; the Primary
  // inbox is paged lightly (≈50) for sender coverage. The "quick" pass (1 page each)
  // paints the surface fast (~one read); the "deep" pass refines it in the background.
  const [sentRows, inboxRows] = await Promise.all([
    readPaged('in:sent', { signal, pages: sentPages, perPage: 25 }),
    readPaged(PRIMARY_INBOX_QUERY, { signal, pages: inboxPages, perPage: 25 })
  ]);
  return computeBehaviourProfile({
    sent: sentRows.map((row) => ({ threadId: row.threadId, timestamp: row.timestamp })),
    inbox: inboxRows.map((row) => ({
      threadId: row.threadId,
      timestamp: row.timestamp,
      email: row.fromEmail || row.sender,
      isBulk: row.isBulk,
      important: row.important
    }))
  });
}

function TierBadge({ tier }) {
  const meta = TIER_META[tier] || TIER_META.fyi;
  return html`<span className="wb13-you-badge" style=${{ color: meta.tone, borderColor: meta.tone }}
    >${meta.label}</span
  >`;
}

const TIER_LABELS = { vip: 'VIP', respond: 'Respond', fyi: 'FYI', ignore: 'Filed' };

function PersonRow({ person, onTierChange }) {
  const latency = person.medianLatencyHrs != null ? `~${person.medianLatencyHrs}h` : null;
  const meta = [
    person.received ? `${person.received} in` : null,
    person.replied ? `${person.replied} replied` : null,
    latency ? `reply ${latency}` : null,
    person.overridden ? 'you set this' : null
  ]
    .filter(Boolean)
    .join(' · ');
  return html`<div className="wb13-you-row">
    <${TierBadge} tier=${person.tier} />
    <div className="wb13-you-rowmain">
      <span className="wb13-you-email">${person.email}</span>
      ${meta ? html`<span className="wb13-you-meta">${meta}</span>` : null}
    </div>
    <select
      className="wb13-you-select"
      aria-label=${`Set tier for ${person.email}`}
      value=${person.tier}
      onChange=${(e) => onTierChange(person.email, e.target.value)}
    >
      ${TIER_OPTIONS.map(
        (tier) => html`<option key=${tier} value=${tier}>${TIER_LABELS[tier]}</option>`
      )}
    </select>
  </div>`;
}

export function YouPage() {
  // Two-phase load so the surface paints fast: a quick 1-page pass (~one read)
  // renders immediately, then a deep pass (~100 sent) refines the tiers in place.
  const quick = useQuery({
    queryKey: ['workbench-you-profile', 'quick'],
    queryFn: ({ signal }) => readProfile({ signal, sentPages: 1, inboxPages: 1 }),
    staleTime: 120_000,
    retry: 1,
    throwOnError: false
  });
  const deep = useQuery({
    queryKey: ['workbench-you-profile', 'deep'],
    queryFn: ({ signal }) => readProfile({ signal, sentPages: 4, inboxPages: 2 }),
    staleTime: 120_000,
    retry: 1,
    throwOnError: false
  });
  const query = deep.data ? deep : quick;
  const profile = query.data;
  const refining = Boolean(quick.data) && deep.isLoading && !deep.data;
  // User corrections (per-sender tier), persisted locally; applied over the
  // engine's inference so a correction moves the person immediately.
  const [overrides, setOverrides] = React.useState(() => readTierOverrides());
  const onTierChange = React.useCallback(
    (email, tier) => setOverrides(setTierOverride(email, tier)),
    []
  );
  const rawPeople = profile && Array.isArray(profile.people) ? profile.people : [];
  const people = applyTierOverrides(rawPeople, overrides);
  const counts = profile ? recountTiers(people) : {};
  const patterns = (profile && profile.patterns) || [];
  const surfaced = people.filter((person) => person.tier !== 'ignore');

  return html`<div className="h-full overflow-y-auto">
    <style>
      ${YOU_STYLE}
    </style>
    <div className="wb13-you" data-testid="workbench-you" aria-label="How you work">
      <header className="wb13-you-head">
        <h1>How you work</h1>
        <p className="wb13-you-lede">
          Learned from your mail — who you reply to, how fast, and what's auto-filed. Observed and
          yours to correct; nothing is sent.
        </p>
      </header>

      ${refining
        ? html`<p className="wb13-you-meta" style=${{ margin: '0 0 12px' }}>
            Refining from more of your history…
          </p>`
        : null}
      ${query.isLoading
        ? html`<p className="wb13-you-empty">Reading your recent mail…</p>`
        : query.isError || !profile
          ? html`<p className="wb13-you-empty">
              Couldn't read your mail right now. Connect Gmail or try again.
            </p>`
          : html`
              <div className="wb13-you-stats">
                <span><b>${counts.vip || 0}</b> VIP</span>
                <span><b>${counts.respond || 0}</b> respond</span>
                <span><b>${counts.fyi || 0}</b> FYI</span>
                <span><b>${counts.bulk || 0}</b> auto-filed</span>
              </div>

              ${patterns.length
                ? html`<section className="wb13-you-section" aria-label="Patterns">
                    <h2>What IronClaw follows</h2>
                    <ul className="wb13-you-patterns">
                      ${patterns.map((pattern, i) => html`<li key=${i}>${pattern}</li>`)}
                    </ul>
                  </section>`
                : null}

              <section className="wb13-you-section" aria-label="People">
                <h2>Who matters to you</h2>
                ${surfaced.length
                  ? surfaced.map(
                      (person) =>
                        html`<${PersonRow}
                          key=${person.email}
                          person=${person}
                          onTierChange=${onTierChange}
                        />`
                    )
                  : html`<p className="wb13-you-empty">
                      No correspondents yet — they appear as you exchange mail.
                    </p>`}
              </section>

              <div className="wb13-you-foot">
                <${Icon} name="shield" />
                <span>Read-only. This shapes how your day is ranked; it never sends anything.</span>
              </div>
            `}
    </div>
  </div>`;
}
