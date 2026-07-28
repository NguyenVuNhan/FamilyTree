/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { buildFamilies, filterFamilyEnv } from './src/config/families.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'FAMILY_TREE_');
  let familyEnv: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(env).filter(([k]) => k.startsWith('FAMILY_TREE_')),
  );
  // Hermetic e2e guard: Vite's loadEnv merges any process.env var matching the prefix on
  // top of .env files, so an ambient FAMILY_TREE_* var (real repo variables once an admin
  // configures them, a leftover shell export, etc.) would otherwise leak into a dev server
  // regardless of what playwright.config.ts passed as webServer `env`. When
  // FAMILY_TREE_E2E_ONLY is set (by playwright.config.ts), keep only the FAMILY_TREE_URL_/
  // NAME_ pairs whose suffix is explicitly allow-listed (comma list; '' means none).
  if (env.FAMILY_TREE_E2E_ONLY !== undefined) {
    const allowList = env.FAMILY_TREE_E2E_ONLY.split(',').map((s) => s.trim()).filter(Boolean);
    familyEnv = filterFamilyEnv(familyEnv, allowList);
  }
  buildFamilies(familyEnv, '/'); // fail the build early on bad pairs
  return {
    plugins: [react(), tailwindcss()],
    base: process.env.GITHUB_REPOSITORY
      ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
      : '/',
    define: { __FAMILY_ENV__: JSON.stringify(familyEnv) },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        exclude: ['src/main.tsx', 'src/config/index.ts', 'src/data/types.ts', '**/*.d.ts', '**/*.test.*'],
        thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
      },
    },
  };
});
