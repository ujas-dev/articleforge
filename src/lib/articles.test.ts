import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The Supabase client is mocked so these tests pin the *shape* of every query
 * the app issues: which table, which columns, which filters (findings F2, F15,
 * F16). A wrong column name here is a runtime 400 from PostgREST in production,
 * so it is worth asserting explicitly.
 */
const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }));

vi.mock('./supabase', () => ({
  getSupabase: () => ({ from: mocks.from, auth: { getUser: mocks.getUser } })
}));

import {
  ARTICLE_COLUMNS,
  createArticle,
  ensureUniqueSlug,
  listArticles,
  resolveTemplateId,
  updateArticle,
  changeStatus,
  softDeleteArticle
} from './articles';

interface DbResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

type CallRecorder = Record<string, unknown[][]>;

const CHAIN = ['select', 'eq', 'is', 'order', 'limit', 'insert', 'update'] as const;

function fakeBuilder(result: DbResult) {
  const calls: CallRecorder = {};
  const builder: Record<string, unknown> = {};
  for (const method of CHAIN) {
    builder[method] = (...args: unknown[]) => {
      calls[method] = [...(calls[method] ?? []), args];
      return builder;
    };
  }
  builder.single = () => Promise.resolve(result);
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (
    onFulfilled: (value: DbResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return { builder, calls };
}

/** Queues one fake query builder per upcoming `from()` call and records their args. */
function stubQueries(...results: DbResult[]): CallRecorder[] {
  const recorders: CallRecorder[] = [];
  const queue = results.map((result) => {
    const { builder, calls } = fakeBuilder(result);
    recorders.push(calls);
    return builder;
  });
  let index = 0;
  mocks.from.mockImplementation(() => queue[index++] ?? queue[queue.length - 1]);
  return recorders;
}

const ok = (data: unknown): DbResult => ({ data, error: null });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  mocks.from.mockReset();
});

describe('ARTICLE_COLUMNS', () => {
  it('uses the schema column template_id and never a bare "template" (F2)', () => {
    const columns = ARTICLE_COLUMNS.split(',').map((c) => c.trim());
    expect(columns).toContain('template_id');
    expect(columns).not.toContain('template');
  });

  it('does not expose soft-deleted bookkeeping columns it cannot render', () => {
    expect(ARTICLE_COLUMNS).not.toContain('deleted_at');
  });
});

