// Desktop notification facade.
//
// Thin rune singleton wrapping `@tauri-apps/plugin-notification`. Three
// callers (chat reply / routine completion / sidecar exit) push through
// `notify()`; permission gating + the user's master toggle live here so
// each caller stays a one-liner.
//
// Persistence: the user-facing toggles (`enabled` plus three per-category
// switches, per-category sound choice, and the quiet-hours block) are
// mirrored to `localStorage` so preferences survive a relaunch. We
// deliberately don't route them through the Tauri settings.json blob —
// they're UI-only and the cost of resetting on a reinstall is zero.
//
// Sound selection: the front-end speaks in symbolic names ('tink',
// 'glass', etc.) and the resolver maps each to either the special
// 'default' keyword (OS picks the user's configured sound), `null`
// (silent), or an absolute path to a macOS system sound under
// `/System/Library/Sounds/`. Real custom assets land in
// `src-tauri/resources/sounds/` (see the README there); when they
// exist the SOUND_PATHS table below can be re-pointed at the bundled
// resources without touching the call sites.

import { invoke } from '@tauri-apps/api/core';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from '@tauri-apps/plugin-notification';

import { broadcast } from './broadcast.svelte';
import { windowFocus } from './window-focus.svelte';

export type NotifyPermission = 'default' | 'granted' | 'denied';

/** Categories that map to the three call sites + a generic 'error' chute. */
export type NotifyCategory = 'chat' | 'routine' | 'sidecar' | 'error';

/**
 * Symbolic sound names exposed to the UI. 'none' means silent;
 * 'default' lets the OS pick. The remaining six are the macOS system
 * sounds we surface in the dropdown — they map onto
 * `/System/Library/Sounds/<Name>.aiff`.
 */
export type SoundChoice =
  | 'none'
  | 'default'
  | 'tink'
  | 'frog'
  | 'glass'
  | 'pop'
  | 'submarine'
  | 'sosumi';

/** Ordered list of choices, useful for rendering the settings dropdowns. */
export const SOUND_CHOICES: ReadonlyArray<{ value: SoundChoice; label: string }> = [
  { value: 'none', label: 'None (silent)' },
  { value: 'default', label: 'System default' },
  { value: 'tink', label: 'Tink' },
  { value: 'frog', label: 'Frog' },
  { value: 'glass', label: 'Glass' },
  { value: 'pop', label: 'Pop' },
  { value: 'submarine', label: 'Submarine' },
  { value: 'sosumi', label: 'Sosumi' }
] as const;

/**
 * Resolve a symbolic choice to the value the tauri-plugin-notification
 * `sound` field accepts. The plugin treats `undefined` as "play whatever
 * the OS default is for the bundle"; we deliberately translate `'none'`
 * to `undefined` too — true silence requires muting the bundle in
 * System Settings, the plugin has no first-class silent mode. Symbolic
 * 'default' maps to the documented 'default' keyword.
 */
const SOUND_PATHS: Record<SoundChoice, string | undefined> = {
  none: undefined,
  default: 'default',
  tink: '/System/Library/Sounds/Tink.aiff',
  frog: '/System/Library/Sounds/Frog.aiff',
  glass: '/System/Library/Sounds/Glass.aiff',
  pop: '/System/Library/Sounds/Pop.aiff',
  submarine: '/System/Library/Sounds/Submarine.aiff',
  sosumi: '/System/Library/Sounds/Sosumi.aiff'
};

