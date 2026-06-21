export const WORKBENCH_FILES_STYLE = `.wb13-activity {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
}
.wb13-activity::before {
  content: "";
  position: absolute;
  left: 6px;
  top: 6px;
  bottom: 18px;
  width: 1.5px;
  background: var(--wb-hair);
}
.wb13-activity li {
  position: relative;
  padding: 0 0 16px 26px;
  color: var(--wb-ink-2);
  font-size: 13.5px;
}
.wb13-activity .ad {
  position: absolute;
  left: 1.5px;
  top: 4px;
  width: 10px;
  height: 10px;
  border: 2px solid var(--wb-good);
  border-radius: 999px;
  background: var(--wb-canvas);
}
.wb13-activity li.now .ad {
  border-color: var(--wb-accent);
  background: var(--wb-accent);
}
.wb13-activity .at {
  color: var(--wb-ink);
  font-weight: 700;
}
.wb13-activity .atime {
  margin-left: 8px;
  color: var(--wb-faint);
  font-size: 11.5px;
}
.wb13-activity .adetail {
  margin-top: 2px;
  color: var(--wb-muted);
  font-size: 12.5px;
}
.wb13-files {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-lg);
  background: var(--wb-canvas);
}
.wb13-files-drawer {
  margin-top: 28px;
}
.wb13-files-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-lg);
  background: var(--wb-canvas);
  color: var(--wb-ink);
  padding: 10px 14px;
  text-align: left;
}
.wb13-files-toggle span {
  display: grid;
  gap: 2px;
}
.wb13-files-toggle strong {
  font-size: 14px;
}
.wb13-files-toggle small {
  color: var(--wb-muted);
  font-size: 12.5px;
}
.wb13-files-drawer .wb13-files,
.wb13-files-drawer .wb13-empty {
  margin-top: 10px;
}
.wb13-files-list {
  min-width: 0;
  border-right: 1px solid var(--wb-line);
  background: var(--wb-surface);
  padding: 10px;
}
.wb13-files-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--wb-faint);
  padding: 2px 4px 8px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}
.wb13-file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--wb-ink-2);
  padding: 6px 8px;
  text-align: left;
  font-size: 12.5px;
}
.wb13-file-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb13-file-row:hover { background: var(--wb-canvas); }
.wb13-file-row.is-active {
  background: var(--wb-accent-soft);
  color: var(--wb-accent);
  font-weight: 800;
}
.wb13-files-viewer {
  min-width: 0;
  min-height: 260px;
  max-height: 430px;
  overflow: auto;
  padding: 14px;
}
.wb13-file-preview-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.wb13-file-preview-head span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: var(--wb-ink);
  font-size: 13px;
  font-weight: 800;
}
.wb13-file-preview-head .wb13-button { margin-left: auto; }
.wb13-files-viewer pre {
  margin: 0;
  overflow: auto;
  border-radius: 8px;
  background: var(--wb-surface);
  color: var(--wb-ink-2);
  padding: 13px 14px;
  font-family: var(--wb-font-mono);
  font-size: 12.5px;
  line-height: 1.55;
  white-space: pre-wrap;
}
.wb13-files-viewer img {
  display: block;
  max-width: 100%;
  border-radius: 8px;
}
`;
