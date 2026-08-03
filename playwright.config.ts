import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testIgnore: '**/smoke/**',
  fullyParallel: true,
  ignoreSnapshots: !!process.env.CI, // visual regression is a local guard (per-platform baselines)
  reporter: process.env.CI ? [['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      // Real localhost CSV host for ?src= tests (genuine CORS + http carve-out).
      command: 'node tests/e2e/fixture-server.mjs',
      url: 'http://localhost:8787/standard.csv',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
