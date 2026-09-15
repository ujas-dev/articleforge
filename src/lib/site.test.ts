import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * F5 regression guard: the deploy environment already contains the repo name,
 * so `${site}${base}` used to produce /articleforge/articleforge/... twice.
 * vitest.config.ts sets `base: '/articleforge'` to mirror the Astro build.
 */
async function loadSite(publicSiteUrl: string | undefined) {
  if (publicSiteUrl === undefined) vi.stubEnv('PUBLIC_SITE_URL', '');
  else vi.stubEnv('PUBLIC_SITE_URL', publicSiteUrl);
  vi.resetModules();
  return import('./site');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('site URL helpers (F5)', () => {
  it('applies the deploy sub-path exactly once', async () => {
    const { absoluteUrl, sitePath, siteBase } = await loadSite('https://ujasdev.github.io');

    expect(siteBase()).toBe('/articleforge');
    expect(sitePath('/app/')).toBe('/articleforge/app/');
    expect(absoluteUrl('/app/')).toBe('https://ujasdev.github.io/articleforge/app/');
    expect(absoluteUrl('/')).toBe('https://ujasdev.github.io/articleforge/');
  });

  it('treats PUBLIC_SITE_URL as an origin even when it still has the repo path', async () => {
    const { absoluteUrl, SITE_ORIGIN } = await loadSite('https://ujasdev.github.io/articleforge');

    expect(SITE_ORIGIN).toBe('https://ujasdev.github.io');
    expect(absoluteUrl('/articles/best-shoes/')).toBe(
      'https://ujasdev.github.io/articleforge/articles/best-shoes/'
    );
    expect(absoluteUrl('/articles/best-shoes/').match(/articleforge/g)).toHaveLength(1);
  });

  it('tolerates a trailing slash and no scheme-less input', async () => {
    const { absoluteUrl } = await loadSite('https://ujasdev.github.io/');
    expect(absoluteUrl('/sitemap.xml')).toBe('https://ujasdev.github.io/articleforge/sitemap.xml');
  });

  it('accepts paths without a leading slash', async () => {
    const { sitePath, absoluteUrl } = await loadSite('https://ujasdev.github.io');
    expect(sitePath('app/')).toBe('/articleforge/app/');
    expect(absoluteUrl('og-image.png')).toBe('https://ujasdev.github.io/articleforge/og-image.png');
  });

  it('falls back to a single documented placeholder origin when unset (F19)', async () => {
    const { SITE_ORIGIN, DEFAULT_SITE_ORIGIN, absoluteUrl } = await loadSite(undefined);

    expect(SITE_ORIGIN).toBe(DEFAULT_SITE_ORIGIN);
    expect(absoluteUrl('/')).toBe(`${DEFAULT_SITE_ORIGIN}/articleforge/`);
  });

  it('never double-applies base for a pathname that already includes it', async () => {
    const { absoluteFromPath, SITE_ORIGIN } = await loadSite('https://ujasdev.github.io');

    expect(absoluteFromPath('/articleforge/app/analytics/')).toBe(
      `${SITE_ORIGIN}/articleforge/app/analytics/`
    );
  });
});
