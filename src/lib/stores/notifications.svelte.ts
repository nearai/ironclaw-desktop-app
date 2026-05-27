// Desktop notification facade.
//
// Thin rune singleton wrapping `@tauri-apps/plugin-notification`. Three
// callers (chat reply / routine completion / sidecar exit) push through
// `notify()`; permission gating + the user's master toggle live here so
// each caller stays a one-liner.
//
// Persistence: the user-facing toggles (`enabled` plus three per-category
// switches) are mirrored to `localStorage` so preferences survive a
// relaunch. We deliberately don't route them through the Tauri
// settings.json blob — they're UI-only and the cost of resetting on a
// reinstall is zero.

import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from '@tauri-apps/plugin-notification';

export type NotifyPermission = 'default' | 'granted' | 'denied';

export interface NotifyOptions {
  title: string;
  body?: string;
  /** Path or remote URL. Defaults to the app icon. */
  icon?: string;
  /** macOS plays the default sound when 'default', stays silent otherwise. */
  sound?: 'default' | null;
}

const LS_KEY = 'ironclaw:notifications:v1';

interface PersistedPrefs {
  enabled: boolean;
  chatReplies: boolean;
  routineCompletions: boolean;
  sidecarEvents: boolean;
}

const DEFAULT_PREFS: PersistedPrefs = {
  enabled: true,
  chatReplies: true,
  routineCompletions: true,
  sidecarEvents: true
};

function loadPrefs(): PersistedPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<PersistedPrefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
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

  private hydrated = false;
  private permissionRequested = false;

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
    this.hydrated = true;
    // Mirror future writes back to disk. We do this lazily via an
    // explicit `persist()` call from setter helpers below so we don't
    // pay for a write on every rune read.
  }

  /** Persist the current prefs to localStorage. */
  persist() {
    if (typeof window === 'undefined') return;
    const payload: PersistedPrefs = {
      enabled: this.enabled,
      chatReplies: this.chatReplies,
      routineCompletions: this.routineCompletions,
      sidecarEvents: this.sidecarEvents
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
   * Callers are expected to short-circuit on their per-category flag
   * BEFORE calling this — the store-level `enabled` is the master kill
   * switch, not a substitute for category gating.
   */
  async notify(opts: NotifyOptions): Promise<void> {
    if (!this.enabled) return;
    if (!inTauri()) return;
    const ok = await this.ensurePermission();
    if (!ok) return;
    try {
      sendNotification({
        title: opts.title,
        body: opts.body,
        icon: opts.icon,
        // `sound` on the Options type is `string` (the OS sound name) or
        // omitted. We translate 'default' to the macOS default keyword
        // and `null` / undefined to "no sound override" (the default
        // sound still plays unless the user mutes the bundle).
        sound: opts.sound === 'default' ? 'default' : undefined
      });
    } catch (err) {
      console.warn('sendNotification failed', err);
    }
  }
}

/** Global singleton — import this anywhere. */
export const notifications = new NotificationStore();
