import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e/smoke',
  reporter: process.env.CI ? [['html', { open: 'never' }]] : 'list',
  use: {
    // Always end in exactly one trailing slash — a bare base without it (e.g.
    // a Pages URL pasted without the slash) would otherwise silently drop the
    // /<repo>/ path segment when joined with the smoke spec's relative './' goto.
    baseURL: (process.env.SMOKE_BASE_URL ?? 'http://localhost:4173').replace(/\/?$/, '/'),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
