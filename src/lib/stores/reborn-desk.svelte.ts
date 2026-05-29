// "The Desk" — the proactive chief-of-staff home surface for IronClaw Reborn.
//
// Rather than a reactive chat log, the Desk is a priority-sorted channel of
// cards the user acts on. Its lead section — "Needs you" — surfaces the
// agent's APPROVAL GATES as first-class cards: the run paused and is waiting
// for a human decision. This is the differentiated, Reborn-unique moment (the
// agent waited for me), and it has had no dedicated home until now (gates only
// resolved inline mid-chat).
//
// This first increment derives the gate cards from the live `RebornChatController`
// (which already tracks the active thread's `pendingGate` off the projection
// stream) and resolves them through the same `resolveGate` path. Cross-thread
// gate aggregation, the "while you were away" activity feed, and open-loop
// cards layer on in later increments. The controller is injected (defaulting to
// the app-wide singleton) so this is unit-testable without the connection store.

import { rebornChat, RebornChatController } from './reborn-chat.svelte';
import { openLoops } from './open-loops.svelte';

/** A pending approval rendered as a "Needs you" Desk card. */
export interface DeskGateCard {
  /** Stable id (`runId:gateRef`) for keyed rendering + dedup. */
  id: string;
  kind: 'gate' | 'auth_required';
  runId: string;
  gateRef: string;
  headline: string;
  body: string;
}

/** A tracked commitment rendered as an "Open loops" Desk card. */
export interface DeskLoopCard {
  id: string;
  text: string;
  createdAt: number;
}

export class RebornDesk {
  constructor(
    private chat: RebornChatController = rebornChat,
    private loops: typeof openLoops = openLoops
  ) {}

  /**
   * "Needs you" — pending approval gates as cards. Today this reflects the
   * active thread's gate (Reborn streams gates per-thread); a later increment
   * aggregates across threads. A getter (not a `$derived` field) so it tracks
   * the controller's `$state.pendingGate` reactively wherever it's read.
   */
  get gateCards(): DeskGateCard[] {
    const g = this.chat.state.pendingGate;
    if (!g || !g.runId || !g.gateRef) return [];
    return [
      {
        id: `${g.runId}:${g.gateRef}`,
        kind: g.kind,
        runId: g.runId,
        gateRef: g.gateRef,
        headline:
          g.headline ||
          (g.kind === 'auth_required' ? 'Authorization required' : 'Approval required'),
        body: g.body || ''
      }
    ];
  }

  /** True when there's nothing awaiting the user — drives the calm "all caught up" state. */
  get caughtUp(): boolean {
    return this.gateCards.length === 0;
  }

  /** Approve the pending gate (fires the paused run). */
  async approve(): Promise<void> {
    await this.chat.resolveGate('approved');
  }

  /** Deny the pending gate. */
  async deny(): Promise<void> {
    await this.chat.resolveGate('denied');
  }

  /**
   * "Open loops" — tracked commitments the agent (or user) hasn't closed yet,
   * surfaced from the existing open-loops store (localStorage-backed, so this
   * works on any backend). A getter so it tracks the store's `active` $derived
   * reactively wherever it's read.
   */
  get loopCards(): DeskLoopCard[] {
    return this.loops.active.map((l) => ({ id: l.id, text: l.text, createdAt: l.createdAt }));
  }

  /** Mark a commitment resolved (toggles its done flag in the store). */
  resolveLoop(id: string): void {
    this.loops.toggleDone(id);
  }

  /** Drop a commitment entirely. */
  dismissLoop(id: string): void {
    this.loops.remove(id);
  }
}

/** App-wide singleton bound to the live chat controller. */
export const rebornDesk = new RebornDesk();
