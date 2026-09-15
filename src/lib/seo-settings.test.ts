import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TITLE_SUFFIX,
  applySeoOverrides,
  mergeSiteSeo,
  normaliseCanonicalPath,
  normaliseOgImage,
  normaliseTitleSuffix,
  normaliseTwitterHandle,
  parseSiteSeo,
  parseStoredSeo,
  resolveSeo,
  serializeSeoOverrides
} from './seo-settings';
import { heuristicStrategy } from './seo';

/**
 * articles.seo_json carries both the generated strategy and the creator's manual
 * overrides (spec FR-6/FR-10). These tests pin the serialisation contract: what
 * the editor writes is what the build reads back, and a round-1 row keeps
 * working unchanged.
 */
describe('SEO override serialisation and round-trip (FR-10)', () => {
  it('round-trips every panel field through JSON unchanged', () => {
    const panel = {
      title: '  Best Running Shoes  ',
      metaDescription: 'A practical guide to the best running shoes for 2026.',
      canonicalPath: '/articles/best-running-shoes/',
      ogImage: 'https://cdn.example.com/og/shoes.png',
      noindex: true
    };
    const stored = serializeSeoOverrides(panel);
    // Exactly what Supabase does: JSON in, JSON out.
    const reloaded = parseStoredSeo(JSON.parse(JSON.stringify(stored)));
    expect(reloaded).toEqual(stored);
    expect(reloaded).toEqual({
      title: 'Best Running Shoes',
      metaDescription: panel.metaDescription,
      canonicalPath: panel.canonicalPath,
      ogImage: panel.ogImage,
      noindex: true
    });
  });

  it('is idempotent', () => {
    const once = serializeSeoOverrides({ title: 'T', canonicalPath: 'articles/x/', noindex: true });
    expect(serializeSeoOverrides(once)).toEqual(once);
    expect(parseStoredSeo(once)).toEqual(once);
  });

  it('omits a cleared field so it falls back to the generated value', () => {
    const cleared = serializeSeoOverrides({ title: '', metaDescription: '   ', ogImage: '', noindex: false });
    expect(cleared).toEqual({});
    expect(parseStoredSeo({ title: '', metaDescription: '   ', noindex: false })).toEqual({});
  });

  it('caps the stored lengths', () => {
    const stored = serializeSeoOverrides({ title: 'x'.repeat(500), metaDescription: 'y'.repeat(900) });
    expect(stored.title).toHaveLength(120);
    expect(stored.metaDescription).toHaveLength(320);
  });
});

describe('canonical path validation (via site.ts)', () => {
  it('accepts a site-relative path and adds the leading slash', () => {
    expect(normaliseCanonicalPath('/articles/x/')).toBe('/articles/x/');
    expect(normaliseCanonicalPath('articles/x/')).toBe('/articles/x/');
  });

  it('reduces a same-origin absolute URL to its path', () => {
    expect(normaliseCanonicalPath('https://example.github.io/articles/x/')).toBe('/articles/x/');
  });

  it('strips the deploy sub-path when the author pasted it, so the base is applied once', () => {
    // The astro `base` is /articleforge (see astro.config.mjs + vitest.config.ts).
    expect(normaliseCanonicalPath('/articleforge/articles/x/')).toBe('/articles/x/');
    expect(normaliseCanonicalPath('/articleforge')).toBe('/');
  });

  it('rejects schemes that are not http(s), and protocol-relative paths', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'mailto:a@b.c', '//evil.example/x', 'https://x'.repeat(100)]) {
      expect(normaliseCanonicalPath(bad)).toBeUndefined();
    }
    expect(normaliseCanonicalPath(undefined)).toBeUndefined();
    expect(normaliseCanonicalPath('')).toBeUndefined();
  });
});