export interface NotifyOptions {
  title: string;
  body?: string;
  /** Path or remote URL. Defaults to the app icon. */
  icon?: string;
  /**
   * Which category this notification belongs to. Drives the per-category
   * enable check, the sound lookup, and quiet-hours filtering. Optional
   * for backward compatibility — when omitted we treat the notification
   * as already-gated by the caller and just respect the master toggle
   * + the OS 'default' sound.
   */
  category?: NotifyCategory;
  /**
   * Explicit override. When provided, bypasses the category-based sound
   * lookup. Useful for the settings "Preview" button which wants to
   * audition a specific sound without persisting a preference.
   */
  soundOverride?: SoundChoice;
  /**
   * Optional deep-link the tray "Recent notifications" submenu can use
   * when the user clicks the entry. Today the tray dispatcher routes
   * purely on `category` (chat → `/`, routine → `/routines`, sidecar →
   * `/settings`) so `link` is reserved for future per-notification
   * targets (e.g. "Routine X failed" → `/routines/<id>`).
   */
  link?: string;
}

/**
 * Persisted shape of a single entry in the rolling history surfaced by
 * the tray submenu. Mirrors the subset of `NotifyOptions` we want the
 * user to see + a timestamp + a stable id (used by the Rust side to
 * round-trip clicks back into JS).
 */
export interface NotificationHistoryEntry {
  id: string;
  title: string;
  body: string;
  category: NotifyCategory | undefined;
  /** Epoch ms when the notification fired. */
  ts: number;
  link?: string;
}

