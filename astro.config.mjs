import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import react from '@astrojs/react';

/**
 * PUBLIC_SITE_URL is an ORIGIN ONLY, e.g. "https://USERNAME.github.io".
 * The GitHub Pages project sub-path lives in `base` and is appended exactly
 * once, by src/lib/site.ts. See finding F5.
 */
const BASE_PATH = '/articleforge';

/** Public vars a real deployment needs. Placeholders are fine for local work. */
const REQUIRED_PUBLIC_ENV = ['PUBLIC_SITE_URL', 'PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_ANON_KEY'];

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production';
const fileEnv = loadEnv(mode, process.cwd(), '');
const publicEnv = { ...fileEnv, ...process.env };

/** Reduces any configured URL to a bare origin so `${site}${base}` can't double up. */
function toOrigin(raw) {
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

/**
 * F19: a deploy that silently renders an empty site is worse than a failed
 * build. Set PUBLIC_ENV_STRICT=1 (the deploy workflow does) to make missing
 * public env vars fatal; otherwise the build proceeds with a loud warning so
 * local/offline work stays possible.
 */
function publicEnvGuard() {
  return {
    name: 'articleforge:public-env-guard',
    hooks: {
      'astro:config:setup': ({ logger }) => {
        const missing = REQUIRED_PUBLIC_ENV.filter((key) => !publicEnv[key]);
        if (missing.length === 0) return;
        const detail =
          `Missing public env var(s): ${missing.join(', ')}. ` +
          'Canonical/OG URLs will use a placeholder origin and no published article pages will be generated.';
        if (publicEnv.PUBLIC_ENV_STRICT === '1') {
          throw new Error(`[articleforge] ${detail} PUBLIC_ENV_STRICT=1 makes this fatal.`);
        }
        logger.warn(`${detail} Set PUBLIC_ENV_STRICT=1 to fail the build instead.`);
      }
    }
  };
}

export default defineConfig({
  site: toOrigin(publicEnv.PUBLIC_SITE_URL),
  base: BASE_PATH,
  output: 'static',
  integrations: [react(), publicEnvGuard()]
});
