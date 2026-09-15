import { getSupabase } from './supabase';
import { slugify } from './slugify';
import { transition, type ArticleStatus } from './article-state';
import { toFriendlyError } from './errors';
import { findBuiltInTemplate } from './templates';

/**
 * Column list kept in one place so selects cannot drift from the schema in
 * supabase/migrations/0001_init.sql (the article template column is
 * `template_id`, not `template` - finding F2).
 */
export const ARTICLE_COLUMNS =
  'id, title, slug, keyword, content_html, status, published_at, template_id, seo_json, created_at';

export interface ArticleRecord {
  id: string;
  title: string;
  slug: string;
  keyword: string;
  content_html: string;
  status: ArticleStatus;
  published_at: string | null;
  template_id: string | null;
  seo_json: Record<string, unknown> | null;
  created_at: string;
}

export async function ensureUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const sb = getSupabase();
  const base = slugify(title);
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    const { data, error } = await sb.from('articles').select('id').eq('slug', candidate).limit(1);
    if (error) throw toFriendlyError(error, 'Slug check');
    const clash = data?.find((row) => row.id !== excludeId);
    if (!clash) return candidate;
    candidate = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Maps a built-in template slug ('how-to', ...) onto the seeded
 * public.templates row so articles can carry a real `template_id` FK (F2).
 * Unknown/blank slugs simply leave the column null.
 */
export async function resolveTemplateId(templateSlug: string | null | undefined): Promise<string | null> {
  if (!templateSlug) return null;
  const builtIn = findBuiltInTemplate(templateSlug);
  if (!builtIn) return null;
  const sb = getSupabase();
  const { data, error } = await sb.from('templates').select('id').eq('name', builtIn.name).maybeSingle();
  if (error) throw toFriendlyError(error, 'Template lookup');
  return (data as { id: string } | null)?.id ?? null;
}

export async function createArticle(input: {
  title: string;
  keyword: string;
  contentHtml?: string;
  templateId?: string | null;
}): Promise<ArticleRecord> {
  const sb = getSupabase();
  // getUser() validates the token with Supabase Auth; getSession() only reads
  // whatever happens to be in storage (finding F15).
  const { data: auth, error: authError } = await sb.auth.getUser();
  const user = auth?.user;
  if (authError || !user) throw new Error('Not authenticated');
  const slug = await ensureUniqueSlug(input.title);
  const { data, error } = await sb
    .from('articles')
    .insert({
      author_id: user.id,
      title: input.title,
      slug,
      keyword: input.keyword,
      content_html: input.contentHtml ?? '',
      template_id: input.templateId ?? null,
      status: 'draft'
    })
    .select(ARTICLE_COLUMNS)
    .single();
  if (error) throw toFriendlyError(error, 'Create draft');
  return data as ArticleRecord;
}

/**
 * Published URLs are live, so re-slugging is only allowed while an article is
 * not published (finding F16).
 */
async function nextSlugFor(id: string, title: string): Promise<string | undefined> {
  const sb = getSupabase();
  const { data, error } = await sb.from('articles').select('status').eq('id', id).single();
  if (error) throw toFriendlyError(error, 'Load article');
  if ((data as { status: ArticleStatus }).status === 'published') return undefined;
  return ensureUniqueSlug(title, id);
}

export async function updateArticle(
  id: string,
  patch: { title?: string; keyword?: string; content_html?: string; seo_json?: Record<string, unknown> }
): Promise<ArticleRecord> {
  const sb = getSupabase();
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    update.title = patch.title;
    const slug = await nextSlugFor(id, patch.title);
    if (slug !== undefined) update.slug = slug;
  }
  if (patch.keyword !== undefined) update.keyword = patch.keyword;
  if (patch.content_html !== undefined) update.content_html = patch.content_html;
  if (patch.seo_json !== undefined) update.seo_json = patch.seo_json;
  const { data, error } = await sb.from('articles').update(update).eq('id', id).select(ARTICLE_COLUMNS).single();
  if (error) throw toFriendlyError(error, 'Save');
  return data as ArticleRecord;
}

export async function changeStatus(
  id: string,
  current: { status: ArticleStatus; published_at: string | null },
  next: ArticleStatus
): Promise<ArticleRecord> {
  const result = transition(current, next);
  if (!result.ok) throw new Error(result.error);
  const sb = getSupabase();
  const { data, error } = await sb
    .from('articles')
    .update({ status: result.status, published_at: result.published_at })
    .eq('id', id)
    .select(ARTICLE_COLUMNS)
    .single();
  if (error) throw toFriendlyError(error, 'Publish');
  return data as ArticleRecord;
}

export async function softDeleteArticle(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('articles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw toFriendlyError(error, 'Delete');
}

export interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  keyword: string;
  status: ArticleStatus;
  published_at: string | null;
  created_at: string;
}

export async function listArticles(): Promise<ArticleListItem[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('articles')
    .select('id, title, slug, keyword, status, published_at, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw toFriendlyError(error, 'Load articles');
  return (data ?? []) as ArticleListItem[];
}

/** Single-article load used by the editor (finding F3: the id comes from ?id=). */
export async function getArticle(id: string): Promise<ArticleRecord> {
  const sb = getSupabase();
  const { data, error } = await sb.from('articles').select(ARTICLE_COLUMNS).eq('id', id).single();
  if (error) throw toFriendlyError(error, 'Load article');
  return data as ArticleRecord;
}