/** Quiet-hours window. `start` and `end` are 0-23. */
export interface QuietHours {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

const LS_KEY = 'ironclaw:notifications:v1';
/** Separate slot for the tray-history ring so prefs and history can be
 *  cleared independently (e.g. `clearHistory()` doesn't blow away
 *  sound choices or quiet-hours config). */
const LS_HISTORY_KEY = 'ironclaw-notification-history';

/** Rolling-window length for the unseen-notification badge. */
const RECENT_WINDOW_MS = 5 * 60 * 1000;

/** Re-evaluate the recent window once a minute so notifications drop off
 *  the count without waiting for a user-driven re-render. */
const RECENT_TICK_MS = 60 * 1000;

/** Hard cap on persisted history. Tray submenu surfaces a subset
 *  (`HISTORY_MENU_LIMIT`) but we keep a larger buffer so back-fill /
 *  scrollback (future) doesn't need a re-fetch. */
const HISTORY_MAX = 10;

/** How many entries we forward to the tray menu. Spec calls for 5. */
const HISTORY_MENU_LIMIT = 5;

/** Entries older than this are dropped on hydrate. Matches the spec
 *  "older than 24h auto-drop on init". */
const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;

interface PersistedPrefs {
  enabled: boolean;
  chatReplies: boolean;
  routineCompletions: boolean;
  sidecarEvents: boolean;
  chatReplySound: SoundChoice;
  routineSound: SoundChoice;
  sidecarSound: SoundChoice;
  errorSound: SoundChoice;
  quietHours: QuietHours;
  /** Badge counter on the menu-bar tray icon. Defaults to true. */
  trayBadgeEnabled: boolean;
}

const DEFAULT_PREFS: PersistedPrefs = {
  enabled: true,
  chatReplies: true,
  routineCompletions: true,
  sidecarEvents: true,
  chatReplySound: 'default',
  routineSound: 'default',
  sidecarSound: 'default',
  errorSound: 'default',
  quietHours: { enabled: false, startHour: 22, endHour: 7 },
  trayBadgeEnabled: true
};

/** Type guard so we don't trust raw JSON. */
function isSoundChoice(v: unknown): v is SoundChoice {
  return (
    typeof v === 'string' &&
    SOUND_CHOICES.some((c) => c.value === v)
  );
}

function loadPrefs(): PersistedPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<PersistedPrefs>;
    // Hand-merge so unknown sound values fall back to 'default' rather
    // than breaking the dropdown render with a value that's not in
    // SOUND_CHOICES.
    const qh = parsed.quietHours;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_PREFS.enabled,
      chatReplies:
        typeof parsed.chatReplies === 'boolean'
          ? parsed.chatReplies
          : DEFAULT_PREFS.chatReplies,
      routineCompletions:
        typeof parsed.routineCompletions === 'boolean'
          ? parsed.routineCompletions
          : DEFAULT_PREFS.routineCompletions,
      sidecarEvents:
        typeof parsed.sidecarEvents === 'boolean'
          ? parsed.sidecarEvents
          : DEFAULT_PREFS.sidecarEvents,
      chatReplySound: isSoundChoice(parsed.chatReplySound)
        ? parsed.chatReplySound
        : DEFAULT_PREFS.chatReplySound,
      routineSound: isSoundChoice(parsed.routineSound)
        ? parsed.routineSound
        : DEFAULT_PREFS.routineSound,
      sidecarSound: isSoundChoice(parsed.sidecarSound)
        ? parsed.sidecarSound
        : DEFAULT_PREFS.sidecarSound,
      errorSound: isSoundChoice(parsed.errorSound)
        ? parsed.errorSound
        : DEFAULT_PREFS.errorSound,
      quietHours:
        qh && typeof qh === 'object'
          ? {
              enabled: typeof qh.enabled === 'boolean' ? qh.enabled : false,
              startHour: clampHour(qh.startHour, DEFAULT_PREFS.quietHours.startHour),
              endHour: clampHour(qh.endHour, DEFAULT_PREFS.quietHours.endHour)
            }
          : { ...DEFAULT_PREFS.quietHours },
      // trayBadgeEnabled is opt-OUT — only an explicit `false` on disk
      // hides the badge. Older settings files that predate the field
      // round-trip as `true`, matching the new-install default.
      trayBadgeEnabled:
        typeof parsed.trayBadgeEnabled === 'boolean'
          ? parsed.trayBadgeEnabled
          : DEFAULT_PREFS.trayBadgeEnabled
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function clampHour(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  const n = Math.trunc(v);
  if (n < 0 || n > 23) return fallback;
  return n;
}

const CATEGORIES: ReadonlySet<NotifyCategory> = new Set([
  'chat',
  'routine',
  'sidecar',
  'error'
]);

function isCategory(v: unknown): v is NotifyCategory {
  return typeof v === 'string' && CATEGORIES.has(v as NotifyCategory);
}

/**
 * Parse + validate the on-disk history blob. Drops entries older than
 * `HISTORY_TTL_MS`, anything missing required fields, and trims to the
 * `HISTORY_MAX` cap. Returns a fresh array even when parsing fails —
 * the tray menu must always render something coherent.
 */
function loadHistory(): NotificationHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LS_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - HISTORY_TTL_MS;
    const cleaned: NotificationHistoryEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Partial<NotificationHistoryEntry>;
      if (typeof e.id !== 'string' || !e.id) continue;
      if (typeof e.title !== 'string') continue;
      if (typeof e.ts !== 'number' || !Number.isFinite(e.ts)) continue;
      if (e.ts < cutoff) continue;
      cleaned.push({
        id: e.id,
        title: e.title,
        body: typeof e.body === 'string' ? e.body : '',
        category: isCategory(e.category) ? e.category : undefined,
        ts: e.ts,
        link: typeof e.link === 'string' ? e.link : undefined
      });
    }
    // Most-recent first; cap so memory + IPC stays bounded.
    cleaned.sort((a, b) => b.ts - a.ts);
    return cleaned.slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Generate a short id for a history entry. Prefer `crypto.randomUUID()`
 * when available (every Tauri webview ships it; modern dev browsers
 * too) and fall back to a timestamp + random suffix for the test
 * environment / older shims. Stability matters: the Rust side echoes
 * the id back in the click event so we can find the entry's `link`.
 */
