import { heuristicStrategy, type FaqEntry, type SeoStrategy } from './seo';
import { siteBase } from './site';

/**
 * articles.seo_json, both as round-1 rows wrote it (a flat `Partial<SeoStrategy>`)
 * and as the editor writes it now (the same shape plus manual SEO overrides).
 *
 * The extension is additive: every new key is optional, so an existing row
 * parses to exactly the strategy fields it always had (finding-free backward
 * compatibility), and any field the creator has not overridden keeps falling
 * back to the deterministic heuristic.
 */
export interface SeoOverrides {
  /** Complete `<title>` / `og:title`. Empty -> the generated strategy title. */
  title?: string;
  /** `<meta name="description">` / `og:description`. Empty -> generated. */
  metaDescription?: string;
  /** Site-relative canonical path, e.g. `/articles/my-post/`. */
  canonicalPath?: string;
  /** Absolute http(s) `og:image` / `twitter:image`. */
  ogImage?: string;
  /** `@handle` for `twitter:site`. */
  twitterHandle?: string;
  /** Appended to the title tag at render time (site-level default, stored per article). */
  titleSuffix?: string;
  /** true -> `<meta name="robots" content="noindex, nofollow">`. */
  noindex?: boolean;
}

export type StoredSeo = Partial<SeoStrategy> & SeoOverrides;

/**
 * Length caps: generous for a hand-written tag, small enough to bound the
 * `seo_json` row, and applied on every write so stored values cannot grow
 * without limit.
 */
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 320;
const MAX_FAQ_ANSWER = 1000;
const MAX_PATH = 200;
const MAX_URL = 2048;
const MAX_SUFFIX = 60;

/** Site-level default when nothing is configured (matches the round-1 layout). */
export const DEFAULT_TITLE_SUFFIX = ' | ArticleForge';

/** Collapses whitespace, trims, caps. Returns undefined for an empty result. */
function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned ? cleaned.slice(0, max) : undefined;
}

function stringList(value: unknown, max = 200): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .map((item) => item.slice(0, max));
  return items.length > 0 ? items : undefined;
}

function faqList(value: unknown): FaqEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries: FaqEntry[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const q = text(record.q, 300);
    const a = text(record.a, MAX_FAQ_ANSWER);
    if (q && a) entries.push({ q, a });
  }
  return entries.length > 0 ? entries : undefined;
}

/** Absolute http(s) URL, or undefined. `data:`/`javascript:`/relative all fail. */
export function normaliseOgImage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL || trimmed.startsWith('//')) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * Site-relative canonical path.
 *
 * Anything with a non-http scheme (`javascript:`, `data:`, `mailto:`) is
 * rejected outright; a relative path is normalised to start with `/`; and if
 * the author pasted a path that already carries the deploy sub-path
 * (`/articleforge/app/`) it is reduced once, so `src/lib/site.ts` can append the
 * base exactly once and never double it up.
 */
export function normaliseCanonicalPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  let raw = value.trim();
  if (!raw || raw.length > MAX_PATH) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
      raw = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return undefined;
    }
  }
  if (raw.startsWith('//')) return undefined;
  // No traversal segments: a canonical must stay inside this site.
  if (/(^|\/)\.\.(\/|$)/.test(raw)) return undefined;
  if (!raw.startsWith('/')) raw = `/${raw}`;
  const base = siteBase();
  if (base && (raw === base || raw.startsWith(`${base}/`))) raw = raw.slice(base.length) || '/';
  return raw.startsWith('/') ? raw : undefined;
}

/** `@handle` (max 15 chars, X's limit). A pasted profile URL is accepted too. */
export function normaliseTwitterHandle(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL) return undefined;
  const withoutUrl = trimmed.replace(/^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\//i, '');
  const handle = withoutUrl.replace(/^@+/, '').replace(/\/+$/, '');
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? `@${handle}` : undefined;
}

