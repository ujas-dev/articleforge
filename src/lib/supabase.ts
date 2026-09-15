import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

function publicEnv(): { url?: string; key?: string } {
  return {
    url: import.meta.env.PUBLIC_SUPABASE_URL,
    key: import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  };
}

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const { url, key } = publicEnv();
  if (!url || !key) {
    throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY');
  }
  cached = createClient(url, key);
  return cached;
}

/** True when the build was given a Supabase project to read published articles from. */
export function hasSupabaseEnv(): boolean {
  const { url, key } = publicEnv();
  return Boolean(url && key);
}

/**
 * Build-time fetch of published articles. Returns null (rather than throwing)
 * so a build without credentials still produces the static shell - the
 * astro.config.mjs env guard is what makes that state loud (finding F19).
 */
export async function fetchPublishedBuild(): Promise<ArticleRow[] | null> {
  const { url, key } = publicEnv();
  if (!url || !key) {
    console.warn(
      '[articleforge] PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY are not set: ' +
        'building with no published articles. Set PUBLIC_ENV_STRICT=1 to fail instead.'
    );
    return null;
  }
  const client = createClient(url, key);
  const { data, error } = await client
    .from('articles')
    .select('id, title, slug, keyword, content_html, published_at, seo_json, created_at, template_id')
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false });
  if (error) {
    console.warn(`[articleforge] Could not load published articles: ${error.message}`);
    return null;
  }
  return (data ?? []) as ArticleRow[];
}

export interface ArticleRow {
  id: string;
  title: string;
  slug: string;
  keyword: string;
  content_html: string;
  published_at: string | null;
  seo_json: Record<string, unknown> | null;
  created_at: string;
  template_id: string | null;
}
