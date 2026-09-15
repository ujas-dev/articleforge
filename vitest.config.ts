import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Mirrors astro.config.mjs so `import.meta.env.BASE_URL` in the URL helper
  // matches what the real static build produces (finding F5).
  base: '/articleforge',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
