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
      env: {
        FAMILY_TREE_URL_ALPHA: 'https://sheets.example/alpha.csv',
        FAMILY_TREE_NAME_ALPHA: 'Alpha Family',
        FAMILY_TREE_URL_BRAVO: 'https://sheets.example/bravo.csv',
        FAMILY_TREE_NAME_BRAVO: 'Bravo Family',
      },
    },
    {
      command: 'npm run dev -- --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
