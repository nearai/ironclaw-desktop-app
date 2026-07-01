import { useQuery } from '@tanstack/react-query';

import { React, html } from '../../lib/html.js';
import { connectorRead } from '../../lib/api.js';
import { Icon } from '../../design-system/icons.js';
import { Badge } from '../../design-system/badge.js';
import { Button } from '../../design-system/button.js';
import { Popover } from '../../design-system/popover.js';
import { normalizeInboxMessages } from '../workbench/lib/workbench-connectors.js';
import { computeBehaviourProfile } from '../workbench/lib/workbench-profile.js';
import {
  applyTierOverrides,
  readTierOverrides,
  recountTiers,
  setTierOverride,
  TIER_OPTIONS
} from '../workbench/lib/workbench-profile-overrides.js';
import {
  readDismissals,
  learnedIgnoreSenders,
  dismissalSignalsBySender,
  clearSenderDismissals
} from '../workbench/lib/workbench-dismissals.js';

// The "You" surface — what IronClaw has learned about how you actually work,
// from your own mail (who you reply to, how fast, who it auto-files). Everything
// is observed + shown with its evidence; nothing is sent. Tiers come from the
// same validated logic as triage (lib/workbench-profile.js + the standalone
// engine), so the day's ranking and this surface always agree.

const PRIMARY_INBOX_QUERY =
  'in:inbox -category:promotions -category:updates -category:forums -category:social';

// Tier presentation on the shared Badge primitive. The one accent (signal blue)
// marks VIP — the people whose mail matters most; everything below it is quiet
// (positive for Respond, muted/faint for FYI and Filed). No hand-rolled chips.
const TIER_META = {
  vip: { label: 'VIP', tone: 'signal' },
  respond: { label: 'Respond', tone: 'positive' },
  fyi: { label: 'FYI', tone: 'muted' },
  ignore: { label: 'Filed', tone: 'muted' }
};

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
  return html`<${Badge} tone=${meta.tone} dot=${false} size="sm" label=${meta.label} />`;
}

const TIER_LABELS = { vip: 'VIP', respond: 'Respond', fyi: 'FYI', ignore: 'Filed' };

