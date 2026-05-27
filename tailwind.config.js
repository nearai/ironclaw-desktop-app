/** @type {import('tailwindcss').Config} */
//
// Color tokens are aligned with the IronClaw web UI v2 design system
// (crates/ironclaw_webui_v2_static, reborn-integration branch) so the
// desktop client and the IronClaw browser UI share an accent palette.
//
// Dark-mode-only — light tokens intentionally omitted per project policy.
//
// `accent.cyan` historically pointed at #00d4ff. It now resolves to the
// IronClaw signal blue (#4ca7e6) so every existing reference picks up the
// new accent without a sweep. The new `signal*` aliases are the preferred
// names for new code; semantic tokens (positive/warning-v2/danger) cover
// status states that should NOT be primary-accent blue.
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0a0f1e',
          deep: '#050810',
          surface: '#121826'
        },
        border: {
          subtle: '#1f2937'
        },
        text: {
          primary: '#e5e7eb',
          muted: '#9ca3af'
        },
        accent: {
          // Repointed from #00d4ff → signal blue for visual continuity
          // with the IronClaw web UI. Existing `accent-cyan` consumers
          // pick up the new value automatically.
          cyan: '#4ca7e6',
          gold: '#fbbf24'
        },
        // ── v2 design-system aliases (preferred for new code) ──────────
        signal: '#4ca7e6',
        'signal-strong': '#2882c8',
        'signal-soft': 'rgba(76, 167, 230, 0.14)',
        'signal-text': '#8fc8f2',
        // Semantic status tokens — use these for state, not primary accent.
        positive: '#20d29a',
        'positive-soft': 'rgba(32, 210, 154, 0.13)',
        'warning-v2': '#f5c15b',
        'warning-v2-soft': 'rgba(245, 193, 91, 0.14)',
        danger: '#ff6480',
        'danger-soft': 'rgba(255, 100, 128, 0.13)'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'monospace']
      },
      keyframes: {
        'v2-breathe': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' }
        }
      }
    }
  },
  plugins: []
};
