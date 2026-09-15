import type { APIRoute } from 'astro';
import { absoluteUrl, sitePath } from '../lib/site';

/**
 * Generated at build time (not a static public/ file) so that the
 * GitHub Pages project sub-path and the sitemap URL always match the
 * configured `base` / `PUBLIC_SITE_URL` (finding F18).
 */
export const GET: APIRoute = () => {
  const body = [
    'User-agent: *',
    `Allow: ${sitePath('/')}`,
    `Disallow: ${sitePath('/app/')}`,
    '',
    `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
    ''
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
