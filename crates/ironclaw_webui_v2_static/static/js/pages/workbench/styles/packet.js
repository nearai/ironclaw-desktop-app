export const WORKBENCH_PACKET_STYLE = `.wb13-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
  margin: 38px 0 8px;
}
.wb13-head h1 {
  margin: 0;
  font-family: var(--wb-font-display);
  font-size: 24px;
  font-weight: 750;
  line-height: 1.2;
}
.wb13-head .meta {
  margin-left: auto;
  color: var(--wb-faint);
  font-size: 12.5px;
}
.wb13-library-source {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 0 0 14px;
  color: var(--wb-muted);
  font-size: 12.5px;
  line-height: 1.4;
}
.wb13-library-source-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  border: 1px solid var(--wb-line);
  border-radius: 999px;
  background: var(--wb-surface);
  color: var(--wb-ink);
  padding: 3px 10px;
  font-weight: 750;
}
.wb13-library-source-badge svg {
  width: 14px;
  height: 14px;
  color: var(--wb-muted);
}
.wb13-context {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--wb-line);
  border-radius: 6px;
  background: var(--wb-surface);
  color: var(--wb-muted);
  padding: 3px 9px;
  font-size: 12px;
}
.wb13-pk-head { padding: 26px 0 0; }
.wb13-pk-state {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  color: var(--wb-muted);
  font-size: 11.5px;
  font-weight: 700;
}
.wb13-pk-state .d {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--wb-faint);
}
.wb13-pk-state.is-hold { color: var(--wb-hold-text); }
.wb13-pk-state.is-hold .d { background: var(--wb-hold); }
.wb13-pk-state.is-run { color: var(--wb-good-text); }
.wb13-pk-state.is-run .d { background: var(--wb-good); }
.wb13-pk-state.is-draft { color: var(--wb-warn-text); }
.wb13-pk-state.is-draft .d { background: var(--wb-warn); }
.wb13-pk-head h1 {
  margin: 0;
  color: var(--wb-ink);
  font-family: var(--wb-font-display);
  font-size: 26px;
  font-weight: 750;
  line-height: 1.2;
}
.wb13-pk-ctx {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 9px;
}
.wb13-tabs {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  margin: 18px 0 0;
  border-bottom: 1px solid var(--wb-line);
}
.wb13-tab {
  margin-bottom: -1px;
  min-height: 44px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--wb-muted);
  padding: 10px 13px;
  font-size: 13.5px;
  font-weight: 700;
}
.wb13-tab.is-active {
  border-bottom-color: var(--wb-accent);
  color: var(--wb-ink);
}
.wb13-tab-badge {
  border: 1px solid var(--wb-line);
  border-radius: 999px;
  background: var(--wb-surface);
  color: var(--wb-muted);
  padding: 0 6px;
  font-size: 10px;
  font-weight: 800;
}
.wb13-tab-check svg {
  width: 14px;
  height: 14px;
  color: var(--wb-good-text);
  stroke-width: 2.4;
}
.wb13-tabwrap { padding: 24px 0 0; }
.wb13-sec { margin-bottom: 28px; }
.wb13-sec-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 11px;
  color: var(--wb-faint);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}
.wb13-kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 11px;
  color: var(--wb-faint);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}
.wb13-read p {
  margin: 0;
  color: var(--wb-ink);
  font-family: var(--wb-font-body);
  font-size: 16px;
  line-height: 1.55;
}
.wb13-decisions { display: flex; flex-direction: column; }
.wb13-decision-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 16px;
  border-top: 1px solid var(--wb-hair);
  padding: 13px 0;
}
.wb13-decision-row:first-child { border-top: 0; }
.wb13-decision-row .dl {
  color: var(--wb-ink);
  font-size: 14.5px;
  font-weight: 800;
}
.wb13-decision-row .dv {
  color: var(--wb-ink-2);
  font-size: 14px;
  text-align: right;
}
.wb13-decision-row .src {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--wb-muted);
  font-size: 12.5px;
}
.wb13-decision-row .src button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  background: transparent;
  color: var(--wb-accent);
  padding: 0;
  font-size: 12.5px;
  font-weight: 700;
}
.wb13-review {
  overflow: hidden;
  border: 1px solid var(--wb-line);
  border-radius: 11px;
  background: var(--wb-canvas);
}
.wb13-review-head {
  border-bottom: 1px solid var(--wb-line);
  background: var(--wb-surface);
  color: var(--wb-muted);
  padding: 11px 14px;
  font-size: 12.5px;
  font-weight: 800;
}
.wb13-review-item {
  display: flex;
  align-items: center;
  gap: 11px;
  border-top: 1px solid var(--wb-hair);
  padding: 11px 14px;
  color: var(--wb-ink-2);
  font-size: 13.5px;
}
.wb13-review-item:first-of-type { border-top: 0; }
.wb13-review-item b { color: var(--wb-ink); }
.wb13-review-item button {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 6px;
  margin-left: auto;
  border: 0;
  background: transparent;
  color: var(--wb-accent);
  font-size: 12.5px;
  font-weight: 800;
}
.wb13-review-mark {
  display: inline-grid;
  width: 18px;
  height: 18px;
  flex: none;
  place-items: center;
  border: 1.5px solid var(--wb-line);
  border-radius: 999px;
}
.wb13-review-mark.is-done {
  border-color: var(--wb-good);
  background: var(--wb-good);
  color: #fff;
}
.wb13-review-mark svg { width: 11px; height: 11px; stroke-width: 3; }
.wb13-doc {
  display: grid;
  grid-template-columns: 178px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-lg);
  background: var(--wb-canvas);
}
.wb13-doctop {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.wb13-doctop .baseline {
  color: var(--wb-muted);
  font-size: 12.5px;
}
.wb13-version {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--wb-line);
  border-radius: 8px;
  background: var(--wb-canvas);
  color: var(--wb-ink);
  padding: 5px 9px;
  font-size: 12.5px;
}
.wb13-doc-nav {
  border-right: 1px solid var(--wb-line);
  background: var(--wb-surface);
  padding: 13px 6px;
}
.wb13-doc-nav-title {
  padding: 0 8px 8px;
  color: var(--wb-faint);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}
.wb13-doc-nav button {
  display: block;
  width: 100%;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--wb-ink-2);
  padding: 7px 9px;
  text-align: left;
  font-size: 12.5px;
}
.wb13-doc-nav button small {
  display: block;
  color: var(--wb-faint);
  font-size: 10.5px;
}
.wb13-doc-nav button.is-active {
  background: var(--wb-accent-soft);
  color: var(--wb-accent);
  font-weight: 800;
}
.wb13-doc-main { min-width: 0; }
.wb13-doc-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--wb-line);
  background: var(--wb-surface);
  color: var(--wb-muted);
  padding: 10px 16px;
  font-size: 12.5px;
}
.wb13-doc-body {
  max-height: 430px;
  overflow-y: auto;
  padding: 18px 20px;
  color: var(--wb-ink);
}
.wb13-clause {
  padding: 0 0 20px;
}
.wb13-clause .cnum {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
  color: var(--wb-muted);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}
.wb13-clause p {
  margin: 8px 0 0;
  color: var(--wb-ink);
  font-family: var(--wb-font-body);
  font-size: 15px;
  line-height: 1.65;
}
.ctag {
  border-radius: 5px;
  background: var(--wb-surface);
  color: var(--wb-muted);
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 800;
}
.ctag.is-changed { background: var(--wb-good-tint); color: var(--wb-good-text); }
.ctag.is-held { background: var(--wb-hold-tint); color: var(--wb-hold-text); }
.ctag.is-kept { border: 1px solid var(--wb-line); background: var(--wb-surface); }
.wb13-doc-body .markdown-body,
.wb13-doc-body p {
  font-size: 14px;
  line-height: 1.65;
}
.wb13-email {
  overflow: hidden;
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-lg);
  background: var(--wb-canvas);
}
.wb13-email-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 5px 12px;
  border-bottom: 1px solid var(--wb-line);
  color: var(--wb-muted);
  padding: 13px 16px;
  font-size: 13px;
}
.wb13-email-head b { color: var(--wb-ink); font-weight: 800; }
.wb13-email textarea {
  width: 100%;
  min-height: 210px;
  resize: vertical;
  border: 0;
  outline: none;
  background: var(--wb-canvas);
  color: var(--wb-ink);
  padding: 17px 18px;
  font-family: var(--wb-font-body);
  font-size: 15.5px;
  line-height: 1.65;
}
.wb13-email textarea:not([readonly]) {
  background: var(--wb-accent-soft);
  box-shadow: inset 0 0 0 2px var(--wb-accent-tint);
}
.wb13-email-attachment {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
  border-top: 1px solid var(--wb-hair);
  padding: 12px 16px;
  font-size: 13px;
}
.wb13-email-attachment span {
  margin-left: auto;
  color: var(--wb-muted);
  font-size: 12px;
}
.wb13-email-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
}
.wb13-stale {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--wb-hold-line);
  border-radius: 6px;
  background: var(--wb-hold-tint);
  color: var(--wb-hold-text);
  padding: 3px 9px;
  font-size: 12px;
  font-weight: 700;
}
.wb13-list {
  display: flex;
  flex-direction: column;
}
.wb13-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 13px;
  align-items: center;
  border-top: 1px solid var(--wb-hair);
  padding: 13px 2px;
  color: inherit;
  text-decoration: none;
}
.wb13-row:first-child { border-top: 0; }
.wb13-row:hover .wb13-row-title { color: var(--wb-accent); }
.wb13-row-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--wb-line);
  border-radius: 9px;
  background: var(--wb-surface);
  color: var(--wb-muted);
}
.wb13-row-title { color: var(--wb-ink); font-size: 14.5px; font-weight: 700; }
.wb13-row-copy { margin-top: 1px; color: var(--wb-muted); font-size: 12.5px; }
.wb13-row-meta { color: var(--wb-faint); font-size: 12px; text-align: right; white-space: nowrap; }
`;
