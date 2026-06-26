// Behaviour-profile core for the "You" surface.
//
// Learns how the user works from their own mail — who they reply to, how fast,
// who they ignore (newsletters) — exactly the signals the validated standalone
// engine (scripts/workbench-profile-engine.mjs) uses, but as a pure, tested
// frontend module the "You" surface renders. No I/O here: callers pass already-
// read, normalized messages. Output is metadata only (sender + counts), never
// message bodies.
//
// Input message shape (defensive — missing fields degrade, never throw):
//   sent:  [{ threadId, timestamp }]                          // the user's sent mail
//   inbox: [{ threadId, timestamp, email|fromEmail|sender, isBulk, important }]

const HOUR_MS = 3.6e6;

function emailOf(message) {
  const raw = String(
    (message && (message.email || message.fromEmail || message.sender)) || ''
  ).trim();
  const bracket = raw.match(/<\s*([^<>@\s]+@[^<>@\s]+)\s*>/);
  if (bracket) return bracket[1].toLowerCase();
  const bare = raw.match(/[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+/);
  return (bare ? bare[0] : raw).toLowerCase();
}

function timeMs(value) {
  const t = Date.parse(String(value || ''));
  return Number.isFinite(t) ? t : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const TIER_RANK = { vip: 3, respond: 2, fyi: 1, ignore: 0 };

// Tier rubric — identical to the validated standalone engine:
//   bulk + barely-replied   → ignore (newsletters never need you)
//   human, replied a lot+fast → vip
//   human, replied >=30%      → respond
//   else                      → fyi
function tierFor({ bulk, replyRate, received, medianLatencyMs }) {
  if (bulk && replyRate < 0.2) return 'ignore';
  if (
    !bulk &&
    replyRate >= 0.6 &&
    received >= 2 &&
    medianLatencyMs != null &&
    medianLatencyMs < 6 * HOUR_MS
  )
    return 'vip';
  if (!bulk && replyRate >= 0.3) return 'respond';
  return 'fyi';
}

export function computeBehaviourProfile({ sent = [], inbox = [] } = {}) {
  const sentList = Array.isArray(sent) ? sent : [];
  const inboxList = Array.isArray(inbox) ? inbox : [];

  // threadId -> sorted sent timestamps (when the user wrote in that thread).
  const sentThreads = new Map();
  for (const message of sentList) {
    const id = message && (message.threadId || message.thread_id);
    const t = timeMs(message && message.timestamp);
    if (!id || t == null) continue;
    if (!sentThreads.has(id)) sentThreads.set(id, []);
    sentThreads.get(id).push(t);
  }

  const bySender = new Map();
  for (const message of inboxList) {
    const email = emailOf(message);
    if (!email) continue;
    if (!bySender.has(email)) {
      bySender.set(email, {
        email,
        received: 0,
        replied: 0,
        latencies: [],
        bulk: false,
        important: false,
        lastSeen: 0
      });
    }
    const agg = bySender.get(email);
    agg.received += 1;
    if (message.isBulk) agg.bulk = true;
    if (message.important) agg.important = true;
    const received = timeMs(message.timestamp);
    if (received != null && received > agg.lastSeen) agg.lastSeen = received;
    const sentTimes = sentThreads.get(message.threadId || message.thread_id);
    if (sentTimes && received != null) {
      const after = sentTimes.filter((t) => t > received);
      if (after.length) {
        agg.replied += 1;
        agg.latencies.push(Math.min(...after) - received);
      }
    }
  }

  const people = [];
  for (const agg of bySender.values()) {
    const replyRate = agg.received ? agg.replied / agg.received : 0;
    const medianLatencyMs = median(agg.latencies);
    const tier = tierFor({ bulk: agg.bulk, replyRate, received: agg.received, medianLatencyMs });
    people.push({
      email: agg.email,
      tier,
      replyRate: Math.round(replyRate * 100) / 100,
      medianLatencyHrs:
        medianLatencyMs == null ? null : Math.round((medianLatencyMs / HOUR_MS) * 10) / 10,
      received: agg.received,
      replied: agg.replied,
      bulk: agg.bulk,
      important: agg.important,
      lastSeen: agg.lastSeen ? new Date(agg.lastSeen).toISOString() : null
    });
  }
  people.sort(
    (a, b) =>
      TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.replyRate - a.replyRate || b.received - a.received
  );

  const counts = { senders: people.length, vip: 0, respond: 0, fyi: 0, ignore: 0, bulk: 0 };
  for (const person of people) {
    counts[person.tier] += 1;
    if (person.bulk) counts.bulk += 1;
  }

  // Plain-language observations, only when the evidence supports them.
  const patterns = [];
  const vips = people.filter((p) => p.tier === 'vip');
  if (vips.length) {
    const fastest = vips
      .filter((p) => p.medianLatencyHrs != null)
      .sort((a, b) => a.medianLatencyHrs - b.medianLatencyHrs)[0];
    patterns.push(
      fastest
        ? `You reply fastest to ${fastest.email} (~${fastest.medianLatencyHrs}h).`
        : `You reply quickly to ${vips.length} ${vips.length === 1 ? 'person' : 'people'}.`
    );
  }
  if (counts.bulk)
    patterns.push(
      `${counts.bulk} bulk sender${counts.bulk === 1 ? '' : 's'} are auto-filed — never surfaced as needing you.`
    );
  const respondCount = counts.respond + counts.vip;
  if (respondCount)
    patterns.push(
      `${respondCount} ${respondCount === 1 ? 'person' : 'people'} you reliably respond to.`
    );

  return { people, counts, patterns };
}
