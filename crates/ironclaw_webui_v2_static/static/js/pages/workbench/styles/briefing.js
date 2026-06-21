export const WORKBENCH_BRIEFING_STYLE = `.wb13-brief {
  margin-top: 18px;
  border: 1px solid var(--wb-accent-tint);
  border-radius: 16px;
  background: var(--wb-accent-soft);
  box-shadow: var(--wb-shadow);
  padding: 18px 20px;
}
.wb13-brief-head {
  display: flex;
  align-items: flex-start;
  gap: 13px;
}
.wb13-brief-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 9px;
  background: var(--wb-accent-tint);
  color: var(--wb-accent);
}
.wb13-brief-headline { flex: 1; min-width: 0; }
.wb13-brief-eyebrow {
  color: var(--wb-faint);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.wb13-brief-headline h2 {
  margin: 4px 0 0;
  color: var(--wb-ink);
  font-family: var(--wb-font-display);
  font-size: 20px;
  font-weight: 720;
  line-height: 1.3;
}
.wb13-brief-dismiss {
  flex: none;
  display: grid;
  place-items: center;
  min-width: 34px;
  min-height: 34px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--wb-faint);
  cursor: pointer;
}
.wb13-brief-dismiss:hover { color: var(--wb-ink); background: var(--wb-line-2); }
.wb13-brief-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 13px;
}
.wb13-brief-source {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--wb-line);
  border-radius: 999px;
  background: var(--wb-canvas);
  color: var(--wb-ink-2);
  padding: 4px 11px;
  font-size: 12px;
  font-weight: 700;
}
.wb13-brief-source svg { width: 13px; height: 13px; }
.wb13-brief-source.is-quiet {
  border-style: dashed;
  color: var(--wb-faint);
  font-weight: 600;
}
.wb13-brief-empty {
  margin: 14px 0 0;
  color: var(--wb-muted);
  font-size: 14px;
  line-height: 1.55;
}
.wb13-brief-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-top: 16px;
}
.wb13-brief-section {
  border: 1px solid var(--wb-line);
  border-radius: 12px;
  background: var(--wb-canvas);
  padding: 12px 13px;
}
.wb13-brief-sectiontitle {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 9px;
  color: var(--wb-faint);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.wb13-brief-sectiontitle svg { width: 13px; height: 13px; }
.wb13-brief-sectioncount {
  margin-left: auto;
  color: var(--wb-accent);
  font-size: 12px;
  font-weight: 800;
}
.wb13-brief-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--wb-hair);
  padding: 8px 0;
  text-decoration: none;
}
.wb13-brief-section .wb13-brief-row:first-of-type { border-top: 0; padding-top: 2px; }
.wb13-brief-rowmain {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
}
.wb13-brief-row-static { display: grid; gap: 2px; }
.wb13-brief-rowtitle {
  color: var(--wb-ink);
  font-size: 13.5px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb13-brief-rowmeta {
  color: var(--wb-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wb13-brief-rowmain:hover .wb13-brief-rowtitle { color: var(--wb-accent); }
.wb13-brief-rowlink {
  flex: none;
  display: grid;
  place-items: center;
  min-width: 30px;
  min-height: 30px;
  border-radius: 7px;
  color: var(--wb-faint);
}
.wb13-brief-rowlink:hover { color: var(--wb-accent); background: var(--wb-accent-tint); }
.wb13-brief-rowlink svg { width: 14px; height: 14px; }
a.wb13-brief-row-static:hover .wb13-brief-rowtitle { color: var(--wb-accent); }
.wb13-brief-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 15px;
  color: var(--wb-faint);
  font-size: 12px;
}
.wb13-brief-foot svg { width: 13px; height: 13px; flex: none; }

/* Slack blocker rows: full-width list (one column), message text wraps to two
   lines instead of truncating like an email subject. */
.wb13-blocker-list { margin-top: 16px; }
.wb13-blocker-list .wb13-brief-row {
  align-items: flex-start;
  gap: 10px;
}
.wb13-blocker-list .wb13-brief-row .wb13-brief-rowlink {
  margin-top: 1px;
}
.wb13-brief-rowtitle.wb13-blocker-text {
  white-space: normal;
  overflow: visible;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-weight: 600;
  line-height: 1.45;
}
.wb13-blocker-list .wb13-brief-row-static { flex: 1; }

/* Gated-write approval modal: editable draft fields. */
.wb13-approve-textarea {
  width: 100%;
  resize: vertical;
  border: 0;
  background: var(--wb-canvas);
  color: var(--wb-ink);
  padding: 12px 13px;
  font-family: var(--wb-font-body);
  font-size: 13.5px;
  line-height: 1.55;
}
.wb13-approve-body .wb13-pill-control { width: 100%; margin-top: 12px; }
.wb13-approve-body .wb13-pill-control input { flex: 1; max-width: none; }
`;
