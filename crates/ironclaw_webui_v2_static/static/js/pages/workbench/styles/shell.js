export const WORKBENCH_SHELL_STYLE = `.wb13-shell {
  display: grid;
  grid-template-columns: 54px 252px minmax(0, 1fr);
  grid-template-rows: 52px minmax(0, 1fr);
  grid-template-areas: "nav dock top" "nav dock main";
  height: 100%;
  min-height: 0;
  background: var(--wb-surface);
}
.wb13-nav {
  grid-area: nav;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 11px 0;
  background: var(--wb-rail);
}
.wb13-mark {
  width: 30px;
  height: 30px;
  margin-bottom: 10px;
  border-radius: 9px;
  background: linear-gradient(150deg, #2bb3a4, #139e90 55%, #0c6f65);
}
.wb13-nav button {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 44px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 0;
  background: transparent;
  color: var(--wb-rail-muted);
  font-size: 10px;
  font-weight: 600;
}
.wb13-nav a {
  color: var(--wb-rail-muted);
  text-decoration: none;
}
.wb13-nav button:hover,
.wb13-nav a:hover,
.wb13-nav button.is-active { color: #fff; }
.wb13-nav button.is-active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--wb-rail-accent);
}
.wb13-nav svg,
.wb13-button svg,
.wb13-icon-button svg,
.wb13-context svg,
.wb13-source-pill svg,
.wb13-action-icon svg {
  width: 16px;
  height: 16px;
}
.wb13-spacer { flex: 1; }
.wb13-dock {
  grid-area: dock;
  overflow-y: auto;
  border-right: 1px solid #0b0e12;
  background: var(--wb-rail);
  color: var(--wb-rail-ink);
  padding: 14px 12px;
}
.wb13-workspace {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 4px 13px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--wb-rail-line);
}
.wb13-workspace-title { font-size: 15px; font-weight: 700; }
.wb13-workspace-sub { font-size: 11px; color: var(--wb-rail-muted); }
.wb13-dock-close {
  display: none;
  width: 44px;
  height: 44px;
  margin-left: auto;
  place-items: center;
  border: 1px solid var(--wb-rail-line);
  border-radius: 8px;
  background: transparent;
  color: var(--wb-rail-muted);
}
.wb13-dock-close:hover { color: var(--wb-rail-ink); border-color: var(--wb-rail-muted); }
.wb13-dock-group {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 15px 4px 6px;
  color: var(--wb-rail-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}
.wb13-dock-count {
  margin-left: auto;
  border-radius: 999px;
  background: var(--wb-rail-2);
  color: #fff;
  padding: 0 6px;
  font-size: 10px;
  line-height: 15px;
}
.wb13-dock-item {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr);
  align-items: start;
  gap: 9px;
  width: 100%;
  min-height: 44px;
  padding: 8px;
  border: 0;
  border-radius: var(--wb-r);
  background: transparent;
  color: var(--wb-rail-ink);
  text-align: left;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}
.wb13-dock-item:hover,
.wb13-dock-item.is-active { background: var(--wb-rail-active); }
.wb13-dock-item > span:last-child { min-width: 0; }
.wb13-dot {
  width: 7px;
  height: 7px;
  margin-top: 6px;
  border-radius: 999px;
  background: var(--wb-faint);
}
.wb13-dot-reply { background: var(--wb-accent); }
.wb13-dot-hold { background: var(--wb-hold); }
.wb13-dot-block { background: var(--wb-danger); }
.wb13-dot-run { background: #3ab0a2; }
.wb13-dot-ready { background: var(--wb-warn); }
.wb13-dot-sched { background: var(--wb-accent); }
.wb13-dot-done { background: var(--wb-good); }
.wb13-dock-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.35;
}
.wb13-dock-detail {
  display: block;
  color: var(--wb-rail-muted);
  font-size: 10.5px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.wb13-top {
  grid-area: top;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 0 18px;
  border-bottom: 1px solid var(--wb-line);
  background: var(--wb-canvas);
}
.wb13-crumb {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  color: var(--wb-muted);
  font-size: 13.5px;
}
.wb13-crumb strong { color: var(--wb-ink); font-weight: 700; }
.wb13-top-button,
.wb13-icon-button {
  display: inline-grid;
  min-width: 44px;
  min-height: 44px;
  place-items: center;
  border: 1px solid var(--wb-line);
  border-radius: 7px;
  background: transparent;
  color: var(--wb-muted);
}
.wb13-top-button { display: inline-flex; gap: 6px; padding: 0 10px; font-size: 12.5px; }
.wb13-top-button:hover,
.wb13-icon-button:hover { border-color: var(--wb-muted); color: var(--wb-ink); }
.wb13-dock-toggle { display: none; }
.wb13-account {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  border: 1px solid var(--wb-line);
  border-radius: 999px;
  padding: 3px 11px 3px 3px;
  color: var(--wb-muted);
  font-size: 12.5px;
}
.wb13-avatar {
  display: grid;
  width: 23px;
  height: 23px;
  place-items: center;
  border-radius: 999px;
  background: #3a7a72;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
}
.wb13-main {
  grid-area: main;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
  background: var(--wb-surface);
}
.wb13-page { padding: 0 34px 64px; }
.wb13-wrap { max-width: 720px; margin: 0 auto; }
/* When a work item is open the 2-column scene grid needs room to breathe;
   the plain home stays a focused 720 column (DESIGN.md Law 3). */
.wb13-wrap.is-wide { max-width: 1040px; }
.wb13-wide { max-width: 960px; margin: 0 auto; }
`;
