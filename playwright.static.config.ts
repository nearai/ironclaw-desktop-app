import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/static',
  fullyParallel: false,
  workers: 1,
  // One Chromium runs the whole (large) suite serially; the GPU compositor's
  // shared-image pool can exhaust mid-run and crash the page ("Trying to Produce
  // a Memory representation from a non-existent mailbox" -> "Target page closed").
  // Headless tests need no GPU, so disable it; keep a single local retry as a net.
  retries: process.env.CI ? 2 : 1,
  use: {
    baseURL: 'http://127.0.0.1:1420',
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--disable-gpu', '--disable-dev-shm-usage', '--disable-software-rasterizer']
    }
  },
  webServer: {
    command: 'PORT=1420 npm run dev:webui-static',
    url: 'http://127.0.0.1:1420/index.html',
    reuseExistingServer: !process.env.CI,
    // The dev server runs a full prepare (tailwind + esbuild) build on startup,
    // which can exceed a minute on a loaded machine — wait generously.
    timeout: 180_000
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
