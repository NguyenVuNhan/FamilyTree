import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
    languageOptions: { globals: { ...globals.browser, __FAMILY_ENV__: 'readonly' } },
  },
  {
    // Standalone Node scripts (e.g. the e2e fixture server) run outside the browser bundle.
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
);
