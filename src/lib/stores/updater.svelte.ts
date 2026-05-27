// Auto-updater store, backed by @tauri-apps/plugin-updater.
//
// Wraps the JS plugin in a rune-based singleton so the layout banner and
// the settings page can share one source of truth. The Rust side just
// registers the plugin in `src-tauri/src/lib.rs` — all interaction
// happens here.
//
// Lifecycle:
//   idle      → nothing in flight
//   checking  → calling check()
//   available → an Update is in-hand, awaiting user consent
//   downloading → downloadAndInstall() in flight, `progress` is 0-100
//   installing  → bytes written, swap in progress
//   up-to-date  → check succeeded but no update
//   error       → any failure; `error` holds the message
//
// Notes on signing: the Tauri updater refuses to install bundles whose
// signature does not validate against `plugins.updater.pubkey` in
// tauri.conf.json. We ship with an empty pubkey by default (see TODO in
// `src-tauri/src/lib.rs`), which means `check()` itself will fail with a
// clear error rather than silently downloading an unsigned bundle. The
// error surfaces in the banner so the user sees something concrete.

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'up-to-date'
  | 'error';

export interface UpdateInfo {
  version: string;
  notes?: string;
  date?: string;
}

// The plugin's Update object is opaque to us — we just need its
// `downloadAndInstall` method. Keeping it off the reactive surface so
// runes don't try to proxy a non-serializable object.
let pendingUpdate: { downloadAndInstall: (cb: (e: any) => void) => Promise<void> } | null = null;

class UpdaterStore {
  status = $state<UpdaterStatus>('idle');
  update = $state<UpdateInfo | null>(null);
  error = $state<string | null>(null);
  /** 0-100 during 'downloading'; null otherwise. */
  progress = $state<number | null>(null);

  /**
   * One-shot check. Safe to call from layout mount — errors are captured
   * to `error` but never thrown, so a missing pubkey or network blip
   * won't kill the launch path. If an update is found, status flips to
   * `available` and `update` is populated.
   */
  async check(): Promise<void> {
    this.status = 'checking';
    this.error = null;
    this.progress = null;
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const result = await check();
      if (result) {
        pendingUpdate = result as unknown as typeof pendingUpdate;
        // `result.date` may be an RFC3339 string or undefined depending
        // on the manifest. Surface as-is; the UI just renders.
        this.update = {
          version: result.version,
          notes: result.body ?? undefined,
          date: result.date ?? undefined
        };
        this.status = 'available';
      } else {
        pendingUpdate = null;
        this.update = null;
        this.status = 'up-to-date';
      }
    } catch (err) {
      pendingUpdate = null;
      this.status = 'error';
      this.error = (err as Error).message ?? String(err);
    }
  }

  /**
   * Download + write the update bundle. Tracks progress via the plugin's
   * event stream. On success, status moves to `installing`; the user
   * must restart the app manually to apply.
   */
  async download(): Promise<void> {
    if (!pendingUpdate) {
      this.status = 'error';
      this.error = 'No update available to download. Run check() first.';
      return;
    }
    this.status = 'downloading';
    this.error = null;
    this.progress = 0;
    let downloaded = 0;
    let contentLength = 0;
    try {
      await pendingUpdate.downloadAndInstall((event: any) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data?.contentLength ?? 0;
            this.progress = 0;
            break;
          case 'Progress':
            downloaded += event.data?.chunkLength ?? 0;
            if (contentLength > 0) {
              this.progress = Math.min(100, Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            this.progress = 100;
            this.status = 'installing';
            break;
        }
      });
      // downloadAndInstall resolves after the install completes. On
      // macOS the new bundle is in place but the user still has to
      // restart the running app — keep `installing` so the banner
      // renders the restart prompt.
      this.status = 'installing';
      this.progress = 100;
    } catch (err) {
      this.status = 'error';
      this.error = (err as Error).message ?? String(err);
      this.progress = null;
    }
  }

  /**
   * Convenience for one-tap "Install now" — alias of `download()` since
   * the plugin's downloadAndInstall handles both phases.
   */
  async install(): Promise<void> {
    return this.download();
  }

  /**
   * Dismiss the banner without forgetting the pending update. Useful for
   * "Later" — re-checking can be triggered manually from settings.
   */
  dismiss(): void {
    if (this.status === 'available' || this.status === 'up-to-date' || this.status === 'error') {
      this.status = 'idle';
      this.error = null;
    }
  }
}

/** Global singleton — import anywhere. */
export const updater = new UpdaterStore();
