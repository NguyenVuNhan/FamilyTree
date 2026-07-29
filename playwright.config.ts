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
        // Hermetic guard (see vite.config.ts): keep only alpha/bravo even if ambient
        // FAMILY_TREE_* env (real repo variables, a leftover shell export) is present.
        FAMILY_TREE_E2E_ONLY: 'ALPHA,BRAVO',
      },
    },
    {
      command: 'npm run dev -- --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      env: {
        // This server must always look "no families configured" — drop every
        // FAMILY_TREE_URL_/NAME_ pair regardless of ambient env (see vite.config.ts).
        FAMILY_TREE_E2E_ONLY: '',
      },
    },
  ],
});
