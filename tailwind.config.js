/** @type {import('tailwindcss').Config} */
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
          cyan: '#00d4ff',
          gold: '#fbbf24'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
};
