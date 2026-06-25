export const WORKBENCH_COMMAND_STYLE = `.wb13-command { padding-top: 16px; }
.wb13-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}
.wb13-well { position: relative; }
.wb13-compose-box { position: relative; }
.wb13-well.is-dragover .wb13-compose-box textarea {
  border-color: var(--wb-accent);
  box-shadow: 0 0 0 3px var(--wb-accent-tint);
}
.wb13-well textarea {
  width: 100%;
  min-height: 104px;
  resize: none;
  overflow-y: auto;
  border: 1px solid var(--wb-line);
  border-radius: var(--wb-r-lg);
  background: var(--wb-canvas);
  color: var(--wb-ink);
  box-shadow: var(--wb-shadow);
  outline: none;
  padding: 13px 16px 58px;
  font-size: 14.5px;
  line-height: 1.5;
}
.wb13-well textarea::placeholder { color: var(--wb-placeholder); }
.wb13-well:focus-within textarea {
  border-color: var(--wb-accent);
  box-shadow: 0 0 0 3px var(--wb-accent-tint);
}
.wb13-drop-overlay {
  position: absolute;
  inset: 8px;
  z-index: 5;
  display: grid;
  place-items: center;
  border: 1px dashed var(--wb-accent);
  border-radius: var(--wb-r-lg);
  background: var(--wb-drop-bg);
  color: var(--wb-accent);
  font-size: 13px;
  font-weight: 800;
  pointer-events: none;
}
.wb13-wbar {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 11px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.wb13-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}
.wb13-scope,
.wb13-pill-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  min-width: 0;
  border: 1px solid var(--wb-line);
  border-radius: 999px;
  background: var(--wb-surface);
  color: var(--wb-muted);
  padding: 5px 11px;
  font-size: 12.5px;
}
.wb13-scope select,
.wb13-pill-control select,
.wb13-pill-control input {
  min-width: 0;
  max-width: 132px;
  min-height: 44px;
  height: 44px;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--wb-ink);
  font-size: 12.5px;
}
.wb13-wbtn {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid var(--wb-line);
  border-radius: 7px;
  background: transparent;
  color: var(--wb-muted);
}
.wb13-mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 190px;
  min-height: 44px;
  min-width: 0;
  border: 1px solid var(--wb-line);
  border-radius: 999px;
  background: var(--wb-surface);
  color: var(--wb-ink-2);
  padding: 0 12px;
  font-size: 12.5px;
  font-weight: 700;
}
.wb13-mode-btn span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb13-send {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  margin-left: auto;
  border: 0;
  border-radius: 9px;
  background: var(--wb-accent);
  color: #fff;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 700;
}
.wb13-send:hover { background: var(--wb-accent-press); }
.wb13-send:disabled,
.wb13-send:disabled:hover {
  cursor: not-allowed;
  background: var(--wb-line-2);
  color: var(--wb-faint);
  opacity: 1;
}
.wb13-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 9px 2px 0;
}
.wb13-attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-height: 40px;
  border: 1px solid var(--wb-line);
  border-radius: 999px;
  background: var(--wb-canvas);
  color: var(--wb-ink);
  padding: 5px 6px 5px 9px;
  box-shadow: var(--wb-shadow);
}
.wb13-attachment-chip.is-warning {
  border-color: var(--wb-warn);
  background: var(--wb-warn-tint);
}
.wb13-attachment-icon,
.wb13-attachment-thumb {
  display: grid;
  width: 26px;
  height: 26px;
  flex: none;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--wb-line);
  border-radius: 999px;
  background: var(--wb-surface);
  color: var(--wb-muted);
}
.wb13-attachment-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.wb13-attachment-copy {
  display: grid;
  min-width: 0;
  gap: 1px;
}
.wb13-attachment-copy strong {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--wb-ink);
  font-size: 12.5px;
  line-height: 1.2;
}
.wb13-attachment-copy span {
  color: var(--wb-muted);
  font-size: 11px;
  line-height: 1.2;
}
.wb13-attachment-chip button,
.wb13-attachment-rejections button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--wb-muted);
}
.wb13-attachment-chip button:hover,
.wb13-attachment-rejections button:hover {
  background: var(--wb-surface);
  color: var(--wb-ink);
}
.wb13-attachment-rejections {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-height: 40px;
  border: 1px solid var(--wb-warn);
  border-radius: 999px;
  background: var(--wb-warn-tint);
  color: var(--wb-warn-text);
  padding: 5px 8px 5px 12px;
  font-size: 12px;
  font-weight: 700;
}
.wb13-effort {
  display: inline-grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  min-height: 44px;
  border: 1px solid var(--wb-line);
  border-radius: 999px;
  overflow: hidden;
  background: var(--wb-canvas);
}
.wb13-effort button {
  min-width: 0;
  min-height: 44px;
  border: 0;
  color: var(--wb-muted);
  font-size: 12px;
  font-weight: 700;
}
.wb13-effort button.is-active { background: var(--wb-accent); color: #fff; }
.wb13-boundary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 11px 4px 0;
  color: var(--wb-muted);
  font-size: 12.5px;
}
.wb13-boundary button {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-left: auto;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--wb-accent);
  padding: 0 8px;
  font-size: 12.5px;
  font-weight: 700;
}
.wb13-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}
.wb13-chip {
  min-height: 44px;
  border: 1px solid var(--wb-line);
  border-radius: 999px;
  background: var(--wb-canvas);
  color: var(--wb-ink-2);
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
}
.wb13-chip:hover { border-color: var(--wb-accent); color: var(--wb-accent); }
.wb13-chip.is-muted { border-style: dashed; color: var(--wb-faint); }
.wb13-chip.is-active { border-color: var(--wb-accent); background: var(--wb-accent); color: #fff; }
`;
