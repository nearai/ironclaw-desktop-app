import { html } from '../../../lib/html.js';

export function TypingIndicator() {
  return html`
    <div className="flex gap-3" role="status" aria-label="IronClaw is working">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-iron-700 font-mono text-[11px] font-semibold text-iron-100"
      >
        IC
      </div>
      <div className="rounded-[18px] border border-white/10 bg-iron-800/60 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-iron-200 opacity-40" />
          <span className="h-2 w-2 rounded-full bg-iron-200 opacity-65" />
          <span className="h-2 w-2 rounded-full bg-iron-200 opacity-90" />
        </div>
      </div>
    </div>
  `;
}