function makeNotificationId(): string {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Decide if the current hour falls inside a quiet-hours window. We
 * support overnight wraps (e.g. 22 → 7 means "anytime between 22:00
 * and 06:59 inclusive"). When start equals end we treat the window as
 * empty (no muting) — a 24-hour mute is what the master `enabled`
 * toggle is for.
 */
export function isInQuietHours(qh: QuietHours, now: Date = new Date()): boolean {
  if (!qh.enabled) return false;
  const hour = now.getHours();
  const { startHour, endHour } = qh;
  if (startHour === endHour) return false;
  if (startHour < endHour) {
    // Same-day window: [start, end).
    return hour >= startHour && hour < endHour;
  }
  // Overnight wrap: [start, 24) ∪ [0, end).
  return hour >= startHour || hour < endHour;
}

class NotificationStore {
  /** Cached OS permission. `default` until `ensurePermission()` is called. */
  permission = $state<NotifyPermission>('default');

  /** Master toggle. When false, `notify()` is a no-op regardless of category. */
  enabled = $state<boolean>(true);

  /** Per-category switches. Each caller checks its own flag. */
  chatReplies = $state<boolean>(true);
  routineCompletions = $state<boolean>(true);
  sidecarEvents = $state<boolean>(true);

  /** Per-category sound choice. */
  chatReplySound = $state<SoundChoice>('default');
  routineSound = $state<SoundChoice>('default');
  sidecarSound = $state<SoundChoice>('default');
  errorSound = $state<SoundChoice>('default');

  /** Quiet hours (DND). Defaults to disabled, 22:00 → 07:00. */
  quietHours = $state<QuietHours>({ enabled: false, startHour: 22, endHour: 7 });

  /**
   * Master switch for the menu-bar tray badge. When false, the icon
   * never shows a count regardless of how many unseen notifications are
   * in the rolling window. Defaults to true; persisted to localStorage
   * alongside the other notification prefs.
   */
  trayBadgeEnabled = $state<boolean>(true);

  /**
   * Timestamps (epoch ms) for notification triggers that landed while the
   * window was unfocused and inside the per-category enable rules. We
   * keep these instead of a single counter so the rolling 5-minute
   * window is computed cheaply on read — `unseenCount` filters this list
   * against `Date.now()`. Trimmed on every read so the array never grows
   * unbounded across a long-running session.
   */
  private triggers = $state<number[]>([]);

  /** Forces `unseenCount` to re-evaluate on a 1-minute interval so
   *  notifications drop out of the rolling window without waiting for
   *  the next fresh trigger. Incremented by the interval set up in
   *  `hydrate()`; consumed via `void recentTick` inside the derived
   *  count. */
  private recentTick = $state(0);

  /**
   * Unseen-notification count for the rolling window. Drives the badge
   * pushed to the Rust tray via `update_tray_badge`. Read-only from
   * outside the class — mutations go through `recordTrigger()` and
   * `markAllSeen()`.
   */
  unseenCount = $derived.by(() => {
    void this.recentTick; // re-evaluate on minute tick
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    return this.triggers.filter((t) => t >= cutoff).length;
  });

  /**
   * Rolling history of every notification we actually shipped to the OS.
   * Tracks *all* notifications regardless of unseen state — `markAllSeen`
   * intentionally does **not** touch this array (that resets the badge
   * counter, not the menu). Capped at `HISTORY_MAX`; the tray submenu
   * surfaces the first `HISTORY_MENU_LIMIT`.
   *
   * Most-recent first. Persisted to localStorage under
   * `LS_HISTORY_KEY` so the menu survives a relaunch; entries older
   * than `HISTORY_TTL_MS` are dropped on hydrate.
   */
  history = $state<NotificationHistoryEntry[]>([]);

  private hydrated = false;
  private permissionRequested = false;
  private recentTickHandle: ReturnType<typeof setInterval> | null = null;
  private badgePushInFlight = false;
  private badgePushQueued: number | null = null;
  /** Last value we pushed to Rust. Suppresses redundant IPC. */
  private lastPushedBadge = -1;
  /** Serializes tray-recent IPC the same way badge pushes are serialized
   *  — a burst of notify() calls during streaming chat shouldn't fan
   *  out into N concurrent menu rebuilds on the Rust side. */
  private trayRecentInFlight = false;
  private trayRecentQueued = false;

  /**
   * Read prefs out of localStorage. Idempotent — calling more than once
   * just reseeds the in-memory state from disk. Call from the layout
   * onMount so initial state matches what the user set last session.
   */
  hydrate() {
    if (this.hydrated || typeof window === 'undefined') return;
    const p = loadPrefs();
    this.enabled = p.enabled;
    this.chatReplies = p.chatReplies;
    this.routineCompletions = p.routineCompletions;
    this.sidecarEvents = p.sidecarEvents;
    this.chatReplySound = p.chatReplySound;
    this.routineSound = p.routineSound;
    this.sidecarSound = p.sidecarSound;
    this.errorSound = p.errorSound;
    this.quietHours = p.quietHours;
    this.trayBadgeEnabled = p.trayBadgeEnabled;
    // Rehydrate the tray-history ring + immediately push the seeded
    // values into the menu so the submenu shows last session's
    // notifications until a fresh trigger replaces them. If the load
    // returned a TTL-trimmed list, re-persist so the disk copy reflects
    // the cleanup; otherwise we keep writing the same expired entries
    // back on every notify().
    const seededHistory = loadHistory();
    this.history = seededHistory;
    if (seededHistory.length > 0) {
      this.persistHistory();
    }
    void this.pushTrayRecent();
    this.hydrated = true;
    // Mirror future writes back to disk. We do this lazily via an
    // explicit `persist()` call from setter helpers below so we don't
    // pay for a write on every rune read.

    // Rolling-window ticker: bump `recentTick` once a minute so
    // `unseenCount` re-evaluates and notifications drop off the badge
    // when their 5-minute slot expires. Idempotent — `hydrated` above
    // guarantees we only ever wire this once per session.
    this.recentTickHandle = setInterval(() => {
      // Trim before ticking so the array stays bounded across long
      // sessions. The derived `unseenCount` re-filters too — this is a
      // belt-and-braces cap on memory growth.
      const cutoff = Date.now() - RECENT_WINDOW_MS;
      this.triggers = this.triggers.filter((t) => t >= cutoff);
      this.recentTick++;
    }, RECENT_TICK_MS);
  }

  /**
   * Record an unseen notification trigger. Called from `notify()` when
   * the window is unfocused AND the category gate passed. The badge
   * count is a derived view of these timestamps inside the rolling
   * 5-minute window.
   */
  private recordTrigger(): void {
    this.triggers = [...this.triggers, Date.now()];
  }

  /**
   * Clear the unseen counter immediately. Called from the layout's
   * focus effect (`windowFocus.focused === true`) and from the
   * Rust-side `tray:show-window` listener when the user clicks the
   * tray icon to surface the app.
   *
   * `opts.broadcast` defaults to `true` so the normal call sites
   * (layout focus / tray listener) fan the clear out to every other
   * window — multi-window users get their unseen counter and tray
   * badge cleared everywhere at once. The cross-window broadcast
   * handler passes `false` so a received `notification-seen` does
   * not echo back onto the bus (belt-and-braces with the senderId
   * loop guard in broadcast.svelte.ts).
   */
  markAllSeen(opts: { broadcast?: boolean } = {}): void {
    if (this.triggers.length === 0) return;
    this.triggers = [];
    if (opts.broadcast !== false) {
      broadcast.send({ kind: 'notification-seen' });
    }
  }

  /**
   * Push the current badge count to the Rust tray. Idempotent — caches
   * the last value sent and short-circuits on repeats. When the toggle
   * is off we force a 0-push so any stale badge from a previous
   * "enabled" session is cleared immediately.
   *
   * The Rust side (tray.rs) composes a single (status, count) PNG from
   * a pre-rendered icon table — see `build_tray_icons.py`. Status is
   * tracked in Rust app state and updated independently by the
   * connection store's `update_tray_status` IPC, so this command only
   * carries the count half of the pair and the icon stays colour-stable
   * across badge pushes. The unified `update_status_and_count` command
   * is available for callers that have both pieces of state on hand.
   *
   * Serializes through `badgePushInFlight` so a burst of triggers
   * during streaming chat doesn't fan out into N concurrent IPC calls;
   * the latest pending value is held in `badgePushQueued` and fires
   * once the in-flight call resolves.
   */
  async pushBadge(): Promise<void> {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      return;
    }
    const target = this.trayBadgeEnabled ? this.unseenCount : 0;
    if (target === this.lastPushedBadge) return;
    if (this.badgePushInFlight) {
      this.badgePushQueued = target;
      return;
    }
    this.badgePushInFlight = true;
    try {
      await invoke('update_tray_badge', { count: target });
      this.lastPushedBadge = target;
    } catch (err) {
      // Tray IPC failure is non-fatal — the badge is decorative chrome.
      // Reset the cache so the next push retries from scratch.
      this.lastPushedBadge = -1;
      console.warn('update_tray_badge failed', err);
    } finally {
      this.badgePushInFlight = false;
      if (this.badgePushQueued !== null) {
        const queued = this.badgePushQueued;
        this.badgePushQueued = null;
        // Only re-fire if the queued value still differs from what we
        // last pushed — avoids a noop round-trip when the queue
        // resolved to the same target we already sent.
        if (queued !== this.lastPushedBadge) {
          void this.pushBadge();
        }
      }
    }
  }

  /**
   * Append a fresh entry to the history ring, trim to `HISTORY_MAX`,
   * persist, then refresh the tray menu. Called from `notify()` for
   * every notification that cleared the gating checks AND is not a
   * sound preview / soundOverride. Quiet-hours and silent notifications
   * are excluded by the caller (see `notify()` for the exact rule).
   */
  private recordHistory(entry: NotificationHistoryEntry): void {
    // Newest-first; cap at HISTORY_MAX so the array never grows past
    // 10. Slice rather than mutate so Svelte's rune dependency tracking
    // picks up the change.
    this.history = [entry, ...this.history].slice(0, HISTORY_MAX);
    this.persistHistory();
    void this.pushTrayRecent();
  }

  /**
   * Drop all history. Exposed to the UI (and the Rust tray "Clear all"
   * menu item via the `tray:clear-notifications` event) so the user can
   * empty the submenu without waiting for the 24h TTL. Does **not**
   * clear the unseen badge — that's `markAllSeen`'s job.
   */
  clearHistory(): void {
    if (this.history.length === 0) {
      // Still push so the tray menu reflects the empty state when this
      // is called against a freshly-cleared session (e.g. via the
      // "Clear all" menu item firing twice). pushTrayRecent short-circuits
      // when the last push was also empty, so this is cheap.
      void this.pushTrayRecent();
      return;
    }
    this.history = [];
    this.persistHistory();
    void this.pushTrayRecent();
  }

  /** Persist the history ring to its own localStorage slot. */
  private persistHistory(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(this.history));
    } catch {
      // Storage may be full or disabled; the menu degrades to
      // session-only without crashing.
    }
  }

  /**
   * Push the current top-N history entries to the Rust tray. Body is
   * trimmed to a single line so the menu doesn't wrap awkwardly; full
   * body lives in the notification banner / future detail surface.
   * Serializes via `trayRecentInFlight` so a burst doesn't fan out
   * into concurrent menu rebuilds.
   */
  async pushTrayRecent(): Promise<void> {
    if (!inTauri()) return;
    if (this.trayRecentInFlight) {
      this.trayRecentQueued = true;
      return;
    }
    this.trayRecentInFlight = true;
    try {
      const items = this.history.slice(0, HISTORY_MENU_LIMIT).map((e) => ({
        id: e.id,
        title: e.title,
        // Collapse newlines + trim so the macOS menu renderer doesn't
        // see embedded `\n` (it would render as a literal escape).
        body: e.body.replace(/\s+/g, ' ').trim()
      }));
      await invoke('update_tray_recent', { items });
    } catch (err) {
      // Tray IPC failure is non-fatal — the submenu is decorative.
      console.warn('update_tray_recent failed', err);
    } finally {
      this.trayRecentInFlight = false;
      if (this.trayRecentQueued) {
        this.trayRecentQueued = false;
        void this.pushTrayRecent();
      }
    }
  }

  /** Persist the current prefs to localStorage. */
  persist() {
    if (typeof window === 'undefined') return;
    const payload: PersistedPrefs = {
      enabled: this.enabled,
      chatReplies: this.chatReplies,
      routineCompletions: this.routineCompletions,
      sidecarEvents: this.sidecarEvents,
      chatReplySound: this.chatReplySound,
      routineSound: this.routineSound,
      sidecarSound: this.sidecarSound,
      errorSound: this.errorSound,
      quietHours: { ...this.quietHours },
      trayBadgeEnabled: this.trayBadgeEnabled
    };
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch {
      // Storage may be full or disabled; non-fatal — prefs are
      // best-effort and the user can re-set them next launch.
    }
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    this.persist();
  }

  setChatReplies(v: boolean) {
    this.chatReplies = v;
    this.persist();
  }

  setRoutineCompletions(v: boolean) {
    this.routineCompletions = v;
    this.persist();
  }

  setSidecarEvents(v: boolean) {
    this.sidecarEvents = v;
    this.persist();
  }

  setChatReplySound(v: SoundChoice) {
    this.chatReplySound = v;
    this.persist();
  }

  setRoutineSound(v: SoundChoice) {
    this.routineSound = v;
    this.persist();
  }

  setSidecarSound(v: SoundChoice) {
    this.sidecarSound = v;
    this.persist();
  }

  setErrorSound(v: SoundChoice) {
    this.errorSound = v;
    this.persist();
  }

  setQuietHoursEnabled(v: boolean) {
    this.quietHours = { ...this.quietHours, enabled: v };
    this.persist();
  }

  setQuietHoursStart(v: number) {
    this.quietHours = { ...this.quietHours, startHour: clampHour(v, this.quietHours.startHour) };
    this.persist();
  }

  setQuietHoursEnd(v: number) {
    this.quietHours = { ...this.quietHours, endHour: clampHour(v, this.quietHours.endHour) };
    this.persist();
  }

  /**
   * Resolve a category to the user's chosen sound. Returns the symbolic
   * choice; pair with `soundPathFor()` to get the value the plugin
   * accepts. Defaults to 'default' when no category is provided — same
   * behaviour as the legacy `sound: 'default'` callers.
   */
  soundFor(category: NotifyCategory | undefined): SoundChoice {
    switch (category) {
      case 'chat':
        return this.chatReplySound;
      case 'routine':
        return this.routineSound;
      case 'sidecar':
        return this.sidecarSound;
      case 'error':
        return this.errorSound;
      default:
        return 'default';
    }
  }

  /** Per-category enable check. Errors share the master toggle only. */
  private categoryEnabled(category: NotifyCategory | undefined): boolean {
    switch (category) {
      case 'chat':
        return this.chatReplies;
      case 'routine':
        return this.routineCompletions;
      case 'sidecar':
        return this.sidecarEvents;
      // 'error' bypasses the per-category gate — if you opted in to
      // notifications at all you want to hear about errors.
      case 'error':
      default:
        return true;
    }
  }

  /**
   * Ask the OS once. Subsequent calls short-circuit on the cached state
   * unless permission is still `default` (i.e. the previous request was
   * dismissed without an answer).
   *
   * Returns true if we currently hold permission.
   */
  async ensurePermission(): Promise<boolean> {
    if (!inTauri()) {
      // Browser dev mode — pretend we're granted so design work isn't
      // gated on the OS dialog. Real permissions enforce on a Tauri build.
      this.permission = 'granted';
      return true;
    }
    try {
      const granted = await isPermissionGranted();
      if (granted) {
        this.permission = 'granted';
        return true;
      }
      // Hold the dialog to one request per app launch — the OS won't
      // re-prompt automatically and spamming `request` would noop anyway.
      if (this.permissionRequested) {
        // Re-read in case the user toggled it via System Settings while
        // the app was running.
        const recheck = await isPermissionGranted();
        this.permission = recheck ? 'granted' : 'denied';
        return recheck;
      }
      this.permissionRequested = true;
      const result = await requestPermission();
      // Plugin's PermissionState returns 'granted' | 'denied' | 'default'.
      this.permission = (result as NotifyPermission) ?? 'default';
      return this.permission === 'granted';
    } catch (err) {
      console.warn('notification permission probe failed', err);
      this.permission = 'denied';
      return false;
    }
  }

  /**
   * Fire a notification. No-ops when the master toggle is off, when we
   * don't hold OS permission, or when we're outside the Tauri runtime.
   *
   * When a `category` is provided we additionally enforce:
   *   - the per-category enable flag (chatReplies / routineCompletions /
   *     sidecarEvents);
   *   - the quiet-hours window — during quiet hours we still show the
   *     banner but force the sound to `'none'` so the user gets the
   *     visual cue without the audible one.
   *
   * Callers that pass no category (legacy) still get the master toggle
   * + OS-default sound, matching pre-v1 behaviour.
   */
  async notify(opts: NotifyOptions): Promise<void> {
    if (!this.enabled) return;
    if (!this.categoryEnabled(opts.category)) return;
    if (!inTauri()) return;
    const ok = await this.ensurePermission();
    if (!ok) return;

    // Pick the sound: explicit override > category preference > 'default'.
    let choice: SoundChoice = opts.soundOverride ?? this.soundFor(opts.category);
    // Quiet hours: keep the banner, drop the sound.
    if (!opts.soundOverride && isInQuietHours(this.quietHours)) {
      choice = 'none';
    }
    const sound = SOUND_PATHS[choice];

    try {
      sendNotification({
        title: opts.title,
        body: opts.body,
        icon: opts.icon,
        // `sound` on the Options type is a string (OS sound name or path)
        // or undefined. We pre-resolved that in SOUND_PATHS.
        sound
      });
    } catch (err) {
      console.warn('sendNotification failed', err);
    }

    // History accounting. We track every notification that actually
    // shipped (i.e. cleared gating + permission + Tauri runtime checks)
    // and is NOT a sound-preview / in-app override AND not silenced by
    // the quiet-hours mute (the latter means the user explicitly opted
    // out of audible alerts for this window; surfacing them in the tray
    // menu still respects that, but spec says skip them). `silent` here
    // is the `choice === 'none'` resolution above; we recompute against
    // `sound` since `choice` may have been mutated by the quiet-hours
    // branch already.
    const silent = sound === undefined;
    const inQuiet = !opts.soundOverride && isInQuietHours(this.quietHours);
    if (!opts.soundOverride && !inQuiet && !silent) {
      this.recordHistory({
        id: makeNotificationId(),
        title: opts.title,
        body: opts.body ?? '',
        category: opts.category,
        ts: Date.now(),
        link: opts.link
      });
    }

    // Badge accounting. We only count notifications that fired while the
    // window was unfocused — when the user is looking at IronClaw the
    // banner is already enough acknowledgement, and a "you have 1
    // unread" badge after a chat reply you watched stream in would be
    // noisy. `soundOverride` is the in-app preview path (settings →
    // sound preview button + test notification); those never count.
    if (!opts.soundOverride && !windowFocus.focused) {
      this.recordTrigger();
      void this.pushBadge();
    }
  }

  /** Setter for the badge master toggle. Persists + pushes immediately
   *  so the icon reflects the change without waiting for the next
   *  trigger. */
  setTrayBadgeEnabled(v: boolean) {
    this.trayBadgeEnabled = v;
    this.persist();
    void this.pushBadge();
  }
}

/** Global singleton — import this anywhere. */
export const notifications = new NotificationStore();
