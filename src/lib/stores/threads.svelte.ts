// Thread list + current-thread selection for the chat surface.
//
// Uses Svelte 5 runes — singleton instance imported as `threads`. Wraps the
// /api/chat/threads endpoint via the connection-store's client. The chat page
// is responsible for calling `init()` once and `refresh()` after any mutation
// (send, new thread, rename) so the sidebar list stays current.

import type { Thread } from '$lib/api/types';
import { connection } from './connection.svelte';

class ThreadStore {
  threads = $state<Thread[]>([]);
  currentId = $state<string | null>(null);
  loading = $state<boolean>(false);
  error = $state<string | null>(null);

  /** Sorted by updated_at desc — what the left rail renders. */
  sorted = $derived(
    [...this.threads].sort((a, b) => {
      const ta = a.updated_at ? Date.parse(a.updated_at) : 0;
      const tb = b.updated_at ? Date.parse(b.updated_at) : 0;
      return tb - ta;
    })
  );

  current = $derived<Thread | null>(
    this.currentId ? this.threads.find((t) => t.id === this.currentId) ?? null : null
  );

  async loadThreads(): Promise<void> {
    if (!connection.client) {
      this.threads = [];
      return;
    }
    this.loading = true;
    this.error = null;
    try {
      this.threads = await connection.client.listThreads();
      // If the previously-selected thread is gone, drop the selection so the
      // composer auto-creates on next send rather than 404'ing.
      if (this.currentId && !this.threads.some((t) => t.id === this.currentId)) {
        this.currentId = null;
      }
    } catch (err) {
      this.error = (err as Error).message;
      this.threads = [];
    } finally {
      this.loading = false;
    }
  }

  /** Alias of loadThreads; reads as intent in caller code. */
  async refresh(): Promise<void> {
    await this.loadThreads();
  }

  selectThread(id: string | null): void {
    this.currentId = id;
  }

  /**
   * Create a new server-side thread, refresh, and select it. Returns the new
   * thread id so the caller can immediately send a message into it.
   */
  async createThread(title?: string): Promise<string | null> {
    if (!connection.client) return null;
    try {
      const { id } = await connection.client.newThread(title);
      if (!id) return null;
      await this.loadThreads();
      this.currentId = id;
      return id;
    } catch (err) {
      this.error = (err as Error).message;
      return null;
    }
  }

  /**
   * Local-only optimistic rename. The gateway does not expose a thread-rename
   * endpoint as of v0.29.0; the new title vanishes on next refresh(). Wire up
   * the persisted variant once the server adds PATCH /api/chat/threads/{id}.
   */
  renameLocal(id: string, title: string): void {
    this.threads = this.threads.map((t) =>
      t.id === id ? { ...t, title } : t
    );
  }
}

export const threads = new ThreadStore();
