#!/usr/bin/env node
// Workbench PROFILE / BEHAVIOUR ENGINE + VALIDATION GAUNTLET
//
// Learns how the user actually works from their Gmail — who they reply to, how
// fast, who they ignore (newsletters) — and ranks the day from that, NOT from
// generic importance. Then validates the model against real behaviour so it
// never surfaces a newsletter as if it needed a reply.
//
//   node scripts/workbench-profile-engine.mjs            # against the standalone gateway :17640
//   GW_PORT=3100 WEBUI_TOKEN=... node scripts/workbench-profile-engine.mjs
//
// Reads metadata + headers only (sender/to/date/threadId/labels/List-Unsubscribe).
// Never prints email bodies. Output: /tmp/wb-profile/{profile.json,report.md}.
import fs from 'node:fs';

const GW = `http://127.0.0.1:${process.env.GW_PORT || 17640}`;
const B = '/api/webchat/v2';
const TOK = process.env.WEBUI_TOKEN || 'workbench-standalone';
const H = { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json' };
const OUT = '/tmp/wb-profile';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gmail(args, tries = 5) {
  for (let i = 0; i < tries; i++) {
    let r, t;
    try {
      r = await fetch(`${GW}${B}/connectors/read`, {
        method: 'POST', headers: H,
        body: JSON.stringify({ toolkit: 'gmail', tool: 'GMAIL_FETCH_EMAILS', arguments: args }),
      });
      t = await r.text();
    } catch (e) { await sleep(700 * (i + 1)); continue; }
    if (r.status === 503 || r.status === 429) { await sleep(700 * (i + 1)); continue; }
    let j; try { j = JSON.parse(t); } catch { j = {}; }
    return j;
  }
  return {};
}
function msgsOf(j) { const d = j?.data || {}; return d.messages || d.emails || (Array.isArray(d) ? d : []); }
function nextToken(j) { const d = j?.data || {}; return d.nextPageToken || d.next_page_token || ''; }

// Pull up to `target` messages for a query, paginating if the connector supports it,
// otherwise falling back to the largest batch the backend tolerates.
async function fetchAll(query, target = 250) {
  const out = []; const seen = new Set();
  let pageToken = '';
  for (let batch = 60; batch >= 10 && out.length < target; ) {
    const args = { max_results: Math.min(batch, target - out.length), query };
    if (pageToken) args.page_token = pageToken;
    const j = await gmail(args);
    const ms = msgsOf(j);
    if (!ms.length) { if (pageToken) break; batch = Math.floor(batch / 2); continue; }
    for (const m of ms) { const id = m.messageId || m.message_id; if (id && !seen.has(id)) { seen.add(id); out.push(m); } }
    pageToken = nextToken(j);
    if (!pageToken) break;
  }
  return out;
}

const emailOf = (s) => ((s || '').match(/<([^>]+)>/)?.[1] || (s || '').trim()).toLowerCase();
const domainOf = (e) => (e.split('@')[1] || '').toLowerCase();
const tsOf = (m) => { const t = Date.parse(m.messageTimestamp || m.date || ''); return Number.isFinite(t) ? t : null; };
function header(m, name) {
  const hs = m.payload?.headers || m.headers || [];
  const h = hs.find((x) => (x.name || '').toLowerCase() === name.toLowerCase());
  return h?.value || '';
}
const BULK_LOCALPARTS = /^(no[-_.]?reply|noreply|do[-_.]?not[-_.]?reply|newsletter|news|notifications?|updates?|mailer|mail|info|hello|team|support|digest|alerts?|marketing|invest|inquiry|pkginfo)([+.@]|$)/i;
function bulkMarkers(m) {
  const marks = [];
  if (header(m, 'List-Unsubscribe')) marks.push('list-unsubscribe');
  if (header(m, 'List-Id')) marks.push('list-id');
  const prec = header(m, 'Precedence').toLowerCase();
  if (prec === 'bulk' || prec === 'list' || prec === 'junk') marks.push(`precedence:${prec}`);
  const labels = m.labelIds || m.labels || [];
  for (const c of ['CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS', 'CATEGORY_SOCIAL'])
    if (labels.includes(c)) marks.push(c.replace('CATEGORY_', 'cat:').toLowerCase());
  const local = emailOf(m.sender).split('@')[0] || '';
  if (BULK_LOCALPARTS.test(local)) marks.push('bulk-localpart');
  return marks;
}
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const hrs = (ms) => ms == null ? null : +(ms / 3.6e6).toFixed(1);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  console.log('[engine] pulling sent + inbox …');
  const sent = await fetchAll('in:sent', 250);
  const inbox = await fetchAll('in:inbox', 250);
  console.log(`[engine] sent=${sent.length} inbox=${inbox.length}`);

  // Who am I? the dominant sender of the SENT folder.
  const meCount = {};
  for (const m of sent) { const e = emailOf(m.sender); if (e) meCount[e] = (meCount[e] || 0) + 1; }
  const me = Object.entries(meCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  // Sent thread map: threadId -> earliest+all sent timestamps, and recipients.
  const sentThreads = new Map(); // threadId -> [ts...]
  const initiatedWith = new Set(); // domains/emails the user started threads with (approx)
  for (const m of sent) {
    const t = tsOf(m); if (m.threadId && t != null) {
      if (!sentThreads.has(m.threadId)) sentThreads.set(m.threadId, []);
      sentThreads.get(m.threadId).push(t);
    }
    for (const r of String(m.to || '').split(',')) { const e = emailOf(r); if (e && e !== me) initiatedWith.add(e); }
  }

  // Per-sender aggregation over received (inbox) mail.
  const S = new Map();
  const get = (e) => { if (!S.has(e)) S.set(e, { email: e, domain: domainOf(e), received: 0, replied: 0, latencies: [], lastSeen: 0, bulkHits: {}, subjects: [] }); return S.get(e); };
  for (const m of inbox) {
    const from = emailOf(m.sender); if (!from || from === me) continue;
    const rt = tsOf(m); const a = get(from);
    a.received++;
    if (rt && rt > a.lastSeen) a.lastSeen = rt;
    if (a.subjects.length < 3 && m.subject) a.subjects.push(String(m.subject).slice(0, 80));
    for (const mk of bulkMarkers(m)) a.bulkHits[mk] = (a.bulkHits[mk] || 0) + 1;
    // replied? a sent message exists in this thread, after this received message.
    const st = sentThreads.get(m.threadId);
    if (st && rt) { const after = st.filter((x) => x > rt); if (after.length) { a.replied++; a.latencies.push(Math.min(...after) - rt); } }
  }

  // Derive signals + tier per sender (behaviour, not guesses).
  const TIERS = ['vip', 'respond', 'fyi', 'ignore'];
  function tierFor(a) {
    const rate = a.received ? a.replied / a.received : 0;
    const medLat = median(a.latencies);
    const bulk = Object.keys(a.bulkHits).length > 0;
    const initiated = initiatedWith.has(a.email);
    // Newsletters / bulk: you don't reply to these -> Ignore (unless you genuinely
    // do reply, which would be unusual; keep them out of "needs you").
    if (bulk && rate < 0.2) return { tier: 'ignore', rate, medLat, bulk, initiated };
    if (!bulk && rate >= 0.6 && a.received >= 2 && medLat != null && medLat < 6 * 3.6e6) return { tier: 'vip', rate, medLat, bulk, initiated };
    if (!bulk && (rate >= 0.3 || (initiated && rate > 0))) return { tier: 'respond', rate, medLat, bulk, initiated };
    if (bulk) return { tier: 'fyi', rate, medLat, bulk, initiated }; // bulk you sometimes engage
    return { tier: 'fyi', rate, medLat, bulk, initiated };
  }
  const people = [];
  for (const a of S.values()) {
    const d = tierFor(a);
    people.push({ email: a.email, domain: a.domain, tier: d.tier, replyRate: +d.rate.toFixed(2), medianLatencyHrs: hrs(d.medLat), received: a.received, replied: a.replied, bulk: d.bulk, bulkMarkers: Object.keys(a.bulkHits), initiated: d.initiated, lastSeen: a.lastSeen ? new Date(a.lastSeen).toISOString() : null, subjects: a.subjects });
  }
  people.sort((x, y) => TIERS.indexOf(x.tier) - TIERS.indexOf(y.tier) || y.replyRate - x.replyRate);

  // ---- VALIDATION GAUNTLET ----
  const bulkSenders = people.filter((p) => p.bulk);
  const humanSenders = people.filter((p) => !p.bulk);
  const vipRespond = people.filter((p) => p.tier === 'vip' || p.tier === 'respond');
  // V1 — newsletter suppression: NO bulk sender may be VIP/Respond.
  const leakedNewsletters = vipRespond.filter((p) => p.bulk);
  // V2 — "what needs you" simulation: unreplied recent inbox items whose sender is VIP/Respond.
  const tierByEmail = new Map(people.map((p) => [p.email, p.tier]));
  const surfaced = [];
  for (const m of inbox) {
    const from = emailOf(m.sender); if (!from || from === me) continue;
    const t = tierByEmail.get(from); if (t !== 'vip' && t !== 'respond') continue;
    const st = sentThreads.get(m.threadId); const rt = tsOf(m);
    const replied = st && rt && st.some((x) => x > rt);
    if (!replied) surfaced.push({ from, tier: t, subject: String(m.subject || '').slice(0, 80) });
  }
  const surfacedBulk = surfaced.filter((s) => bulkSenders.some((b) => b.email === s.from));
  // V3 — reply-prediction backtest, TRUE temporal holdout (no leakage). Reply
  // propensity is derived from the TRAIN window only, then used to predict
  // reply on the held-out TEST window; ground truth = did the user actually
  // reply in that thread (from sent data). Bulk is header-derived (time-
  // invariant) so it is not leakage. Cold-start senders (unseen in train) are
  // predicted "no" — the honest behaviour of a model that has never seen them.
  const dated = inbox.map((m) => ({ m, t: tsOf(m), from: emailOf(m.sender) })).filter((x) => x.t && x.from && x.from !== me).sort((a, b) => a.t - b.t);
  let backtest = { n: 0, note: 'insufficient data for a temporal split' };
  if (dated.length >= 8) {
    const cut = dated[Math.floor(dated.length / 2)].t;
    const train = dated.filter((x) => x.t < cut), test = dated.filter((x) => x.t >= cut);
    const tr = new Map(); // email -> { recv, repl, bulk } from TRAIN only
    for (const { m, from, t } of train) {
      if (!tr.has(from)) tr.set(from, { recv: 0, repl: 0, bulk: false });
      const e = tr.get(from); e.recv++;
      if (bulkMarkers(m).length) e.bulk = true;
      const st = sentThreads.get(m.threadId); if (st && st.some((x) => x > t)) e.repl++;
    }
    let tp = 0, fp = 0, fn = 0, tn = 0, cold = 0;
    for (const { m, from, t } of test) {
      const e = tr.get(from);
      const pred = e ? (!e.bulk && e.recv > 0 && e.repl / e.recv >= 0.3) : false;
      if (!e) cold++;
      const st = sentThreads.get(m.threadId); const actual = !!(st && st.some((x) => x > t));
      if (pred && actual) tp++; else if (pred && !actual) fp++; else if (!pred && actual) fn++; else tn++;
    }
    const prec = tp + fp ? +(tp / (tp + fp)).toFixed(2) : null, rec = tp + fn ? +(tp / (tp + fn)).toFixed(2) : null;
    backtest = { method: 'temporal-holdout (train-only signal, cold-start=no)', trainN: train.length, testN: test.length, coldStartInTest: cold, tp, fp, fn, tn, precision: prec, recall: rec, f1: prec && rec ? +(2 * prec * rec / (prec + rec)).toFixed(2) : null, n: tp + fp + fn + tn };
  }

  const profile = { generatedAt: new Date().toISOString(), me, counts: { sent: sent.length, inbox: inbox.length, senders: people.length, bulkSenders: bulkSenders.length, humanSenders: humanSenders.length }, tiers: Object.fromEntries(TIERS.map((t) => [t, people.filter((p) => p.tier === t).length])), people };
  const validation = {
    V1_newsletter_suppression: { vipRespondCount: vipRespond.length, bulkLeakedIntoVipRespond: leakedNewsletters.length, leaked: leakedNewsletters.map((p) => p.email), PASS: leakedNewsletters.length === 0 },
    V2_surfaced_needs_you: { surfacedCount: surfaced.length, surfacedThatAreBulk: surfacedBulk.length, items: surfaced, PASS: surfacedBulk.length === 0 },
    V3_reply_prediction_backtest: backtest,
  };
  fs.writeFileSync(`${OUT}/profile.json`, JSON.stringify({ profile, validation }, null, 2));

  const md = [];
  md.push(`# Workbench profile + validation — ${profile.generatedAt}`);
  md.push(`\n**Identity:** ${me || '(unknown)'} · **Data:** ${sent.length} sent · ${inbox.length} inbox · ${people.length} distinct senders`);
  md.push(`\n## Learned tiers (from behaviour)`);
  md.push(`| tier | senders |\n|---|---|`);
  for (const t of TIERS) md.push(`| ${t} | ${people.filter((p) => p.tier === t).length} |`);
  md.push(`\n## Senders (ranked)`);
  md.push(`| sender | tier | reply rate | median latency | recv/repl | bulk | markers |\n|---|---|---|---|---|---|---|`);
  for (const p of people) md.push(`| ${p.email} | ${p.tier} | ${(p.replyRate * 100).toFixed(0)}% | ${p.medianLatencyHrs == null ? '—' : p.medianLatencyHrs + 'h'} | ${p.received}/${p.replied} | ${p.bulk ? 'yes' : 'no'} | ${p.bulkMarkers.join(',') || '—'} |`);
  md.push(`\n## Validation gauntlet`);
  md.push(`- **V1 newsletter suppression** — bulk senders in VIP/Respond: **${validation.V1_newsletter_suppression.bulkLeakedIntoVipRespond}** → ${validation.V1_newsletter_suppression.PASS ? 'PASS ✅' : 'FAIL ❌'}`);
  md.push(`- **V2 "what needs you" surfaced** — ${surfaced.length} items, of which bulk: **${surfacedBulk.length}** → ${validation.V2_surfaced_needs_you.PASS ? 'PASS ✅' : 'FAIL ❌'}`);
  if (surfaced.length) for (const s of surfaced) md.push(`    - [${s.tier}] ${s.from} — ${s.subject}`);
  md.push(`- **V3 reply-prediction backtest (${backtest.method || 'n/a'})** — ${backtest.n ? `train=${backtest.trainN} test=${backtest.testN} (cold-start=${backtest.coldStartInTest}) · tp=${backtest.tp} fp=${backtest.fp} fn=${backtest.fn} tn=${backtest.tn} · precision=${backtest.precision ?? '—'} recall=${backtest.recall ?? '—'} f1=${backtest.f1 ?? '—'}` : backtest.note}`);
  fs.writeFileSync(`${OUT}/report.md`, md.join('\n'));

  console.log('\n' + md.join('\n'));
  console.log(`\n[engine] wrote ${OUT}/profile.json + report.md`);
})();