/**
 * Title suffix. Leading/trailing spaces are PRESERVED because they are the
 * separator (`" | My Site"`), so only newlines are collapsed.
 */
export function normaliseTitleSuffix(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[\r\n\t]+/g, ' ').slice(0, MAX_SUFFIX);
  return cleaned.trim() ? cleaned : undefined;
}

/**
 * Trust boundary: `seo_json` comes back from Postgres as `unknown` and is later
 * interpolated into the document, so every field is re-validated here rather
 * than at each use site.
 */
export function parseStoredSeo(raw: unknown): StoredSeo {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const value = raw as Record<string, unknown>;
  const parsed: StoredSeo = {};
  const title = text(value.title, MAX_TITLE);
  if (title) parsed.title = title;
  const metaDescription = text(value.metaDescription, MAX_DESCRIPTION);
  if (metaDescription) parsed.metaDescription = metaDescription;
  const h1 = text(value.h1, MAX_TITLE);
  if (h1) parsed.h1 = h1;
  const outline = stringList(value.outline);
  if (outline) parsed.outline = outline;
  const faq = faqList(value.faq);
  if (faq) parsed.faq = faq;
  const internalLinks = stringList(value.internalLinks);
  if (internalLinks) parsed.internalLinks = internalLinks;
  const canonicalPath = normaliseCanonicalPath(value.canonicalPath);
  if (canonicalPath) parsed.canonicalPath = canonicalPath;
  const ogImage = normaliseOgImage(value.ogImage);
  if (ogImage) parsed.ogImage = ogImage;
  const twitterHandle = normaliseTwitterHandle(value.twitterHandle);
  if (twitterHandle) parsed.twitterHandle = twitterHandle;
  const titleSuffix = normaliseTitleSuffix(value.titleSuffix);
  if (titleSuffix) parsed.titleSuffix = titleSuffix;
  if (value.noindex === true) parsed.noindex = true;
  return parsed;
}

/**
 * Normalises the editor's form values into the persisted override shape. A
 * cleared field is omitted rather than stored as `""`, so "clear the box" means
 * "fall back to automatic" both on write and on read.
 */
export function serializeSeoOverrides(input: {
  title?: unknown;
  metaDescription?: unknown;
  canonicalPath?: unknown;
  ogImage?: unknown;
  twitterHandle?: unknown;
  titleSuffix?: unknown;
  noindex?: unknown;
}): SeoOverrides {
  const overrides: SeoOverrides = {};
  const title = text(input.title, MAX_TITLE);
  if (title) overrides.title = title;
  const metaDescription = text(input.metaDescription, MAX_DESCRIPTION);
  if (metaDescription) overrides.metaDescription = metaDescription;
  const canonicalPath = normaliseCanonicalPath(input.canonicalPath);
  if (canonicalPath) overrides.canonicalPath = canonicalPath;
  const ogImage = normaliseOgImage(input.ogImage);
  if (ogImage) overrides.ogImage = ogImage;
  const twitterHandle = normaliseTwitterHandle(input.twitterHandle);
  if (twitterHandle) overrides.twitterHandle = twitterHandle;
  const titleSuffix = normaliseTitleSuffix(input.titleSuffix);
  if (titleSuffix) overrides.titleSuffix = titleSuffix;
  if (input.noindex === true) overrides.noindex = true;
  return overrides;
}

/**
 * Writes the panel's overrides over an already-stored `seo_json` without losing
 * the strategy fields (h1/outline/faq/internalLinks) the SEO generator applied.
 */
export function applySeoOverrides(stored: StoredSeo, overrides: SeoOverrides): StoredSeo {
  const next: StoredSeo = { ...stored };
  delete next.title;
  delete next.metaDescription;
  delete next.canonicalPath;
  delete next.ogImage;
  delete next.twitterHandle;
  delete next.titleSuffix;
  delete next.noindex;
  return { ...next, ...overrides };
}

