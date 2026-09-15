export type ArticleStatus = 'draft' | 'published' | 'archived';

export interface ArticleLike {
  status: ArticleStatus;
  published_at: string | null;
}

export type TransitionResult =
  | { ok: true; status: ArticleStatus; published_at: string | null }
  | { ok: false; error: string };

const RULES: Record<ArticleStatus, ArticleStatus[]> = {
  draft: ['published'],
  published: ['draft', 'archived'],
  archived: ['draft']
};

export function transition(
  article: ArticleLike,
  next: ArticleStatus
): TransitionResult {
  if (!RULES[article.status].includes(next)) {
    return { ok: false, error: `cannot transition ${article.status} to ${next}` };
  }
  if (next === 'published') {
    return { ok: true, status: 'published', published_at: new Date().toISOString() };
  }
  return { ok: true, status: next, published_at: null };
}
