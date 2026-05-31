// Generative missions store — the live half of the chief-of-staff core.
//
// Feeds whatever context the user has in front of them (dropped documents,
// pasted call notes, recent activity) to the connected agent and turns the
// reply into grounded, ready-to-run proposed actions. This is the dynamic
// replacement for the static mission catalog: the agent decides what's worth
// doing from what's actually happening, instead of the user picking a generic
// verb off a menu.
//
// Running a proposal reuses the existing composer bus — it drops the
// instruction into the chat composer (approval-first), so nothing is sent or
// written without the user. No new execution path, no new trust surface.

import { connection } from './connection.svelte';
import { composerInsert } from './templates.svelte';
import { workItems } from './work-items.svelte';
import {
  buildProposalPrompt,
  parseProposedMissions,
  type ContextItem,
  type GeneratedMission
} from '$lib/util/mission-generator';
import { planWorkAsk, type WorkRouteClassification } from '$lib/util/work-router';

type GenStatus = 'idle' | 'generating' | 'ready' | 'error' | 'empty';

class GeneratedMissionsStore {
  status = $state<GenStatus>('idle');
  missions = $state<GeneratedMission[]>([]);
  error = $state<string | null>(null);
  /** Echoed back so the panel can show what the proposals were drawn from. */
  lastContext = $state<ContextItem[]>([]);

  private seq = 0;

  /** True when a gateway client is available to generate against. */
  get available(): boolean {
    return !!connection.client;
  }

  /**
   * Ask the connected agent to propose actions from the given context.
   * Late/stale responses are ignored via a sequence guard so rapid
   * re-generates can't clobber each other.
   */
  async generateFrom(items: ContextItem[]): Promise<void> {
    const client = connection.client;
    if (!client) {
      this.status = 'error';
      this.error = 'Not connected to a gateway. Connect in Settings, then try again.';
      return;
    }
    const usable = items.filter((i) => i.body.trim().length > 0);
    if (usable.length === 0) {
      this.status = 'error';
      this.error = 'Add something for the agent to work from (paste notes, a doc, an email).';
      return;
    }
    const mine = ++this.seq;
    this.status = 'generating';
    this.error = null;
    this.lastContext = usable;
    try {
      const raw = await client.createResponse(buildProposalPrompt(usable));
      if (mine !== this.seq) return; // superseded
      const parsed = parseProposedMissions(raw);
      this.missions = parsed;
      this.status = parsed.length > 0 ? 'ready' : 'empty';
    } catch (err) {
      if (mine !== this.seq) return;
      this.status = 'error';
      this.error = err instanceof Error ? err.message : 'Generation failed.';
    }
  }

  /**
   * Run a proposed mission: drop its instruction into the chat composer for
   * the user to review + send. Approval-first by design — we never auto-send.
   * Returns the instruction so callers can also navigate to chat.
   */
  run(mission: GeneratedMission): string {
    const classification: WorkRouteClassification = {
      domain: mission.domain,
      confidence: mission.domain === 'unknown' ? 0.3 : 0.82,
      title: mission.title,
      domains: mission.domains,
      context: mission.context,
      riskyActions: mission.risky_actions,
      expectedArtifacts: mission.expected_artifacts,
      watches: mission.watches,
      nextAction: mission.run_instruction
    };
    const route = planWorkAsk({ ask: mission.run_instruction, classification });
    let workPrefix = '';
    if (route.status === 'routed') {
      const created = workItems.create(route.workItem);
      if (created) {
        workPrefix = `Work item: ${created.title}\nRunbook: ${created.runbookIds.join(', ') || 'none'}\n\n`;
      }
    } else {
      workPrefix = `Routing note: I could not attach this to a durable work item yet (${route.reason}). Ask me the missing routing/context question before doing external work.\n\n`;
    }
    const prefix =
      mission.mode === 'approval'
        ? 'Propose this and show me a draft before sending or writing anything:\n\n'
        : '';
    const text = `${workPrefix}${prefix}${mission.run_instruction}`;
    // composerInsert is a one-shot bus (same path MissionLauncher uses): the
    // chat page consumes the pending text into its composer on next mount.
    composerInsert.push(text, null);
    return text;
  }

  dismiss(id: string): void {
    this.missions = this.missions.filter((m) => m.id !== id);
    if (this.missions.length === 0 && this.status === 'ready') this.status = 'empty';
  }

  reset(): void {
    this.seq++;
    this.status = 'idle';
    this.missions = [];
    this.error = null;
    this.lastContext = [];
  }
}

export const generatedMissions = new GeneratedMissionsStore();
