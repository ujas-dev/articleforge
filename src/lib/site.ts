/**
 * Single source of truth for every URL the site emits (finding F5).
 *
 * `PUBLIC_SITE_URL` is an ORIGIN ONLY - e.g. "https://USERNAME.github.io".
 * The GitHub Pages project sub-path lives in Astro's `base` and is appended
 * exactly once, here. Values that still contain the repo sub-path keep
 * working because only `url.origin` is used.
 */

/** Used when PUBLIC_SITE_URL is absent (local/offline builds); the build logs a warning. */
export const DEFAULT_SITE_ORIGIN = 'https://articleforge.example';

function toOrigin(raw: string | undefined): string {
  if (!raw) return DEFAULT_SITE_ORIGIN;
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

export const SITE_ORIGIN = toOrigin(
  import.meta.env.PUBLIC_SITE_URL ?? (import.meta.env.SITE as string | undefined)
);

/** Astro `base` without a trailing slash: "/articleforge" (or "" when base is "/"). */
export function siteBase(): string {
  const base = import.meta.env.BASE_URL || '/';
  return base === '/' ? '' : base.replace(/\/+$/, '');
}

/** Root-relative URL that honours the deploy sub-path: sitePath('/app/') -> '/articleforge/app/'. */
export function sitePath(path = '/'): string {
  return `${siteBase()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Absolute URL that honours the deploy sub-path: absoluteUrl('/app/') -> 'https://host/articleforge/app/'. */
export function absoluteUrl(path = '/'): string {
  return `${SITE_ORIGIN}${sitePath(path)}`;
}

/**
 * Absolute URL for a path that ALREADY includes the deploy sub-path
 * (e.g. `Astro.url.pathname` is '/articleforge/app/'), so no base is added.
 */
export function absoluteFromPath(pathname: string): string {
  const suffix = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${SITE_ORIGIN}${suffix}`;
}
