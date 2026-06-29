export const WORKBENCH_WORKSPACE_STYLE = `.wb13-section { margin-top: 36px; }
.wb13-scene {
  display: grid;
  gap: 14px;
}
.wb13-scene-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  border: 1px solid var(--wb-line);
  border-left: 3px solid var(--wb-accent);
  border-radius: var(--wb-r-lg);
  background: var(--wb-canvas);
  padding: 15px 16px;
  box-shadow: var(--wb-shadow);
}
.wb13-scene-mark {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 10px;
  background: var(--wb-accent-soft);
  color: var(--wb-accent);
}
.wb13-scene-kicker {
  color: var(--wb-accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}
.wb13-scene-summary h2 {
  margin: 2px 0 3px;
  color: var(--wb-ink);
  font-size: 17px;
  line-height: 1.25;
}
.wb13-scene-summary p {
  margin: 0;
  color: var(--wb-muted);
  font-size: 13px;
}
.wb13-scene-summary.is-packet { border-left-color: var(--wb-hold); }
.wb13-scene-summary.is-packet .wb13-scene-mark {
  background: var(--wb-hold-tint);
  color: var(--wb-hold-text);
}
.wb13-scene-rows {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-lg);
  background: var(--wb-canvas);
}
.wb13-scene-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) max-content;
  align-items: center;
  gap: 12px;
  min-height: 58px;
  border-bottom: 1px solid var(--wb-line);
  padding: 11px 14px;
}
.wb13-scene-row:last-child { border-bottom: 0; }
.wb13-scene-row > span:nth-child(2) {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.wb13-row-title {
  display: block;
  color: var(--wb-ink);
  font-weight: 800;
  line-height: 1.25;
}
.wb13-row-copy {
  display: block;
  color: var(--wb-muted);
  font-size: 13px;
  line-height: 1.35;
}
.wb13-scene-state {
  border-radius: 999px;
  background: var(--wb-line-2);
  color: var(--wb-muted);
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 800;
}
.wb13-scene-state.is-draft,
.wb13-scene-state.is-approval {
  background: var(--wb-gold-tint);
  color: var(--wb-gold-text);
}
.wb13-scene-state.is-blocked {
  background: var(--wb-hold-tint);
  color: var(--wb-danger);
}
.wb13-scene-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  gap: 12px;
}
.wb13-scene-panel {
  min-width: 0;
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-lg);
  background: var(--wb-canvas);
  padding: 15px;
  box-shadow: var(--wb-shadow);
}
.wb13-scene-title {
  color: var(--wb-ink);
  font-size: 14px;
  font-weight: 800;
}
.wb13-scene-copy {
  margin: 7px 0 0;
  color: var(--wb-muted);
  font-size: 13px;
}
.wb13-source-card {
  display: grid;
  gap: 7px;
  margin-top: 12px;
  border: 1px solid var(--wb-line);
  border-radius: 10px;
  background: var(--wb-surface);
  padding: 13px;
}
.wb13-source-card.is-hold {
  border-color: var(--wb-hold-line);
  background: var(--wb-hold-tint);
}
.wb13-source-card strong {
  color: var(--wb-ink);
}
.wb13-source-card p {
  margin: 0;
  color: var(--wb-muted);
  font-size: 13px;
}
.wb13-source-card span {
  color: var(--wb-faint);
  font-size: 12px;
}
.wb13-runtime-state {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  margin-top: 13px;
  border: 1px solid var(--wb-line);
  border-radius: 10px;
  background: var(--wb-surface);
  padding: 13px;
  color: var(--wb-muted);
  font-size: 13px;
  line-height: 1.45;
}
.wb13-runtime-state svg {
  margin-top: 1px;
  color: var(--wb-accent);
}
.wb13-runtime-state strong {
  display: block;
  color: var(--wb-ink);
  margin-bottom: 2px;
}
.wb13-runtime-state.is-warning {
  border-color: var(--wb-warn);
  background: var(--wb-warn-tint);
}
.wb13-runtime-state.is-warning svg {
  color: var(--wb-warn-text);
}
.wb13-run-live {
  margin-left: auto;
  color: var(--wb-gold-text);
  font-size: 11px;
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0;
}
.wb13-run-live.is-attention {
  color: var(--wb-danger);
}
.wb13-run {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
}
.wb13-run-row {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 10px;
  padding: 9px 0;
  border-top: 1px solid var(--wb-line-2);
}
.wb13-run-row:first-child {
  border-top: 0;
}
.wb13-run-marker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: var(--wb-line-2);
  color: var(--wb-muted);
}
.wb13-run-marker svg {
  width: 13px;
  height: 13px;
}
.wb13-run-row.is-user .wb13-run-marker {
  background: var(--wb-accent-tint);
  color: var(--wb-accent);
}
.wb13-run-row.is-assistant .wb13-run-marker {
  background: var(--wb-gold-tint);
  color: var(--wb-gold);
}
.wb13-run-row.is-failed .wb13-run-marker {
  background: var(--wb-hold-tint);
  color: var(--wb-danger);
}
.wb13-run-body {
  min-width: 0;
  display: grid;
  gap: 3px;
}
.wb13-run-role {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--wb-faint);
}
/* The live conversation surface (ChatView -> ConversationThread -> .wb13-chat-thread).
   The run-text tier was previously scoped to .wb13-runtime-preview, which is rendered
   nowhere, so the real messages fell back to a default 16px <p> with 1em block margins —
   the most important content on the surface silently lost its tier. Re-scope to the live
   thread, the actual container. */
.wb13-chat-thread .wb13-run-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--wb-ink-2);
  overflow-wrap: anywhere;
}
/* The question is plain text (preserve its line breaks); the assistant body is rendered
   markdown (block elements) and must NOT be pre-wrapped — only tame its outer margins so
   the bubble sits flush. */
.wb13-chat-thread .wb13-run-row.is-user .wb13-run-text { white-space: pre-wrap; }
.wb13-chat-thread .wb13-run-row.is-assistant .wb13-run-text > :first-child { margin-top: 0; }
.wb13-chat-thread .wb13-run-row.is-assistant .wb13-run-text > :last-child { margin-bottom: 0; }
.wb13-chat-thread .wb13-run-text.is-meta {
  color: var(--wb-muted);
  font-size: 12.5px;
  white-space: pre-wrap;
}
.wb13-chat-thread .wb13-run-text.is-result {
  color: var(--wb-muted);
  font-size: 12.5px;
  border-left: 2px solid var(--wb-line);
  padding-left: 8px;
  white-space: pre-wrap;
}
/* The dedicated chat surface reads at a comfortable measure and flows full-length in the
   scrolling main area — a dignified conversation, not a transcript boxed into a tiny inner
   scrollbox. (The old .wb13-run 340px cap, removed above, served no other surface.) */
.wb13-chat-thread { max-width: 760px; margin: 0 auto; padding-top: 6px; }
.wb13-chat-thread .wb13-run { gap: 4px; }
.wb13-run-tool {
  display: flex;
  align-items: center;
  gap: 8px;
}
.wb13-run-tool-name {
  font-family: var(--wb-font-mono);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--wb-ink-2);
  overflow-wrap: anywhere;
}
.wb13-run-status {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 1px 7px;
  border-radius: 999px;
}
.wb13-run-status.is-run {
  color: var(--wb-accent);
  background: var(--wb-accent-tint);
}
.wb13-run-status.is-good {
  color: var(--wb-good-text);
  background: var(--wb-good-tint);
}
.wb13-run-status.is-danger {
  color: var(--wb-danger);
  background: var(--wb-hold-tint);
}
.wb13-chat {
  display: flex;
  flex-direction: column;
}
.wb13-chat-working {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 2px 34px;
  font-size: 13px;
  color: var(--wb-muted);
}
.wb13-chat-working.is-attention {
  color: var(--wb-danger);
}
.wb13-chat-working svg {
  width: 14px;
  height: 14px;
  flex: none;
}
.wb13-typing {
  display: inline-flex;
  gap: 3px;
}
.wb13-typing i {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--wb-muted);
  animation: wb13-typing-bounce 1.2s ease-in-out infinite;
}
.wb13-typing i:nth-child(2) {
  animation-delay: 0.15s;
}
.wb13-typing i:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes wb13-typing-bounce {
  0%,
  60%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-3px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .wb13-typing i {
    animation: none;
    opacity: 0.6;
  }
}
.wb13-chat-guard {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--wb-line);
  font-size: 12px;
  color: var(--wb-faint);
}
.wb13-chat-guard svg {
  width: 14px;
  height: 14px;
  flex: none;
}
.wb13-run-composer {
  margin-top: 14px;
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-lg);
  background: var(--wb-canvas);
  padding: 10px 12px;
  display: grid;
  gap: 8px;
}
.wb13-run-composer textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
}
.wb13-run-composer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.wb13-run-composer-row .x {
  font-size: 11.5px;
  color: var(--wb-faint);
}
.wb13-run-gates {
  margin-top: 13px;
  border: 1px solid var(--wb-gold-line);
  border-radius: 10px;
  background: var(--wb-gold-tint);
  padding: 12px 13px;
  display: grid;
  gap: 10px;
}
.wb13-run-gates-head {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--wb-gold-text);
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}
.wb13-run-gates-head svg {
  width: 15px;
  height: 15px;
}
.wb13-run-gates-count {
  margin-left: auto;
  color: var(--wb-gold-text);
  font-weight: 700;
}
.wb13-run-gate {
  display: grid;
  grid-template-columns: 24px 1fr auto;
  gap: 10px;
  align-items: center;
}
.wb13-run-gate-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--wb-canvas);
  color: var(--wb-gold-text);
}
.wb13-run-gate-icon svg {
  width: 14px;
  height: 14px;
}
.wb13-run-gate-body {
  min-width: 0;
}
.wb13-run-gate-title {
  font-weight: 700;
  color: var(--wb-ink);
  font-size: 13.5px;
}
.wb13-run-gate-detail {
  color: var(--wb-ink-2);
  font-size: 12.5px;
  margin-top: 2px;
}
.wb13-pref-list {
  display: grid;
  margin: 12px 0;
  border: 1px solid var(--wb-line);
  border-radius: 10px;
  overflow: hidden;
}
.wb13-pref-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 12px;
  border-top: 1px solid var(--wb-line);
  padding: 10px 11px;
  font-size: 12.5px;
}
.wb13-pref-row:first-child { border-top: 0; }
.wb13-pref-row span { color: var(--wb-faint); font-weight: 700; }
.wb13-pref-row strong { color: var(--wb-ink-2); font-weight: 700; }
.wb13-group { margin-bottom: 22px; }
.wb13-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  color: var(--wb-faint);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}
.wb13-group-title.is-hold { color: var(--wb-hold-text); }
.wb13-group-title.is-danger { color: var(--wb-danger); }
.wb13-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 9px;
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-lg);
  background: var(--wb-canvas);
  padding: 14px 16px;
}
.wb13-card:hover { border-color: var(--wb-muted); }
/* The single most actionable band — "Needs a decision" — out-ranks the flat reply/FYI cards
   through depth (a warm border + a subtle shadow), not a side stripe. Its gold status pill
   stays on the canvas fill, so the elevation reads without muddying the pill. */
.wb13-card.is-decision {
  border-color: var(--wb-hold-line);
  box-shadow: var(--wb-shadow);
}
.wb13-card.is-decision:hover { border-color: var(--wb-hold); }
.wb13-skel-card { pointer-events: none; }
.wb13-skel-card .wb13-card-main { flex: 1; min-width: 0; }
.wb13-skel-head { height: 16px; width: 110px; border-radius: 6px; margin: 2px 0 12px; }
.wb13-skel-line { border-radius: 6px; }
.wb13-skel-line.is-pill { height: 18px; width: 92px; border-radius: 999px; margin-bottom: 11px; }
.wb13-skel-line.is-title { height: 13px; width: 68%; margin-bottom: 9px; }
.wb13-skel-line.is-copy { height: 12px; width: 90%; }
.wb13-skel-line.is-action { height: 30px; width: 82px; border-radius: var(--wb-r-lg); flex: none; }
.wb13-dock-skel { display: flex; flex-direction: column; gap: 15px; padding: 10px 2px; }
.wb13-dock-skel-row { display: flex; align-items: center; gap: 9px; }
.wb13-skel-line.is-dot { height: 8px; width: 8px; border-radius: 999px; flex: none; }
.wb13-skel-line.is-row { height: 11px; flex: 1; }
.wb13-section-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-muted);
  margin: 16px 2px 10px;
}
.wb13-section-label svg { width: 14px; height: 14px; flex: none; }
.wb13-section-count { margin-left: auto; font-weight: 500; color: var(--wb-faint); }
.wb13-slack-quote {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  margin-bottom: 13px;
  border-radius: var(--wb-r-lg);
  background: var(--wb-surface);
  border: 1px solid var(--wb-line);
  font-size: 13px;
  line-height: 1.45;
  color: var(--wb-ink-2);
}
.wb13-slack-quote .who { font-weight: 600; font-size: 11.5px; color: var(--wb-muted); }
.wb13-skel-head,
.wb13-skel-line {
  background: linear-gradient(
    90deg,
    var(--wb-line) 0%,
    color-mix(in srgb, var(--wb-line) 45%, var(--wb-canvas)) 50%,
    var(--wb-line) 100%
  );
  background-size: 200% 100%;
  animation: wb13-shimmer 1.4s ease-in-out infinite;
}
@keyframes wb13-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .wb13-skel-head,
  .wb13-skel-line {
    animation: none;
    background: var(--wb-line);
  }
}
.wb13-action-icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  border-radius: 8px;
  background: var(--wb-accent-soft);
  color: var(--wb-accent);
}
.wb13-action-icon.is-hold { background: var(--wb-hold-tint); color: var(--wb-hold-text); }
.wb13-action-icon.is-danger { background: var(--wb-hold-tint); color: var(--wb-danger); }
.wb13-action-icon.is-done { background: var(--wb-good-tint); color: var(--wb-good-text); }
.wb13-card-main { min-width: 0; flex: 1; }
.wb13-card-title { color: var(--wb-ink); font-size: 14.5px; font-weight: 600; }
.wb13-card-copy { margin-top: 2px; color: var(--wb-muted); font-size: 13px; line-height: 1.5; }
.wb13-card-thread-count {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  color: var(--wb-faint);
  font-size: 12px;
  font-weight: 600;
}
.wb13-card-thread-count svg { width: 12px; height: 12px; }
.wb13-card-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 7px;
}
.wb13-card-when { font-size: 12px; color: var(--wb-muted); white-space: nowrap; }
.wb13-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--wb-accent-soft);
  color: var(--wb-accent);
  white-space: nowrap;
}
.wb13-status-pill svg { width: 12px; height: 12px; }
.wb13-status-pill.is-reply { background: var(--wb-accent-soft); color: var(--wb-accent-ink); }
.wb13-status-pill.is-decision { background: var(--wb-hold-tint); color: var(--wb-hold-text); }
.wb13-status-pill.is-blocked {
  background: color-mix(in srgb, var(--wb-danger) 13%, transparent);
  color: var(--wb-danger);
}
.wb13-status-pill.is-working {
  background: var(--wb-accent-soft);
  color: var(--wb-ink-2);
}
.wb13-status-pill.is-done { background: var(--wb-good-tint); color: var(--wb-good-text); }
/* Proactive "New in Notion" home band */
.wb13-notionnew {
  margin-bottom: 16px;
}
.wb13-notionnew-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
}
/* Sentence-case quiet label to match the Slack section label (was an uppercase tracked
   eyebrow — a noisy, inconsistent treatment); keeps the proactive bands reading as one calm
   column with Triage as the single focal heading below. */
.wb13-notionnew-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-muted);
}
.wb13-notionnew-title svg {
  width: 14px;
  height: 14px;
}
/* Quiet inline count (was an accent pill) to match the Slack section count — the home
   surfaces, it does not shout. */
.wb13-notionnew-count {
  font-size: 12px;
  font-weight: 500;
  color: var(--wb-faint);
}
.wb13-notionnew-clear {
  border: 0;
  background: none;
  color: var(--wb-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}
.wb13-notionnew-clear:hover {
  color: var(--wb-ink);
  background: var(--wb-surface);
}
.wb13-notionnew-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  text-align: left;
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-lg);
  background: var(--wb-canvas);
  padding: 10px 12px;
  margin-bottom: 7px;
  cursor: pointer;
  font: inherit;
}
.wb13-notionnew-card:hover {
  border-color: var(--wb-muted);
}
.wb13-notionnew-name {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--wb-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb13-notionnew-when {
  font-size: 12px;
  color: var(--wb-muted);
  flex: none;
}
.wb13-notionnew-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.wb13-notionnew-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.wb13-notionnew-gist {
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--wb-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}
.wb13-notionnew-gist.is-loading {
  color: var(--wb-faint);
}
.wb13-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  color: var(--wb-faint);
  font-size: 12px;
}
.wb13-card-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: var(--wb-faint);
  font-size: 12px;
  font-weight: 600;
}
.wb13-card-trigger svg { width: 13px; height: 13px; }
.wb13-card-actions { display: flex; flex: none; gap: 7px; align-self: center; }
/* A decision card whose body is a clickable button that opens the reading panel. */
.wb13-card-readable { cursor: default; flex-wrap: wrap; }
.wb13-card-open {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: flex-start;
  gap: 12px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 0;
  cursor: pointer;
}
.wb13-card-open:focus-visible { outline: 2px solid var(--wb-accent); outline-offset: 3px; border-radius: 8px; }
/* Visible keyboard focus across the interactive Workbench surfaces — it was nearly absent, so
   keyboard users could not see where focus was. Token-based ring; only shows on keyboard focus
   (:focus-visible), so it never adds noise for mouse users. */
.wb13-button:focus-visible,
.wb13-chip:focus-visible,
.wb13-card:focus-visible,
.wb13-notionnew-card:focus-visible,
.wb13-notionnew-clear:focus-visible,
.wb13-dock-item:focus-visible {
  outline: 2px solid var(--wb-accent);
  outline-offset: 2px;
}
.wb13-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 44px;
  border: 1px solid var(--wb-line);
  border-radius: 8px;
  background: var(--wb-canvas);
  color: var(--wb-ink);
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}
.wb13-button:hover { border-color: var(--wb-muted); }
.wb13-button:disabled {
  cursor: not-allowed;
  border-color: var(--wb-line);
  background: var(--wb-line-2);
  color: var(--wb-faint);
}
.wb13-button.is-primary {
  border-color: var(--wb-accent);
  background: var(--wb-accent);
  color: #fff;
}
.wb13-button.is-hold {
  border-color: var(--wb-hold);
  background: var(--wb-hold);
  color: #fff;
}
.wb13-button.is-primary:disabled,
.wb13-button.is-hold:disabled {
  border-color: var(--wb-line);
  background: var(--wb-line-2);
  color: var(--wb-faint);
}
.wb13-button.is-sm { min-height: 32px; padding: 6px 11px; font-size: 12.5px; }
.wb13-button.is-ghost {
  border-color: transparent;
  background: transparent;
  color: var(--wb-muted);
  font-weight: 600;
}
.wb13-button.is-ghost:hover { border-color: var(--wb-line); color: var(--wb-ink); }
.wb13-card-dismiss {
  flex-basis: 100%;
  width: 100%;
  margin-top: 8px;
  padding-top: 9px;
  border-top: 1px solid var(--wb-line-2);
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.wb13-card-dismiss-label { font-size: 11.5px; color: var(--wb-faint); }
.wb13-card-dismiss-reasons { display: flex; flex-wrap: wrap; gap: 6px; }
.wb13-empty {
  border: 1px dashed var(--wb-line);
  border-radius: 11px;
  padding: 20px;
  text-align: center;
  color: var(--wb-muted);
  font-size: 13.5px;
}
.wb13-empty.is-compact {
  padding: 14px;
  text-align: left;
  font-size: 12.5px;
}
.wb13-allclear {
  border: 1px dashed var(--wb-line);
  border-radius: 11px;
  padding: 18px 20px;
  color: var(--wb-muted);
  font-size: 13.5px;
  line-height: 1.5;
}
.wb13-allclear-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
/* Dedicated chat-surface empty state: a centered, dignified invitation rather than the
   generic dashed all-clear box stranded top-left in an otherwise blank surface. */
.wb13-chat-empty {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 14px;
  max-width: 460px;
  margin: 13vh auto 0;
}
.wb13-chat-empty-mark {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border-radius: var(--wb-r-lg);
  background: var(--wb-accent-soft);
  color: var(--wb-accent);
}
.wb13-chat-empty-mark svg { width: 24px; height: 24px; }
.wb13-chat-empty h1 {
  margin: 0;
  font-family: var(--wb-font-display);
  font-size: 23px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--wb-ink);
}
.wb13-chat-empty p {
  margin: 0;
  max-width: 40ch;
  color: var(--wb-muted);
  font-size: 14px;
  line-height: 1.55;
}
.wb13-chat-empty-cta { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 4px; }
.wb13-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  border: 1px solid var(--wb-hold-line);
  border-radius: 10px;
  background: var(--wb-hold-tint);
  color: var(--wb-hold-text);
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
}
.wb13-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  color: var(--wb-muted);
  font-size: 12px;
  font-weight: 500;
}
.wb13-hint svg { width: 14px; height: 14px; color: var(--wb-faint); }
.wb13-dock-allclear {
  margin: 14px 4px;
  border: 1px dashed var(--wb-rail-line);
  border-radius: var(--wb-r);
  padding: 14px 12px;
  color: var(--wb-rail-muted);
  font-size: 12.5px;
  line-height: 1.5;
}
.wb13-coldstart {
  margin-top: 28px;
  padding: 26px 26px 24px;
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-lg);
  background: var(--wb-canvas);
  box-shadow: var(--wb-shadow);
}
.wb13-coldstart-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.wb13-coldstart-source {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--wb-line);
  background: var(--wb-surface);
  color: var(--wb-muted);
}
.wb13-coldstart-source svg { width: 15px; height: 15px; }
.wb13-coldstart-title {
  font-family: var(--wb-font-display);
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--wb-ink);
  margin: 0 0 8px;
}
.wb13-coldstart-copy {
  font-size: 14px;
  line-height: 1.6;
  color: var(--wb-muted);
  max-width: 56ch;
  margin: 0 0 18px;
}
.wb13-arrived {
  margin-top: 30px;
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-lg);
  background: var(--wb-canvas);
  box-shadow: var(--wb-shadow);
  overflow: hidden;
}
.wb13-arrived-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--wb-hair);
  color: var(--wb-ink);
}
.wb13-arrived-head svg { width: 16px; height: 16px; color: var(--wb-accent); }
.wb13-arrived-title { font-weight: 800; font-size: 14px; }
.wb13-arrived-count {
  margin-left: auto;
  color: var(--wb-muted);
  font-size: 12px;
  font-weight: 600;
}
.wb13-arrived-list { display: grid; }
/* Each inbox entry: a clickable row (opens the reading panel) plus an optional
   "Open in Gmail" external link. The row wrapper carries the unread state. */
.wb13-arrived-row {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--wb-line-2);
}
.wb13-arrived-row:last-child { border-bottom: 0; }
.wb13-arrived-item {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  width: 100%;
  flex: 1;
  text-align: left;
  background: transparent;
  border: 0;
  padding: 12px 16px;
  cursor: pointer;
  color: var(--wb-ink);
  font: inherit;
}
.wb13-arrived-item:hover { background: var(--wb-accent-soft); }
.wb13-arrived-gmail {
  display: grid;
  flex: none;
  place-items: center;
  min-width: 44px;
  color: var(--wb-muted);
  text-decoration: none;
}
.wb13-arrived-gmail:hover { color: var(--wb-accent); background: var(--wb-accent-soft); }
.wb13-arrived-gmail svg { width: 16px; height: 16px; }
.wb13-arrived-dot {
  margin-top: 6px;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--wb-line);
  flex: none;
}
.wb13-arrived-row.is-unread .wb13-arrived-dot { background: var(--wb-accent); }
.wb13-arrived-body { display: grid; gap: 2px; min-width: 0; flex: 1; }
.wb13-arrived-line { display: flex; align-items: center; gap: 8px; min-width: 0; }
.wb13-arrived-sender {
  font-weight: 700;
  font-size: 13px;
  color: var(--wb-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb13-arrived-row.is-unread .wb13-arrived-sender { color: var(--wb-ink); }
.wb13-arrived-flag {
  flex: none;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--wb-accent);
  background: var(--wb-accent-tint);
  border-radius: 4px;
  padding: 1px 6px;
}
.wb13-arrived-subject {
  font-size: 13px;
  color: var(--wb-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb13-arrived-row.is-unread .wb13-arrived-subject { color: var(--wb-ink-2); font-weight: 600; }
.wb13-arrived-note {
  padding: 14px 16px;
  color: var(--wb-muted);
  font-size: 13px;
}
.wb13-upcoming { margin-top: 16px; }
.wb13-arrived-item { text-decoration: none; }
.wb13-arrived-item.is-static { cursor: default; }
.wb13-arrived-item.is-static:hover { background: transparent; }
`;
