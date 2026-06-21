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
.wb13-runtime-preview {
  display: grid;
  gap: 10px;
  margin-top: 13px;
  border: 1px solid var(--wb-line);
  border-radius: 10px;
  background: var(--wb-surface);
  padding: 13px;
}
.wb13-runtime-preview-head {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--wb-gold-text);
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0;
}
.wb13-runtime-preview-head svg {
  width: 15px;
  height: 15px;
}
.wb13-runtime-preview p {
  max-height: 260px;
  overflow: auto;
  margin: 0;
  color: var(--wb-ink-2);
  font-size: 13.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.wb13-runtime-preview .wb13-button {
  justify-self: flex-start;
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
  max-height: 340px;
  overflow: auto;
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
.wb13-runtime-preview .wb13-run-text {
  max-height: none;
  overflow: visible;
  margin: 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--wb-ink-2);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.wb13-runtime-preview .wb13-run-text.is-meta {
  color: var(--wb-muted);
  font-size: 12.5px;
}
.wb13-runtime-preview .wb13-run-text.is-result {
  color: var(--wb-muted);
  font-size: 12.5px;
  border-left: 2px solid var(--wb-line);
  padding-left: 8px;
}
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
  margin-bottom: 8px;
  border: 1px solid var(--wb-line);
  border-radius: 11px;
  background: var(--wb-canvas);
  padding: 13px 14px;
}
.wb13-card:hover { border-color: var(--wb-muted); }
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
.wb13-card-title { color: var(--wb-ink); font-size: 14.5px; font-weight: 800; }
.wb13-card-copy { margin-top: 2px; color: var(--wb-muted); font-size: 13px; }
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
.wb13-card-readable { cursor: default; }
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
.wb13-sources-ready {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;
}
.wb13-source-ready {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--wb-good-tint);
  background: var(--wb-good-tint);
  color: var(--wb-good-text);
  border-radius: 999px;
  padding: 6px 11px;
  font-size: 12px;
  font-weight: 600;
}
.wb13-source-ready svg { width: 14px; height: 14px; }
.wb13-source-ready-name { color: var(--wb-ink-2); font-weight: 700; }
.wb13-source-ready-via { color: var(--wb-good-text); font-weight: 600; }
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
