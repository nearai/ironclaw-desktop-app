export const WORKBENCH_TOKENS_STYLE = `
.wb13 {
  /* Direction B (light) palette — NEAR Private Chat tokens, light-first.
     System font everywhere (no serif): real SF Pro on Apple via -apple-system,
     Pretendard as the off-Apple fallback. Variable names kept (wb13) so existing
     layout CSS re-colors without churn. */
  --wb-font-body: -apple-system, BlinkMacSystemFont, "SF Pro", "SF Pro Text", "SF Pro Display", "Pretendard Variable", "Pretendard", system-ui, "Segoe UI", sans-serif;
  --wb-font-display: -apple-system, BlinkMacSystemFont, "SF Pro", "SF Pro Display", "Pretendard Variable", "Pretendard", system-ui, "Segoe UI", sans-serif;
  --wb-font-mono: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
  --wb-surface: #f8f8f6;
  --wb-canvas: #ffffff;
  --wb-ink: rgba(0, 0, 0, 0.95);
  --wb-ink-2: rgba(39, 39, 39, 0.8);
  /* muted/faint darkened to meet WCAG-AA (4.5:1) for normal text on canvas + surface — at the
     old values muted was 4.35 and faint 2.75 (unreadable metadata). A subtle tier remains. */
  --wb-muted: rgba(39, 39, 39, 0.68);
  --wb-faint: rgba(39, 39, 39, 0.66);
  --wb-line: rgba(0, 0, 0, 0.08);
  --wb-line-2: #f1f2f1;
  --wb-hair: rgba(0, 0, 0, 0.05);
  --wb-accent: #0091fd;
  --wb-accent-press: #0078d1;
  --wb-accent-tint: #ebf6ff;
  --wb-accent-soft: #f4faff;
  --wb-hold: #c77a1e;
  --wb-hold-text: #9a5b12;
  --wb-hold-tint: #fdf1e3;
  --wb-hold-line: #efd8b8;
  --wb-gold: #f5a623;
  --wb-gold-text: #9a6a12;
  --wb-gold-tint: #fbf1d9;
  --wb-gold-line: #ebd9a6;
  --wb-good: #15be53;
  --wb-good-text: #0e7c38;
  --wb-good-tint: #e4f6ea;
  --wb-warn: #f5a623;
  --wb-warn-tint: #fbf1d9;
  --wb-warn-text: #9a6a12;
  --wb-danger: #e5484d;
  --wb-placeholder: rgba(39, 39, 39, 0.4);
  --wb-drop-bg: rgba(248, 248, 246, 0.88);
  --wb-rail: #ffffff;
  --wb-rail-2: #f1f2f1;
  --wb-rail-ink: rgba(0, 0, 0, 0.95);
  --wb-rail-muted: rgba(39, 39, 39, 0.48);
  --wb-rail-line: rgba(0, 0, 0, 0.05);
  --wb-rail-active: #ebf6ff;
  --wb-rail-accent: #0091fd;
  --wb-r: 10px;
  --wb-r-lg: 16px;
  --wb-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  --wb-shadow-pop: 0 16px 48px -16px rgba(0, 0, 0, 0.24);
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--wb-ink);
  background: var(--wb-surface);
  font-family: var(--wb-font-body);
  font-size: 14px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
[data-theme="dark"] .wb13,
.wb13[data-theme="dark"] {
  --wb-surface: #0e0f10;
  --wb-canvas: #131517;
  --wb-ink: rgba(255, 255, 255, 0.92);
  --wb-ink-2: rgba(255, 255, 255, 0.72);
  --wb-muted: rgba(255, 255, 255, 0.56);
  /* faint lifted to meet WCAG-AA (4.5:1) on the dark canvas — was 0.4 (3.84). */
  --wb-faint: rgba(255, 255, 255, 0.48);
  --wb-line: rgba(255, 255, 255, 0.11);
  --wb-line-2: #191b1d;
  --wb-hair: rgba(255, 255, 255, 0.07);
  --wb-accent: #0091fd;
  --wb-accent-press: #339dff;
  --wb-accent-tint: rgba(0, 145, 253, 0.14);
  --wb-accent-soft: rgba(0, 145, 253, 0.08);
  --wb-hold: #d07a4f;
  --wb-hold-text: #f0ad83;
  --wb-hold-tint: rgba(208, 122, 79, 0.16);
  --wb-hold-line: rgba(208, 122, 79, 0.4);
  --wb-gold: #f5a623;
  --wb-gold-text: #f3cd6b;
  --wb-gold-tint: rgba(245, 166, 35, 0.14);
  --wb-gold-line: rgba(245, 166, 35, 0.36);
  --wb-good: #15be53;
  --wb-good-text: #54d98a;
  --wb-good-tint: rgba(21, 190, 83, 0.14);
  --wb-warn: #f5a623;
  --wb-warn-tint: rgba(245, 166, 35, 0.14);
  --wb-warn-text: #f3cd6b;
  --wb-danger: #f0746d;
  --wb-placeholder: rgba(255, 255, 255, 0.4);
  --wb-drop-bg: rgba(14, 15, 16, 0.84);
  --wb-rail: #131517;
  --wb-rail-2: #191b1d;
  --wb-rail-ink: rgba(255, 255, 255, 0.92);
  --wb-rail-muted: rgba(255, 255, 255, 0.45);
  --wb-rail-line: rgba(255, 255, 255, 0.07);
  --wb-rail-active: rgba(0, 145, 253, 0.14);
  --wb-rail-accent: #0091fd;
  --wb-shadow: 0 1px 2px rgba(0, 0, 0, 0.32);
  --wb-shadow-pop: 0 24px 70px -22px rgba(0, 0, 0, 0.72);
}
.wb13 * { box-sizing: border-box; }
.wb13 svg {
  width: 16px;
  height: 16px;
  flex: none;
}
`;