describe('OG image and handle validation', () => {
  it('keeps only absolute http(s) OG images', () => {
    expect(normaliseOgImage('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
    expect(normaliseOgImage('http://cdn.example/a.png')).toBe('http://cdn.example/a.png');
    for (const bad of ['/og.png', '//cdn.example/a.png', 'data:image/png;base64,AAAA', 'javascript:alert(1)', '']) {
      expect(normaliseOgImage(bad)).toBeUndefined();
    }
  });

  it('normalises a Twitter/X handle, including a pasted profile URL', () => {
    expect(normaliseTwitterHandle('@MySite')).toBe('@MySite');
    expect(normaliseTwitterHandle('MySite')).toBe('@MySite');
    expect(normaliseTwitterHandle('https://x.com/MySite')).toBe('@MySite');
    expect(normaliseTwitterHandle('https://twitter.com/MySite/')).toBe('@MySite');
    for (const bad of ['My Site', 'way-too-long-a-handle', 'a'.repeat(16), '']) {
      expect(normaliseTwitterHandle(bad)).toBeUndefined();
    }
  });

  it('preserves the title suffix separator but rejects a blank suffix', () => {
    expect(normaliseTitleSuffix(' | My Site')).toBe(' | My Site');
    expect(normaliseTitleSuffix('   ')).toBeUndefined();
    expect(normaliseTitleSuffix('a\nb')).toBe('a b');
  });
});

describe('backward compatibility with the round-1 seo_json shape', () => {
  const roundOne = {
    title: 'Best Running Shoes - The Complete Guide (2026)',
    metaDescription: 'Looking for the best running shoes?',
    h1: 'Best Running Shoes',
    outline: ['What Is Best Running Shoes?', 'FAQ'],
    faq: [{ q: 'Q?', a: 'A' }],
    internalLinks: ['Best Running Shoes: alternatives compared']
  };

  it('parses a flat strategy row without inventing override values', () => {
    const parsed = parseStoredSeo(roundOne);
    expect(parsed).toEqual(roundOne);
    expect(parsed.canonicalPath).toBeUndefined();
    expect(parsed.ogImage).toBeUndefined();
    expect(parsed.noindex).toBeUndefined();
  });

  it('resolves a round-1 row to the same title/description/canonical as before', () => {
    const resolved = resolveSeo({ title: 'Best Running Shoes', keyword: 'best running shoes', slug: 'best-running-shoes', seo: roundOne });
    expect(resolved.title).toBe(roundOne.title);
    expect(resolved.metaDescription).toBe(roundOne.metaDescription);
    expect(resolved.canonicalPath).toBe('/articles/best-running-shoes/');
    expect(resolved.titleSuffix).toBe(DEFAULT_TITLE_SUFFIX);
    expect(resolved.noindex).toBe(false);
    expect(resolved.strategy.outline).toEqual(roundOne.outline);
  });

  it('falls back to the heuristic for an empty/unknown stored value', () => {
    const resolved = resolveSeo({ title: 'Best Running Shoes', keyword: 'best running shoes', slug: 'x', seo: null });
    const heuristic = heuristicStrategy('best running shoes');
    expect(resolved.strategy).toEqual(heuristic);
    expect(resolved.title).toBe(heuristic.title);
    expect(resolved.titleSuffix).toBe(DEFAULT_TITLE_SUFFIX);
  });

  it('refuses a malformed stored value instead of throwing at build time', () => {
    expect(parseStoredSeo('not an object')).toEqual({});
    expect(parseStoredSeo([1, 2])).toEqual({});
    expect(parseStoredSeo({ outline: 'x', faq: [{ q: 1 }], internalLinks: 7 })).toEqual({});
    const resolved = resolveSeo({ title: 'T', keyword: 'k', slug: 's', seo: 'nope' });
    expect(resolved.strategy).toEqual(heuristicStrategy('k'));
  });
});

describe('manual override beats generated beats heuristic (FR-6)', () => {
  const heuristic = heuristicStrategy('best running shoes');

  it('uses the manual title/description when present', () => {
    const resolved = resolveSeo({
      title: 'Best Running Shoes',
      keyword: 'best running shoes',
      slug: 'best-running-shoes',
      seo: { title: 'My Manual Title', metaDescription: 'My manual description' }
    });
    expect(resolved.title).toBe('My Manual Title');
    expect(resolved.metaDescription).toBe('My manual description');
    // The generated outline/FAQ are untouched by the manual title override.
    expect(resolved.strategy.outline).toEqual(heuristic.outline);
  });

  it('applies the canonical, OG image, suffix and noindex overrides', () => {
    const resolved = resolveSeo({
      title: 'T',
      keyword: 'k',
      slug: 's',
      seo: {
        canonicalPath: '/custom/path/',
        ogImage: 'https://cdn.example/og.png',
        titleSuffix: ' | My Site',
        twitterHandle: '@me',
        noindex: true
      }
    });
    expect(resolved.canonicalPath).toBe('/custom/path/');
    expect(resolved.ogImage).toBe('https://cdn.example/og.png');
    expect(resolved.titleSuffix).toBe(' | My Site');
    expect(resolved.twitterHandle).toBe('@me');
    expect(resolved.noindex).toBe(true);
  });

  it('sanitises the generated canonical fallback from the stored slug', () => {
    const resolved = resolveSeo({ title: 'T', keyword: 'k', slug: 'a/../b', seo: {} });
    expect(resolved.canonicalPath).toBe('/');
    // Traversal segments are rejected, so the safe fallback is the site root.
    expect(resolved.canonicalPath.startsWith('/')).toBe(true);
  });
});

describe('applySeoOverrides (editor write path)', () => {
  const strategy = { h1: 'H1', outline: ['A'], faq: [{ q: 'q', a: 'a' }], internalLinks: ['l'] };

  it('keeps the strategy fields and replaces the overrides', () => {
    const merged = applySeoOverrides({ ...strategy, title: 'Old', noindex: true }, { title: 'New' });
    expect(merged.h1).toBe('H1');
    expect(merged.outline).toEqual(['A']);
    expect(merged.title).toBe('New');
    expect(merged.noindex).toBeUndefined();
  });

  it('survives a JSON round-trip', () => {
    const merged = applySeoOverrides(strategy, serializeSeoOverrides({ title: 'T', ogImage: 'https://cdn.example/a.png' }));
    expect(parseStoredSeo(JSON.parse(JSON.stringify(merged)))).toEqual(merged);
  });
});

describe('site-level SEO defaults (FR-10, profiles.settings_json)', () => {
  it('round-trips the defaults through settings_json and keeps other keys', () => {
    const settings = mergeSiteSeo({ someOtherFeature: { keep: true } }, {
      ogImage: 'https://cdn.example/og.png',
      twitterHandle: 'mysite',
      titleSuffix: ' | My Site'
    });
    expect(settings.someOtherFeature).toEqual({ keep: true });
    const parsed = parseSiteSeo(settings);
    expect(parsed).toEqual({
      ogImage: 'https://cdn.example/og.png',
      twitterHandle: '@mysite',
      titleSuffix: ' | My Site'
    });
  });

  it('falls back to the built-in title suffix when nothing is stored', () => {
    expect(parseSiteSeo(null).titleSuffix).toBe(DEFAULT_TITLE_SUFFIX);
    expect(parseSiteSeo({}).titleSuffix).toBe(DEFAULT_TITLE_SUFFIX);
    expect(parseSiteSeo({ seo: { titleSuffix: '   ' } }).titleSuffix).toBe(DEFAULT_TITLE_SUFFIX);
  });

  it('drops an unusable default instead of storing it', () => {
    const settings = mergeSiteSeo({}, { ogImage: 'data:image/png;base64,AAAA', twitterHandle: 'My Site' });
    expect(settings.seo).toEqual({});
    expect(parseSiteSeo(settings).ogImage).toBeUndefined();
    expect(parseSiteSeo(settings).twitterHandle).toBeUndefined();
  });
});
