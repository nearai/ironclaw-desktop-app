// Vitest configuration for the IronClaw desktop client.
//
// Separate from `vite.config.js` on purpose — the SvelteKit plugin
// pulls in `$app/*` ambient types and route generators that aren't
// useful (and break) under jsdom. Here we use only the `svelte`
// plugin, which is enough to compile `.svelte` files for the
// testing-library renderer.
//
// The `$lib` alias is hand-wired to match `svelte.config.js`. Tests
// import from `$lib/...` exactly like app code.

import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    alias: {
      $lib: path.resolve(projectRoot, 'src/lib')
    },
    // testing-library/svelte resolves to the browser entry — match
    // what the runtime webview sees.
    conditions: ['browser']
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['src-tauri/**', 'build/**', 'node_modules/**', '.svelte-kit/**']
  }
});
