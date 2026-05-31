// Generative missions — the chief-of-staff core.
//
// A static catalog ("pick Contract Review from a menu") is the wrong shape for
// a chief of staff: it can't know that an *actual* contract just landed. This
// module instead asks the connected agent to PROPOSE specific, grounded
// actions from whatever is currently in front of the user — documents they
// dropped, notes from a call, recent workspace activity. Each proposal is tied
// to a real item, carries a ready-to-run instruction, and defaults to
// approval mode so nothing is sent/written without the user's OK.
//
// Pure functions only (prompt-builder + parser) so they're trivially testable;
// the store (`generated-missions.svelte.ts`) feeds these to the gateway's
// Responses API and renders the result on the Desk.

export type GeneratedMissionMode = 'dry-run' | 'approval';

/** A piece of live context the agent should reason over. */
export interface ContextItem {
  kind: 'document' | 'note' | 'email' | 'event' | 'activity';
  /** Short human label, e.g. "Inbox — Northwind MSA". */
  label: string;
  /** The actual content (contract text, call notes, an event summary…). */
  body: string;
}

/** One agent-proposed action, grounded in a specific context item. */
export interface GeneratedMission {
  /** Stable-ish slug derived from the title (for keys / dedupe). */
  id: string;
  /** Action title — should reference the real item. */
  title: string;
  /** The context item label this is tied to. */
  item: string;
  /** One sentence: why this matters now. */
  why: string;
  /** approval = may send/write after OK; dry-run = read-only output. */
  mode: GeneratedMissionMode;
  /** Self-contained instruction to execute the action. */
  run_instruction: string;
  /** What the user gets out of it. */
  deliverable: string;
}

const SYSTEM = `You are the user's Chief of Staff inside IronClaw, a desktop workspace. New items just landed in the workspace (below). Do NOT choose from a fixed menu of generic tasks. Read what ACTUALLY arrived and propose the specific, grounded next actions you would put on the user's Desk right now — each tied to a real item, in the user's interest, and scoped so it can run without sending or writing anything until the user approves.

This is workspace assistance, not legal/financial advice; where something needs a professional, say so inside the action rather than skipping it.

Return STRICT JSON only — an array (highest priority first), each element:
{
  "title": "<short; references the real item>",
  "item": "<the label of the item this is about>",
  "why": "<one sentence: why this matters now>",
  "mode": "approval" | "dry-run",
  "run_instruction": "<the exact task to execute, self-contained>",
  "deliverable": "<what the user gets>"
}
Propose 2-6 actions. No prose outside the JSON array.`;

/** Render context items + the proposal instruction into a single prompt. */
export function buildProposalPrompt(items: ContextItem[]): string {
  if (items.length === 0) {
    throw new Error('buildProposalPrompt: no context items');
  }
  const rendered = items
    .map((it, i) => `=== Item ${i + 1} — [${it.kind}] ${it.label} ===\n${it.body.trim()}`)
    .join('\n\n');
  return `${SYSTEM}\n\n--- WORKSPACE CONTEXT ---\n${rendered}`;
}

/** Lowercase-slug a title into a stable id; falls back to an index-based id. */
function slug(title: string, index: number): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return s || `mission-${index + 1}`;
}

function coerceMode(v: unknown): GeneratedMissionMode {
  return v === 'dry-run' ? 'dry-run' : 'approval';
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Parse the model's reply into validated missions. Tolerant of the usual LLM
 * wrapping (```json fences, leading prose): it extracts the first JSON array,
 * then keeps only elements with a usable title + run_instruction. Never
 * throws on malformed model output — returns [] so the UI shows an empty
 * state rather than crashing.
 */
export function parseProposedMissions(raw: string): GeneratedMission[] {
  if (!raw) return [];
  // Strip code fences, then take the first [...] block.
  const unfenced = raw.replace(/```(?:json)?/gi, '');
  const start = unfenced.indexOf('[');
  const end = unfenced.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: GeneratedMission[] = [];
  const seen = new Set<string>();
  arr.forEach((el, i) => {
    if (!el || typeof el !== 'object') return;
    const o = el as Record<string, unknown>;
    const title = str(o.title);
    const run_instruction = str(o.run_instruction);
    if (!title || !run_instruction) return;
    let id = slug(title, i);
    while (seen.has(id)) id = `${id}-${i}`;
    seen.add(id);
    out.push({
      id,
      title,
      item: str(o.item) || 'workspace',
      why: str(o.why),
      mode: coerceMode(o.mode),
      run_instruction,
      deliverable: str(o.deliverable)
    });
  });
  return out;
}
