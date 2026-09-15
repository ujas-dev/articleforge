import sanitizeHtml from 'sanitize-html';
import { ALLOWED_IFRAME_HOSTNAMES } from './media';

/**
 * Class tokens that survive sanitizing, per tag. Everything else is dropped,
 * so `class` cannot be used to smuggle in a stylesheet hook that this codebase
 * does not know about (styling for these lives in src/styles/global.css).
 */
const ALLOWED_CLASSES: Record<string, string[]> = {
  figure: ['af-video']
};

/**
 * Allow-list sanitizer for article bodies. Applied on save (editor) and again
 * at build time, because stored HTML is injected with `set:html`.
 *
 * `disallowTagsNested` is NOT a sanitize-html option and was silently ignored
 * (finding F24) - the allow-list below is the actual control.
 *
 * Media (spec FR-2) is deny-by-default on three axes:
 *   - tags: only the tags listed below exist in the output;
 *   - schemes: `src`/`href` must be http/https/mailto (so `data:`, `blob:`,
 *     `file:` and protocol-relative URLs are stripped);
 *   - iframe hosts: `allowedIframeHostnames` + `allowedSchemesByTag` restrict an
 *     embed to an https URL on a provider we ship an embed URL builder for
 *     (src/lib/media.ts), and `exclusiveFilter` deletes the whole `<iframe>`
 *     when its `src` did not survive - a stripped `src` never leaves an empty
 *     frame behind.
 */
export function sanitizeArticleHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'h4', 'ul', 'ol', 'li',
      'a', 'code', 'pre', 'blockquote', 'figure', 'figcaption', 'img', 'iframe'
    ],
    allowedAttributes: {
      a: ['href', 'title', 'rel', 'target'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      iframe: ['src', 'title', 'width', 'height', 'loading', 'allow', 'allowfullscreen', 'referrerpolicy'],
      figure: [{ name: 'class', multiple: true, values: ALLOWED_CLASSES.figure }],
      '*': ['id']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    // An embed is https-only, even if the rest of the document may use http.
    allowedSchemesByTag: { iframe: ['https'] },
    // Reject `data:`/`blob:`/`file:` images and protocol-relative URLs outright.
    allowProtocolRelative: false,
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    // An origin allow-list: https + one of these exact hostnames.
    allowedIframeHostnames: ALLOWED_IFRAME_HOSTNAMES,
    // "/embed/x" on some other host is not an embed we can vouch for.
    allowIframeRelativeUrls: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: 'noopener noreferrer' }
      }),
      // Below-the-fold media never blocks the first paint (NFR-2).
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, loading: 'lazy', decoding: 'async' }
      }),
      iframe: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, loading: 'lazy', referrerpolicy: 'strict-origin-when-cross-origin' }
      })
    },
    // Returning true discards the tag AND its contents. `frame.attribs` is the
    // post-filter object, so an iframe whose src failed the host/scheme check
    // is gone entirely rather than rendered as an empty frame.
    exclusiveFilter: (frame) => frame.tag === 'iframe' && !frame.attribs.src
  });
}
