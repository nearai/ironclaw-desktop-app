export const WORKBENCH_TOKENS_STYLE = `
.wb13 {
  --wb-font-body: "Inter Variable", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --wb-font-display: Newsreader, "Newsreader Variable", ui-serif, Charter, "Iowan Old Style", "Palatino Linotype", serif;
  --wb-font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --wb-surface: #f7f8f6;
  --wb-canvas: #ffffff;
  --wb-ink: #161a22;
  --wb-ink-2: #363d4b;
  --wb-muted: #586173;
  --wb-faint: #737d8c;
  --wb-line: #e3e6e0;
  --wb-line-2: #eef0ec;
  --wb-hair: #ebeee8;
  --wb-accent: #1c63d6;
  --wb-accent-press: #1654b8;
  --wb-accent-tint: #eaf1fd;
  --wb-accent-soft: #f3f7fe;
  --wb-hold: #bd5a2f;
  --wb-hold-text: #974320;
  --wb-hold-tint: #fbeae0;
  --wb-hold-line: #eccab6;
  --wb-good: #2c8c5e;
  --wb-good-text: #1d6042;
  --wb-good-tint: #e4f1ea;
  --wb-warn: #a9790a;
  --wb-warn-tint: #f6efd9;
  --wb-warn-text: #7d5a06;
  --wb-danger: #c0413c;
  --wb-placeholder: #9aa3af;
  --wb-drop-bg: rgba(247, 248, 246, 0.88);
  --wb-rail: #13181f;
  --wb-rail-2: #1c232d;
  --wb-rail-ink: #e9eef5;
  --wb-rail-muted: #909cae;
  --wb-rail-line: #242d39;
  --wb-rail-active: #212b38;
  --wb-rail-accent: #6aa6ff;
  --wb-r: 8px;
  --wb-r-lg: 13px;
  --wb-shadow: 0 1px 2px rgba(20, 24, 33, 0.05);
  --wb-shadow-pop: 0 24px 60px -20px rgba(20, 24, 33, 0.42);
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--wb-ink);
  background: var(--wb-surface);
  font-family: var(--wb-font-body);
  font-size: 14px;
  line-height: 1.55;
}
[data-theme="dark"] .wb13,
.wb13[data-theme="dark"] {
  --wb-surface: #0b1016;
  --wb-canvas: #111821;
  --wb-ink: #eef4fb;
  --wb-ink-2: #c8d2df;
  --wb-muted: #9aa8b8;
  --wb-faint: #7f8ea0;
  --wb-line: #263241;
  --wb-line-2: #18222e;
  --wb-hair: #1d2835;
  --wb-accent: #7ab7ff;
  --wb-accent-press: #5da2ee;
  --wb-accent-tint: #123150;
  --wb-accent-soft: #0f2234;
  --wb-hold: #d07a4f;
  --wb-hold-text: #f0ad83;
  --wb-hold-tint: #2c1b14;
  --wb-hold-line: #6f3d27;
  --wb-good: #54b889;
  --wb-good-text: #8ee3ba;
  --wb-good-tint: #10291f;
  --wb-warn: #d9aa3a;
  --wb-warn-tint: #2b2412;
  --wb-warn-text: #f1d184;
  --wb-danger: #f0746d;
  --wb-placeholder: #8190a2;
  --wb-drop-bg: rgba(11, 16, 22, 0.82);
  --wb-rail: #070b10;
  --wb-rail-2: #111923;
  --wb-rail-ink: #f0f5fb;
  --wb-rail-muted: #8696a9;
  --wb-rail-line: #1c2734;
  --wb-rail-active: #152333;
  --wb-rail-accent: #7ab7ff;
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