// Tier control on the shared popover/menu primitive — replaces the native <select>
// (which could not be themed to the graphite system and broke the one-depth rule).
// The trigger reads as a quiet chip; the accessible name is preserved so tests and
// screen readers still find "Set tier for <email>".
function TierMenu({ person, onTierChange }) {
  const [open, setOpen] = React.useState(false);
  return html`<${Popover}
    open=${open}
    onClose=${() => setOpen(false)}
    align="end"
    side="bottom"
    ariaLabel=${`Set tier for ${person.email}`}
    className="border-t-2 border-t-[var(--v2-accent)] p-1.5"
    trigger=${html`<button
      type="button"
      aria-haspopup="menu"
      aria-expanded=${open}
      aria-label=${`Set tier for ${person.email}`}
      onClick=${() => setOpen((v) => !v)}
      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--v2-radius-control)] border border-[var(--v2-panel-border)] px-2.5 v2-text-meta text-[var(--v2-text)] hover:border-[color-mix(in_srgb,var(--v2-accent)_40%,var(--v2-panel-border))] hover:text-[var(--v2-text-strong)]"
    >
      ${TIER_LABELS[person.tier] || TIER_LABELS.fyi}
      <${Icon} name="chevronDown" className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
    </button>`}
  >
    <div role="menu" aria-label=${`Tier for ${person.email}`} className="grid min-w-[9rem] gap-0.5">
      ${TIER_OPTIONS.map(
        (tier) =>
          html`<button
            key=${tier}
            type="button"
            role="menuitemradio"
            aria-checked=${person.tier === tier}
            onClick=${() => {
              setOpen(false);
              onTierChange(person.email, tier);
            }}
            className=${[
              'flex min-h-[36px] items-center justify-between gap-2 rounded-[var(--v2-radius-control)] px-2.5 text-left v2-text-body',
              person.tier === tier
                ? 'bg-[var(--v2-accent-soft)] text-[var(--v2-accent-text)]'
                : 'text-[var(--v2-text)] hover:bg-[var(--v2-surface-soft)] hover:text-[var(--v2-text-strong)]'
            ].join(' ')}
          >
            ${TIER_LABELS[tier]}
            ${person.tier === tier
              ? html`<${Icon} name="check" className="h-4 w-4" aria-hidden="true" />`
              : ''}
          </button>`
      )}
    </div>
  <//>`;
}

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
  return html`<div
    className="flex items-center gap-3 border-b border-[var(--v2-panel-border)] py-3 last:border-b-0"
  >
    <${TierBadge} tier=${person.tier} />
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span
        className="v2-text-body font-medium text-[var(--v2-text-strong)] [overflow-wrap:anywhere]"
        >${person.email}</span
      >
      ${meta ? html`<span className="v2-text-meta">${meta}</span>` : null}
    </div>
    <${TierMenu} person=${person} onTierChange=${onTierChange} />
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
  // Senders the dismiss-to-learn loop has auto-filed (≥2 sender-level dismissals).
  // Shown so the learning is transparent + reversible — "Surface again" un-files one.
  const [dismissals, setDismissals] = React.useState(() => readDismissals());
  const onSurfaceAgain = React.useCallback(
    (email) => setDismissals(clearSenderDismissals(email)),
    []
  );
  const learnedRows = React.useMemo(() => {
    const signals = dismissalSignalsBySender(dismissals);
    return [...learnedIgnoreSenders(dismissals)]
      .map((email) => ({ email, count: signals[email]?.count || 0 }))
      .sort((a, b) => b.count - a.count);
  }, [dismissals]);
  const rawPeople = profile && Array.isArray(profile.people) ? profile.people : [];
  const people = applyTierOverrides(rawPeople, overrides);
  const counts = profile ? recountTiers(people) : {};
  const patterns = (profile && profile.patterns) || [];
  const surfaced = people.filter((person) => person.tier !== 'ignore');

  const stats = [
    { key: 'vip', label: 'VIP', value: counts.vip || 0 },
    { key: 'respond', label: 'Respond', value: counts.respond || 0 },
    { key: 'fyi', label: 'FYI', value: counts.fyi || 0 },
    { key: 'bulk', label: 'Auto-filed', value: counts.bulk || 0 }
  ];

  return html`<div className="h-full overflow-y-auto">
    <div
      className="mx-auto max-w-[760px] px-6 pb-16 pt-7"
      data-testid="workbench-you"
      aria-label="How you work"
    >
      <header>
        <h1 className="v2-text-display">How you work</h1>
        <p className="mt-2 max-w-[60ch] v2-text-body text-[var(--v2-text-muted)]">
          Learned from your mail — who you reply to, how fast, and what's auto-filed. Observed and
          yours to correct; nothing is sent.
        </p>
      </header>

      ${refining
        ? html`<p className="mt-3 v2-text-meta">Refining from more of your history…</p>`
        : null}
      ${query.isLoading
        ? html`<p className="mt-6 v2-text-body text-[var(--v2-text-muted)]">
            Reading your recent mail…
          </p>`
        : query.isError || !profile
          ? html`<p className="mt-6 v2-text-body text-[var(--v2-text-muted)]">
              Couldn't read your mail right now. Connect Gmail or try again.
            </p>`
          : html`
              ${
                /* Focal stat strip: large tabular figures, baseline-aligned, quiet
              mono labels. Hairline top/bottom, no metric boxes. This is the
              surface's centerpiece — the shape of how the user works. */ ''
              }
              <div
                className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-y border-[var(--v2-panel-border)] py-5"
              >
                ${stats.map(
                  (stat) =>
                    html`<div key=${stat.key} className="flex items-baseline gap-2">
                      <span
                        className="text-[28px] font-semibold leading-none tabular-nums text-[var(--v2-text-strong)]"
                        >${stat.value}</span
                      >
                      <span className="v2-text-label">${stat.label}</span>
                    </div>`
                )}
              </div>

              ${patterns.length
                ? html`<section className="mt-8" aria-label="Patterns">
                    <h2 className="v2-text-label">What IronClaw follows</h2>
                    <ul className="mt-3 grid gap-1.5">
                      ${patterns.map(
                        (pattern, i) =>
                          html`<li
                            key=${i}
                            className="flex gap-2.5 v2-text-body text-[var(--v2-text)]"
                          >
                            <span
                              aria-hidden="true"
                              className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--v2-text-faint)]"
                            ></span>
                            <span className="min-w-0">${pattern}</span>
                          </li>`
                      )}
                    </ul>
                  </section>`
                : null}

              <section className="mt-8" aria-label="People">
                <h2 className="v2-text-label">Who matters to you</h2>
                <div className="mt-2">
                  ${surfaced.length
                    ? surfaced.map(
                        (person) =>
                          html`<${PersonRow}
                            key=${person.email}
                            person=${person}
                            onTierChange=${onTierChange}
                          />`
                      )
                    : html`<p className="v2-text-body text-[var(--v2-text-muted)]">
                        No correspondents yet — they appear as you exchange mail.
                      </p>`}
                </div>
              </section>

              ${learnedRows.length
                ? html`<section className="mt-8" aria-label="Auto-filed senders">
                    <h2 className="v2-text-label">Auto-filed from your dismissals</h2>
                    <p className="mt-2 v2-text-meta">
                      You filed these often enough that new mail from them is suppressed. Surface
                      one again to undo.
                    </p>
                    <div className="mt-2">
                      ${learnedRows.map(
                        (row) =>
                          html`<div
                            key=${row.email}
                            className="flex items-center gap-3 border-b border-[var(--v2-panel-border)] py-3 last:border-b-0"
                          >
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span
                                className="v2-text-body font-medium text-[var(--v2-text-strong)] [overflow-wrap:anywhere]"
                                >${row.email}</span
                              >
                              <span className="v2-text-meta">filed ${row.count}×</span>
                            </div>
                            <${Button}
                              variant="secondary"
                              size="sm"
                              data-testid="workbench-you-surface-again"
                              onClick=${() => onSurfaceAgain(row.email)}
                            >
                              Surface again
                            <//>
                          </div>`
                      )}
                    </div>
                  </section>`
                : null}

              <div className="mt-10 flex items-center gap-2 v2-text-meta">
                <${Icon} name="shield" className="h-4 w-4" aria-hidden="true" />
                <span>Read-only. This shapes how your day is ranked; it never sends anything.</span>
              </div>
            `}
    </div>
  </div>`;
}
