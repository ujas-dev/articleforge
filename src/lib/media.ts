/**
 * Article media allow-list (spec FR-2).
 *
 * ONE module decides which video providers may be embedded and how a normal
 * watch/share URL maps onto an embed URL. Both ends of the pipeline import it:
 * the editor (which builds the `<iframe>` markup) and src/lib/sanitize.ts
 * (which re-checks the stored HTML at save time and again at build time), so
 * the two can never drift apart.
 *
 * The HTML builders are pure string functions that escape every interpolated
 * value, and they return '' for anything they cannot prove safe - user input is
 * never concatenated raw into the document.
 */

/**
 * Exact hostnames that may appear in an `<iframe src>` after sanitizing.
 * Feed straight into sanitize-html's `allowedIframeHostnames`; combined with
 * `allowedSchemesByTag: { iframe: ['https'] }` in sanitize.ts this is an
 * origin (scheme + host) allow-list, and everything else is stripped.
 */
export const ALLOWED_IFRAME_HOSTNAMES = [
  'www.youtube-nocookie.com',
  'www.youtube.com',
  'player.vimeo.com'
];

export type VideoProvider = 'youtube' | 'vimeo';

export interface VideoEmbed {
  provider: VideoProvider;
  /** Canonical, privacy-friendly https embed URL - safe as an iframe `src`. */
  embedUrl: string;
}

/** A YouTube video id is exactly 11 URL-safe characters. */
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
/** A Vimeo video id is 6-12 digits. */
const VIMEO_ID_RE = /^\d{6,12}$/;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be'
]);

const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

/** Path prefixes YouTube uses for a video id: /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>. */
const YOUTUBE_ID_PREFIXES = new Set(['embed', 'shorts', 'live', 'v']);

function youtubeIdFrom(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;
  const segments = url.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const id = segments[0] ?? '';
    return YOUTUBE_ID_RE.test(id) ? id : null;
  }
  const queryId = url.searchParams.get('v') ?? '';
  if (YOUTUBE_ID_RE.test(queryId)) return queryId;
  if (segments.length >= 2 && YOUTUBE_ID_PREFIXES.has(segments[0])) {
    return YOUTUBE_ID_RE.test(segments[1]) ? segments[1] : null;
  }
  return null;
}

function vimeoIdFrom(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (!VIMEO_HOSTS.has(host)) return null;
  const segments = url.pathname.split('/').filter(Boolean);
  if (host === 'player.vimeo.com') {
    return segments[0] === 'video' && VIMEO_ID_RE.test(segments[1] ?? '') ? segments[1] : null;
  }
  // /<id>, /<id>/<hash>, /channels/<name>/<id>, /groups/<g>/videos/<id>
  const numeric = segments.filter((segment) => VIMEO_ID_RE.test(segment));
  return numeric.length > 0 ? numeric[numeric.length - 1] : null;
}

/**
 * Turns a normal watch/share URL into a canonical embed description, or null
 * when the link is not from an allow-listed provider. `http:` input is accepted
 * (people paste what the address bar gives them) but the result is always
 * `https:`.
 */
export function parseVideoEmbed(raw: unknown): VideoEmbed | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // No scheme at all ("youtu.be/x") is not a link we will guess about.
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const youtubeId = youtubeIdFrom(url);
  if (youtubeId) {
    return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}` };
  }
  const vimeoId = vimeoIdFrom(url);
  if (vimeoId) {
    return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoId}` };
  }
  return null;
}

/**
 * The normalised https URL when it is on an allow-listed provider hostname,
 * otherwise null. Returns the *parsed* URL (not the raw string) so the emitted
 * attribute can never carry a quote, a space or a redirect-ish oddity that
 * `new URL` normalised away.
 */
function allowedEmbedUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  return ALLOWED_IFRAME_HOSTNAMES.includes(url.hostname) ? url.toString() : null;
}

/** True for an https URL on an allow-listed provider hostname. */
export function isAllowedEmbedUrl(raw: unknown): boolean {
  return allowedEmbedUrl(raw) !== null;
}

/**
 * Absolute http(s) image source, or null. Rejects `data:`/`blob:`/`file:`,
 * protocol-relative and relative URLs - the same policy sanitize.ts applies to
 * a stored `<img src>`.
 */
export function safeImageSrc(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('//')) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Non-empty, length-capped, trimmed plain text for a caption/title/alt. */
function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ').slice(0, max);
}

function positiveInt(raw: unknown): number | null {
  const value = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}

/**
 * `<figure class="af-video"><iframe …></iframe><figcaption>…</figcaption></figure>`
 * (the figcaption is omitted when there is no caption). Returns '' unless the
 * embed URL is on the provider allow-list - the caller shows the rejection.
 */
export function videoEmbedHtml(input: { embedUrl: unknown; title: unknown; caption?: unknown }): string {
  const src = allowedEmbedUrl(input.embedUrl);
  if (!src) return '';
  const title = cleanText(input.title, 120) || 'Embedded video';
  const caption = cleanText(input.caption, 200);
  const iframe =
    `<iframe src="${escapeAttribute(src)}" title="${escapeAttribute(title)}" loading="lazy" ` +
    `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ` +
    `allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  const captionHtml = caption ? `<figcaption>${escapeText(caption)}</figcaption>` : '';
  return `<figure class="af-video">${iframe}${captionHtml}</figure>`;
}

/**
 * `<figure><img …><figcaption>…</figcaption></figure>`, or a bare `<img>` when
 * there is no caption. `width`/`height` are emitted when known so the browser
 * can reserve the box and keep CLS at zero.
 */
export function imageHtml(input: {
  src: unknown;
  alt: unknown;
  caption?: unknown;
  width?: unknown;
  height?: unknown;
}): string {
  const src = safeImageSrc(input.src);
  if (!src) return '';
  const width = positiveInt(input.width);
  const height = positiveInt(input.height);
  const size = width && height ? ` width="${width}" height="${height}"` : '';
  const img = `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(cleanText(input.alt, 200))}"${size} />`;
  const caption = cleanText(input.caption, 200);
  return caption ? `<figure>${img}<figcaption>${escapeText(caption)}</figcaption></figure>` : img;
}
