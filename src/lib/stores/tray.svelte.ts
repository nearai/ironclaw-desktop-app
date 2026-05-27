// Tray menu event listeners.
//
// The Rust tray module (`src-tauri/src/tray.rs`) emits Tauri events when
// the user clicks an item in the menu-bar context menu:
//
//   - `tray:show-window`     → main window was just shown via the tray
//                              (left-click toggle or a menu item that
//                              focuses the app). Useful for surfaces
//                              that want to refresh on re-entry.
//   - `tray:show-settings`   → user picked "Open Settings".
//   - `tray:restart-sidecar` → user picked "Restart sidecar".
//
// This store mounts the listeners on first `init()` call from the root
// layout. Listeners are torn down on hot-reload (and on programmatic
// `destroy()`) so dev mode doesn't accumulate duplicates.
//
// Navigation + sidecar restart are delegated to the existing surfaces
// (`$app/navigation` + the connection store), so the tray stays a thin
// dispatcher. Anything heavier belongs in those callers.

import { goto } from '$app/navigation';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import { connection } from './connection.svelte';
import { notifications } from './notifications.svelte';
import { toasts } from './toasts.svelte';

class TrayStore {
  private mounted = false;
  private unlisteners: UnlistenFn[] = [];

  /**
   * Wire up the three tray-event listeners. Idempotent — safe to call
   * from any onMount path; subsequent calls are no-ops.
   *
   * Returns void on purpose so callers can `void tray.init()` without
   * awaiting; the underlying `listen` setup is fire-and-forget.
   */
  init(): void {
    if (this.mounted) return;
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      // Running outside the Tauri webview (e.g. `vite preview`) —
      // there's no tray, nothing to listen for. Mark as mounted so we
      // don't keep retrying on every layout remount.
      this.mounted = true;
      return;
    }
    this.mounted = true;
    void this.attach();
  }

  /** Detach all listeners. Mainly for symmetry / future tests; the
   *  default app shape never tears the layout down. */
  destroy(): void {
    for (const unlisten of this.unlisteners) {
      try {
        unlisten();
      } catch (err) {
        console.warn('tray: unlisten failed', err);
      }
    }
    this.unlisteners = [];
    this.mounted = false;
  }

  private async attach(): Promise<void> {
    try {
      const u1 = await listen('tray:show-settings', () => {
        void goto('/settings');
      });
      const u2 = await listen('tray:restart-sidecar', () => {
        void this.restartSidecar();
      });
      const u3 = await listen('tray:show-window', () => {
        // Rust already raised + focused the window; the layout's
        // focus effect will mark unseen notifications as seen too,
        // but we also fire it from here so the badge clears the
        // instant the user acts on the tray click (focusing the
        // window can lag the click on macOS by a frame or two on
        // cold paths). Idempotent.
        notifications.markAllSeen();
        void notifications.pushBadge();
      });
      this.unlisteners.push(u1, u2, u3);
    } catch (err) {
      // A failure here means tray events won't fire on the JS side —
      // degraded but not fatal. Surface once so it's visible during
      // dev without spamming on every reattach attempt.
      console.warn('tray: listener setup failed', err);
    }
  }

  private async restartSidecar(): Promise<void> {
    // Only meaningful in local mode — remote profiles don't have a
    // sidecar to restart. Toast feedback either way so the user sees
    // their menu click did something.
    if (connection.activeProfile.mode !== 'local') {
      toasts.show('Active profile is remote — nothing to restart', 'info');
      return;
    }
    try {
      await connection.stopSidecar();
      const ok = await connection.startSidecar();
      toasts.show(
        ok ? 'Sidecar restarted' : `Sidecar restart failed: ${connection.sidecarError ?? 'unknown'}`,
        ok ? 'success' : 'error'
      );
    } catch (err) {
      toasts.show(`Sidecar restart failed: ${(err as Error).message}`, 'error');
    }
  }
}

/** Global singleton — import this anywhere. */
export const tray = new TrayStore();
