// Tests for the notifications store. Two pure surfaces exercised:
//
//   1. `isInQuietHours` — exported helper, no rune state, just the
//      hour-math (overnight wrap, disabled toggle, start==end edge).
//
//   2. The `notifications` rune singleton's setters + the
//      `unseenCount` / `markAllSeen` plumbing. We poke `triggers`
//      indirectly through a manual rune-level mutation (the
//      `recordTrigger` path is private but the only public
//      accumulator — `notify()` — pulls in the Tauri permission
//      probe, which we don't want to fight here).
//
//   3. Cross-window broadcast on `markAllSeen` — we spy on the
//      `broadcast` singleton's `send()` and assert the right kind
//      lands on the bus.
//
// Vitest 4's localStorage shim is patched per-file (see the pins
// test for the same trick); the notifications module reads/writes
// under `ironclaw:notifications:v1` via `persist()`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isInQuietHours, notifications } from './notifications.svelte';
import { broadcast } from './broadcast.svelte';
import { windowFocus } from './window-focus.svelte';

function installLocalStorageShim() {
  const store = new Map<string, string>();
  const shim = {
    get length() {
      return store.size;
    },
    key(i: number) {
      return Array.from(store.keys())[i] ?? null;
    },
    getItem(k: string) {
      return store.has(k) ? (store.get(k) as string) : null;
    },
    setItem(k: string, v: string) {
      store.set(String(k), String(v));
    },
    removeItem(k: string) {
      store.delete(k);
    },
    clear() {
      store.clear();
    }
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: shim });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: shim });
  }
}

/** Quiet-hours block. Hour 12 (noon) is the neutral fixed point. */
function qh(enabled: boolean, startHour: number, endHour: number) {
  return { enabled, startHour, endHour };
}

function atHour(h: number): Date {
  const d = new Date(2026, 0, 15, h, 0, 0);
  return d;
}

describe('isInQuietHours', () => {
  it('returns false when the block is disabled', () => {
    expect(isInQuietHours(qh(false, 22, 7), atHour(23))).toBe(false);
    expect(isInQuietHours(qh(false, 22, 7), atHour(5))).toBe(false);
  });

  it('handles an overnight window (22 → 7)', () => {
    // 23:00 is inside [22, 24) part of the wrap.
    expect(isInQuietHours(qh(true, 22, 7), atHour(23))).toBe(true);
    // 05:00 is inside [0, 7) part of the wrap.
    expect(isInQuietHours(qh(true, 22, 7), atHour(5))).toBe(true);
  });

  it('returns false outside an overnight window', () => {
    expect(isInQuietHours(qh(true, 22, 7), atHour(12))).toBe(false);
    // 21:59 is just before the start.
    expect(isInQuietHours(qh(true, 22, 7), atHour(21))).toBe(false);
    // 07:00 is the exclusive end.
    expect(isInQuietHours(qh(true, 22, 7), atHour(7))).toBe(false);
  });

  it('handles a same-day window (9 → 17)', () => {
    expect(isInQuietHours(qh(true, 9, 17), atHour(12))).toBe(true);
    expect(isInQuietHours(qh(true, 9, 17), atHour(8))).toBe(false);
    // 17:00 is the exclusive end.
    expect(isInQuietHours(qh(true, 9, 17), atHour(17))).toBe(false);
  });

  it('treats start == end as an empty window (use master toggle for 24h mute)', () => {
    expect(isInQuietHours(qh(true, 0, 0), atHour(12))).toBe(false);
    expect(isInQuietHours(qh(true, 12, 12), atHour(12))).toBe(false);
    expect(isInQuietHours(qh(true, 22, 22), atHour(22))).toBe(false);
  });
});

describe('notifications store — quiet-hours setters', () => {
  beforeEach(() => {
    installLocalStorageShim();
    // Reseed the relevant state so cases don't leak.
    notifications.setQuietHoursEnabled(true);
    notifications.setQuietHoursStart(22);
    notifications.setQuietHoursEnd(7);
  });

  afterEach(() => {
    notifications.setQuietHoursEnabled(false);
    notifications.setQuietHoursStart(22);
    notifications.setQuietHoursEnd(7);
  });

  it('setQuietHoursStart + setQuietHoursEnd compose into the same wrap window', () => {
    notifications.setQuietHoursStart(22);
    notifications.setQuietHoursEnd(7);
    expect(notifications.quietHours).toEqual({ enabled: true, startHour: 22, endHour: 7 });
    expect(isInQuietHours(notifications.quietHours, atHour(23))).toBe(true);
    expect(isInQuietHours(notifications.quietHours, atHour(5))).toBe(true);
    expect(isInQuietHours(notifications.quietHours, atHour(12))).toBe(false);
  });

  it('persists quiet-hours setters to localStorage under the prefs blob', () => {
    notifications.setQuietHoursStart(23);
    notifications.setQuietHoursEnd(6);
    const raw = localStorage.getItem('ironclaw:notifications:v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as {
      quietHours: { enabled: boolean; startHour: number; endHour: number };
    };
    expect(parsed.quietHours.startHour).toBe(23);
    expect(parsed.quietHours.endHour).toBe(6);
  });
});

describe('notifications store — unseenCount + markAllSeen', () => {
  beforeEach(() => {
    installLocalStorageShim();
    // Wipe any latent triggers from prior describes. The field is
    // private but svelte runes leave the property visible on the
    // instance; we cast through `any` for the reset.
    (notifications as unknown as { triggers: number[] }).triggers = [];
  });

  afterEach(() => {
    (notifications as unknown as { triggers: number[] }).triggers = [];
    vi.restoreAllMocks();
  });

  it('unseenCount reflects recorded triggers within the rolling window', () => {
    const now = Date.now();
    (notifications as unknown as { triggers: number[] }).triggers = [now, now - 1000, now - 2000];
    expect(notifications.unseenCount).toBe(3);
  });

  it('unseenCount drops triggers older than the rolling 5-minute window', () => {
    const now = Date.now();
    const sixMinAgo = now - 6 * 60 * 1000;
    (notifications as unknown as { triggers: number[] }).triggers = [now, sixMinAgo];
    expect(notifications.unseenCount).toBe(1);
  });

  it('markAllSeen() resets the count and emits a broadcast', () => {
    const now = Date.now();
    (notifications as unknown as { triggers: number[] }).triggers = [now, now - 500];
    expect(notifications.unseenCount).toBe(2);

    const sendSpy = vi.spyOn(broadcast, 'send').mockImplementation(() => {});
    notifications.markAllSeen();
    expect(notifications.unseenCount).toBe(0);
    expect(sendSpy).toHaveBeenCalledWith({ kind: 'notification-seen' });
  });

  it('markAllSeen({ broadcast: false }) clears without emitting', () => {
    (notifications as unknown as { triggers: number[] }).triggers = [Date.now()];
    const sendSpy = vi.spyOn(broadcast, 'send').mockImplementation(() => {});
    notifications.markAllSeen({ broadcast: false });
    expect(notifications.unseenCount).toBe(0);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('markAllSeen() is a no-op (no broadcast) when there is nothing to clear', () => {
    (notifications as unknown as { triggers: number[] }).triggers = [];
    const sendSpy = vi.spyOn(broadcast, 'send').mockImplementation(() => {});
    notifications.markAllSeen();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('windowFocus singleton exists with a focused boolean (consumed by notify())', () => {
    // Sanity guard for the consumer surface — `notify()` reads
    // `windowFocus.focused` and only records triggers when unfocused.
    expect(typeof windowFocus.focused).toBe('boolean');
  });
});