describe('createArticle', () => {
  it('inserts template_id and a draft status, then selects the shared column list (F2)', async () => {
    const [, insertCalls] = stubQueries(ok([]), ok({ id: 'article-1', status: 'draft' }));

    await createArticle({ title: 'Best Running Shoes', keyword: 'running shoes', templateId: 'tpl-1' });

    const payload = insertCalls.insert?.[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      author_id: 'user-1',
      title: 'Best Running Shoes',
      slug: 'best-running-shoes',
      keyword: 'running shoes',
      template_id: 'tpl-1',
      status: 'draft'
    });
    expect(Object.keys(payload)).not.toContain('template');
    expect(insertCalls.select?.[0]?.[0]).toBe(ARTICLE_COLUMNS);
  });

  it('leaves template_id null when no template was chosen', async () => {
    const [, insertCalls] = stubQueries(ok([]), ok({ id: 'article-1' }));

    await createArticle({ title: 'Untemplated', keyword: 'kw' });

    expect((insertCalls.insert?.[0]?.[0] as Record<string, unknown>).template_id).toBeNull();
    expect((insertCalls.insert?.[0]?.[0] as Record<string, unknown>).content_html).toBe('');
  });

  it('validates the session with getUser(), not getSession() (F15)', async () => {
    stubQueries(ok([]), ok({ id: 'article-1' }));

    await createArticle({ title: 'Auth check', keyword: 'kw' });

    expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });

  it('refuses to insert when there is no authenticated user (F15)', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Auth session missing!' } });

    await expect(createArticle({ title: 'No session', keyword: 'kw' })).rejects.toThrow('Not authenticated');
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe('resolveTemplateId', () => {
  it('maps a built-in template slug onto the seeded templates row', async () => {
    const [lookup] = stubQueries(ok({ id: 'tpl-listicle' }));

    await expect(resolveTemplateId('listicle')).resolves.toBe('tpl-listicle');
    expect(mocks.from).toHaveBeenCalledWith('templates');
    expect(lookup.eq?.[0]).toEqual(['name', 'Listicle']);
  });

  it('returns null without querying for blank or unknown slugs', async () => {
    await expect(resolveTemplateId('')).resolves.toBeNull();
    await expect(resolveTemplateId('not-a-template')).resolves.toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('surfaces a lookup failure instead of silently dropping the template', async () => {
    stubQueries({ data: null, error: { message: 'permission denied' } });

    await expect(resolveTemplateId('faq')).rejects.toThrow('Template lookup failed: permission denied');
  });
});

describe('updateArticle', () => {
  it('does not re-slug a published article (F16)', async () => {
    const [, updateCalls] = stubQueries(ok({ status: 'published' }), ok({ id: 'a1', status: 'published' }));

    await updateArticle('a1', { title: 'A brand new title' });

    const patch = updateCalls.update?.[0]?.[0] as Record<string, unknown>;
    expect(patch.title).toBe('A brand new title');
    expect(patch).not.toHaveProperty('slug');
  });

  it('re-slugs a draft when the title changes (F16)', async () => {
    const [, slugLookup, updateCalls] = stubQueries(ok({ status: 'draft' }), ok([]), ok({ id: 'a1', status: 'draft' }));

    await updateArticle('a1', { title: 'A brand new title' });

    expect((updateCalls.update?.[0]?.[0] as Record<string, unknown>).slug).toBe('a-brand-new-title');
    expect(slugLookup.select?.[0]).toEqual(['id']);
  });

  it('maps a unique violation onto a friendly message instead of raw Postgres text (F16)', async () => {
    stubQueries(ok({ status: 'published' }), {
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "articles_slug_published_unique"' }
    });

    await expect(updateArticle('a1', { title: 'Clashing' })).rejects.toThrow(
      'That slug is already used by another published article. Try a different title.'
    );
  });
});

describe('ensureUniqueSlug', () => {
  it('returns the plain slug when nothing clashes', async () => {
    stubQueries(ok([]));
    await expect(ensureUniqueSlug('Best Running Shoes')).resolves.toBe('best-running-shoes');
  });

  it('suffixes -2 on the first clash and ignores the article being edited', async () => {
    stubQueries(ok([{ id: 'other' }]), ok([{ id: 'self' }]));
    await expect(ensureUniqueSlug('Best Running Shoes', 'self')).resolves.toBe('best-running-shoes-2');
  });

  it('fails loudly when the lookup itself errors', async () => {
    stubQueries({ data: null, error: { code: '42501', message: 'permission denied for table articles' } });
    await expect(ensureUniqueSlug('x')).rejects.toThrow('Slug check failed: you do not have access to that article.');
  });
});

describe('listArticles / changeStatus / softDeleteArticle', () => {
  it('filters out soft-deleted rows and orders newest first', async () => {
    const [calls] = stubQueries(ok([]));

    await listArticles();

    expect(calls.is?.[0]).toEqual(['deleted_at', null]);
    expect(calls.order?.[0]).toEqual(['created_at', { ascending: false }]);
  });

  it('rejects an illegal state transition before touching the database', async () => {
    await expect(
      changeStatus('a1', { status: 'draft', published_at: null }, 'archived')
    ).rejects.toThrow('cannot transition draft to archived');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('sets published_at when publishing', async () => {
    const [calls] = stubQueries(ok({ id: 'a1', status: 'published' }));

    await changeStatus('a1', { status: 'draft', published_at: null }, 'published');

    const patch = calls.update?.[0]?.[0] as Record<string, unknown>;
    expect(patch.status).toBe('published');
    expect(typeof patch.published_at).toBe('string');
  });

  it('soft deletes by stamping deleted_at', async () => {
    const [calls] = stubQueries(ok(null));

    await softDeleteArticle('a1');

    const patch = calls.update?.[0]?.[0] as Record<string, unknown>;
    expect(typeof patch.deleted_at).toBe('string');
    expect(calls.eq?.[0]).toEqual(['id', 'a1']);
  });
});
