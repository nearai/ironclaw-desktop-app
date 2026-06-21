export const WORKBENCH_OVERLAYS_STYLE = `.wb13-inspector {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  width: 340px;
  max-width: 92vw;
  overflow-y: auto;
  border-left: 1px solid var(--wb-line);
  background: var(--wb-canvas);
  box-shadow: var(--wb-shadow-pop);
  padding: 18px;
}
.wb13-scrim {
  position: fixed;
  inset: 0;
  z-index: 55;
  background: rgba(16, 19, 26, 0.36);
}
.wb13-dock-scrim {
  position: fixed;
  inset: 0;
  z-index: 51;
  border: 0;
  background: rgba(16, 19, 26, 0.36);
}
.wb13-inspector-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 800;
}
.wb13-inspector-head button {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: var(--wb-muted);
  font-size: 20px;
  display: grid;
  place-items: center;
  min-width: 44px;
  min-height: 44px;
}
.wb13-inspector-sub { margin: 0 0 16px; color: var(--wb-muted); font-size: 12px; }
.wb13-inspector-block { margin-bottom: 16px; }
.wb13-inspector-block h5 {
  margin: 0 0 7px;
  color: var(--wb-faint);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}
.wb13-full-control {
  width: 100%;
  justify-content: flex-start;
}
.wb13-full-control input {
  max-width: none;
  flex: 1;
}
.wb13-inspector-note {
  border-left: 3px solid var(--wb-warn);
  border-radius: 0 9px 9px 0;
  background: var(--wb-warn-tint);
  color: var(--wb-ink-2);
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.5;
}
.wb13-source-pill {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  border-top: 1px solid var(--wb-hair);
  padding: 9px 0;
  font-size: 12.5px;
}
.wb13-source-pill:first-child { border-top: 0; }
.wb13-source-pill > span:not(.wb13-source-state):not(.wb13-source-meta) {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;
}
.wb13-source-pill strong { color: var(--wb-ink); font-weight: 800; }
.wb13-source-pill span { color: var(--wb-muted); }
.wb13-source-meta {
  display: grid;
  flex: none;
  justify-items: end;
  gap: 6px;
  max-width: 136px;
}
.wb13-source-state { white-space: nowrap; font-weight: 800; }
.wb13-source-state.is-positive { color: var(--wb-good-text); }
.wb13-source-state.is-warning { color: var(--wb-warn-text); }
.wb13-source-state.is-danger { color: var(--wb-danger); }
.wb13-source-action {
  flex: none;
  min-height: 32px;
  border: 1px solid var(--wb-line);
  border-radius: 8px;
  background: var(--wb-canvas);
  color: var(--wb-ink);
  padding: 6px 9px;
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
}
.wb13-source-action:disabled {
  color: var(--wb-faint);
  cursor: not-allowed;
}
.wb13-reader { width: 460px; }
.wb13-reader-meta {
  border-bottom: 1px solid var(--wb-line);
  padding-bottom: 14px;
  margin-bottom: 14px;
}
.wb13-reader-subject {
  margin: 6px 0 8px;
  color: var(--wb-ink);
  font-family: var(--wb-font-display);
  font-size: 20px;
  font-weight: 750;
  line-height: 1.3;
}
.wb13-reader-from { color: var(--wb-ink); font-size: 13.5px; font-weight: 700; }
.wb13-reader-to { margin-top: 3px; color: var(--wb-muted); font-size: 12.5px; }
.wb13-reader-when { margin-top: 3px; color: var(--wb-faint); font-size: 12px; }
.wb13-reader-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.wb13-reader-body {
  color: var(--wb-ink);
  font-family: var(--wb-font-body);
  font-size: 14px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.wb13-reader-para { margin: 0 0 12px; white-space: pre-wrap; }
.wb13-reader-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--wb-muted);
  font-size: 13px;
}
.wb13-reader-note.is-error {
  border-left: 3px solid var(--wb-danger);
  border-radius: 0 9px 9px 0;
  background: var(--wb-danger-tint, var(--wb-warn-tint));
  color: var(--wb-ink-2);
  padding: 12px 14px;
}
.wb13-modal {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(16, 19, 26, 0.55);
  backdrop-filter: blur(2px);
}
.wb13-frozen {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 10px;
  color: var(--wb-faint);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}
.wb13-approve {
  width: 560px;
  max-width: 100%;
  max-height: 90vh;
  overflow: hidden;
  border-radius: 16px;
  background: var(--wb-canvas);
  box-shadow: var(--wb-shadow-pop);
}
.wb13-approve-head {
  border-bottom: 1px solid var(--wb-line);
  padding: 20px 22px 14px;
}
.wb13-approve-head .eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--wb-hold-text);
  font-size: 11.5px;
  font-weight: 800;
  text-transform: uppercase;
}
.wb13-approve-head h2 {
  margin: 9px 0 0;
  color: var(--wb-ink);
  font-family: var(--wb-font-display);
  font-size: 21px;
  font-weight: 750;
}
.wb13-approve-body { max-height: 55vh; overflow-y: auto; padding: 18px 22px; }
.wb13-pkg {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 9px 16px;
  font-size: 13.5px;
}
.wb13-pkg dt { color: var(--wb-muted); }
.wb13-pkg dd { margin: 0; color: var(--wb-ink); }
.wb13-bodyprev {
  overflow: hidden;
  margin-top: 14px;
  border: 1px solid var(--wb-line);
  border-radius: 9px;
}
.wb13-bodyprev .bh {
  border-bottom: 1px solid var(--wb-line);
  background: var(--wb-surface);
  color: var(--wb-faint);
  padding: 8px 12px;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
}
.wb13-bodyprev .bb {
  max-height: 120px;
  overflow-y: auto;
  padding: 12px 13px;
  color: var(--wb-ink);
  font-family: var(--wb-font-body);
  font-size: 13.5px;
  line-height: 1.55;
}
.wb13-checklist {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 13px;
  border-radius: 8px;
  background: var(--wb-surface);
  padding: 11px 12px;
}
.wb13-checklist .ci {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--wb-hold-text);
  font-size: 13px;
}
.wb13-checklist .ci.done { color: var(--wb-ink); }
.wb13-note,
.wb13-gatewarn {
  margin-top: 12px;
  border: 1px solid var(--wb-line);
  border-radius: 8px;
  background: var(--wb-surface);
  color: var(--wb-muted);
  padding: 10px 12px;
  font-size: 12.5px;
}
.wb13-gatewarn {
  border-color: var(--wb-hold-line);
  background: var(--wb-hold-tint);
  color: var(--wb-hold-text);
}
.wb13-approve-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  border-top: 1px solid var(--wb-line);
  padding: 14px 22px;
}
.wb13-approve-footer .x {
  margin-left: auto;
  color: var(--wb-faint);
  font-size: 12px;
}
.wb13-appbar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin: 8px -34px 0;
  border-top: 1px solid var(--wb-hold-line);
  background: var(--wb-canvas);
  box-shadow: 0 -8px 24px -16px rgba(20, 24, 33, 0.25);
  padding: 13px 34px;
}
.wb13-appbar .ai {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  border-radius: 8px;
  background: var(--wb-hold-tint);
  color: var(--wb-hold-text);
}
.wb13-appbar .am {
  flex: 1;
  min-width: 180px;
}
.wb13-appbar .at {
  color: var(--wb-ink);
  font-size: 13.5px;
  font-weight: 800;
}
.wb13-appbar .aw {
  color: var(--wb-muted);
  font-size: 12.5px;
}
.wb13-appbar .rev {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 3px;
  color: var(--wb-muted);
  font-size: 12px;
}
.wb13-appbar .rev span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.wb13-appbar .rev .wb13-review-mark {
  width: 13px;
  height: 13px;
}
.wb13-appbar .rev .wb13-review-mark svg {
  width: 9px;
  height: 9px;
}
.wb13-cmdk {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
}
.wb13-cmdk-scrim {
  position: fixed;
  inset: 0;
  border: 0;
  background: var(--wb-drop-bg);
  cursor: default;
}
.wb13-cmdk-panel {
  position: relative;
  width: 560px;
  max-width: 92vw;
  background: var(--wb-canvas);
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-lg);
  box-shadow: var(--wb-shadow-pop);
  overflow: hidden;
}
.wb13-cmdk-input {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--wb-line-2);
}
.wb13-cmdk-input svg {
  width: 17px;
  height: 17px;
  color: var(--wb-muted);
}
.wb13-cmdk-input input {
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--wb-ink);
  font-family: var(--wb-font-body);
  font-size: 15px;
  outline: none;
}
.wb13-cmdk-input input::placeholder {
  color: var(--wb-placeholder);
}
.wb13-cmdk-esc {
  font-family: var(--wb-font-mono);
  font-size: 10.5px;
  color: var(--wb-faint);
  border: 1px solid var(--wb-line);
  border-radius: 5px;
  padding: 1px 6px;
}
.wb13-cmdk-list {
  list-style: none;
  margin: 0;
  padding: 6px;
  max-height: 360px;
  overflow: auto;
}
.wb13-cmdk-item {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  color: var(--wb-ink-2);
  padding: 9px 11px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.wb13-cmdk-item svg {
  width: 16px;
  height: 16px;
  color: var(--wb-muted);
  flex: none;
}
.wb13-cmdk-item.is-active {
  background: var(--wb-accent-tint);
  color: var(--wb-ink);
}
.wb13-cmdk-item.is-active svg {
  color: var(--wb-accent);
}
.wb13-cmdk-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb13-cmdk-hint {
  font-family: var(--wb-font-mono);
  font-size: 10.5px;
  color: var(--wb-faint);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.wb13-cmdk-empty {
  padding: 18px 16px;
  color: var(--wb-muted);
  font-size: 13.5px;
}
`;