export interface ResolvedSeo {
  /** Generated-or-stored strategy, with every field present (used for the outline/FAQ/JSON-LD). */
  strategy: SeoStrategy;
  /** Effective `<title>` / `og:title`, without the suffix. */
  title: string;
  /** Effective meta description / `og:description`. */
  metaDescription: string;
  /** Site-relative path, already de-based for src/lib/site.ts. */
  canonicalPath: string;
  /** Site-level fallback lives in Base.astro; undefined means "use the bundled image". */
  ogImage?: string;
  twitterHandle?: string;
  titleSuffix: string;
  noindex: boolean;
}

/**
 * The single precedence rule for every SEO surface:
 *   manual override (stored) -> generated strategy -> heuristic fallback.
 */
export function resolveSeo(input: {
  title: string;
  keyword: string;
  slug: string;
  seo?: unknown;
}): ResolvedSeo {
  const stored = parseStoredSeo(input.seo);
  const fallback = heuristicStrategy(input.keyword.trim() || input.title.trim());
  const strategy: SeoStrategy = {
    title: stored.title || fallback.title,
    metaDescription: stored.metaDescription || fallback.metaDescription,
    h1: stored.h1 || fallback.h1,
    outline: stored.outline?.length ? stored.outline : fallback.outline,
    faq: stored.faq?.length ? stored.faq : fallback.faq,
    internalLinks: stored.internalLinks?.length ? stored.internalLinks : fallback.internalLinks
  };
  return {
    strategy,
    title: strategy.title,
    metaDescription: strategy.metaDescription,
    // The slug is DB data, so the generated fallback goes through the same
    // validator as a hand-typed path (rejects a scheme, de-bases, forces "/").
    canonicalPath: stored.canonicalPath ?? normaliseCanonicalPath(`/articles/${input.slug}/`) ?? '/',
    ogImage: stored.ogImage,
    twitterHandle: stored.twitterHandle,
    titleSuffix: stored.titleSuffix ?? DEFAULT_TITLE_SUFFIX,
    noindex: stored.noindex === true
  };
}

/* ------------------------------------------------------------------ *
 * Site-level defaults (spec FR-10) - persisted on profiles.settings_json
 * ------------------------------------------------------------------ */

export interface SiteSeoDefaults {
  ogImage?: string;
  twitterHandle?: string;
  titleSuffix: string;
}

/** Reads `profiles.settings_json` -> the four site-level SEO defaults. */
export function parseSiteSeo(raw: unknown): SiteSeoDefaults {
  const settings = typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const seo = typeof settings.seo === 'object' && settings.seo !== null && !Array.isArray(settings.seo)
    ? (settings.seo as Record<string, unknown>)
    : {};
  return {
    ogImage: normaliseOgImage(seo.ogImage),
    twitterHandle: normaliseTwitterHandle(seo.twitterHandle),
    titleSuffix: normaliseTitleSuffix(seo.titleSuffix) ?? DEFAULT_TITLE_SUFFIX
  };
}

/**
 * Merges the SEO defaults into an existing `settings_json` object so unrelated
 * keys survive the save (the column is shared).
 */
export function mergeSiteSeo(
  existing: unknown,
  input: { ogImage?: unknown; twitterHandle?: unknown; titleSuffix?: unknown }
): Record<string, unknown> {
  const base = typeof existing === 'object' && existing !== null && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {};
  const seo: Record<string, string> = {};
  const ogImage = normaliseOgImage(input.ogImage);
  if (ogImage) seo.ogImage = ogImage;
  const twitterHandle = normaliseTwitterHandle(input.twitterHandle);
  if (twitterHandle) seo.twitterHandle = twitterHandle;
  const titleSuffix = normaliseTitleSuffix(input.titleSuffix);
  if (titleSuffix) seo.titleSuffix = titleSuffix;
  return { ...base, seo };
}
