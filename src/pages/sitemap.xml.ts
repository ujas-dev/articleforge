import type { APIRoute } from 'astro';
import { fetchPublishedBuild } from '../lib/supabase';
import { absoluteUrl } from '../lib/site';

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  priority: string;
}

/**
 * Sitemap for the GitHub Pages project site. URLs come from the shared helper
 * so the "/articleforge" sub-path is applied exactly once (finding F5).
 */
export const GET: APIRoute = async () => {
  const articles = (await fetchPublishedBuild()) ?? [];
  const entries: SitemapEntry[] = [
    { loc: absoluteUrl('/'), priority: '1.0' },
    ...articles.map((a) => ({
      loc: absoluteUrl(`/articles/${a.slug}/`),
      lastmod: new Date(a.published_at ?? a.created_at).toISOString(),
      priority: '0.8'
    }))
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) =>
      `  <url><loc>${e.loc.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}<priority>${e.priority}</priority></url>`
  )
  .join('\n')}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
