/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { buildFamilies } from './src/config/families.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'FAMILY_TREE_');
  const familyEnv = Object.fromEntries(
    Object.entries(env).filter(([k]) => k.startsWith('FAMILY_TREE_')),
  );
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
