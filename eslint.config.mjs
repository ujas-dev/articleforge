import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.astro/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs,astro}'],
    languageOptions: {
      globals: { ...globals.browser }
    }
  },
  {
    // Build tooling and config files run under Node, not in the browser.
    files: ['*.{js,mjs,cjs}', 'scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },
  {
    // Supabase Edge Functions run on Deno.
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: { Deno: 'readonly' }
    }
  },
  {
    files: ['src/**/*.test.ts'],
    languageOptions: {
      globals: { ...globals.node }
    }
  }
];
