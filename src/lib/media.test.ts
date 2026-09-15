import { describe, it, expect } from 'vitest';
import {
  ALLOWED_IFRAME_HOSTNAMES,
  imageHtml,
  isAllowedEmbedUrl,
  parseVideoEmbed,
  safeImageSrc,
  videoEmbedHtml
} from './media';

/**
 * The provider allow-list (spec FR-2). Everything the editor inserts is built
 * here, so these tests pin the two properties that matter: only allow-listed
 * providers are ever turned into an embed URL, and every interpolated value is
 * escaped rather than concatenated raw.
 */
describe('parseVideoEmbed (T2.2)', () => {
  describe('accepts real YouTube links', () => {
    const cases: { name: string; input: string; id: string }[] = [
      { name: 'watch URL', input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', id: 'dQw4w9WgXcQ' },
      { name: 'watch URL with extra params', input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', id: 'dQw4w9WgXcQ' },
      { name: 'short share URL', input: 'https://youtu.be/dQw4w9WgXcQ', id: 'dQw4w9WgXcQ' },
      { name: 'short share URL with a timestamp', input: 'https://youtu.be/dQw4w9WgXcQ?t=42', id: 'dQw4w9WgXcQ' },
      { name: 'mobile URL', input: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ', id: 'dQw4w9WgXcQ' },
      { name: 'shorts URL', input: 'https://www.youtube.com/shorts/dQw4w9WgXcQ', id: 'dQw4w9WgXcQ' },
      { name: 'live URL', input: 'https://www.youtube.com/live/dQw4w9WgXcQ', id: 'dQw4w9WgXcQ' },
      { name: 'existing nocookie embed URL', input: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', id: 'dQw4w9WgXcQ' }
    ];

    for (const { name, input, id } of cases) {
      it(`converts a ${name} to the privacy-friendly embed host`, () => {
        const embed = parseVideoEmbed(input);
        expect(embed).toEqual({
          provider: 'youtube',
          embedUrl: `https://www.youtube-nocookie.com/embed/${id}`
        });
      });
    }

    it('upgrades an http watch URL to https', () => {
      const embed = parseVideoEmbed('http://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(embed?.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    });

    it('tolerates surrounding whitespace', () => {
      expect(parseVideoEmbed('  https://youtu.be/dQw4w9WgXcQ  ')?.embedUrl).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
      );
    });
  });

  describe('accepts real Vimeo links', () => {
    const cases: { name: string; input: string; id: string }[] = [
      { name: 'canonical URL', input: 'https://vimeo.com/123456789', id: '123456789' },
      { name: 'www URL', input: 'https://www.vimeo.com/123456789', id: '123456789' },
      { name: 'unlisted URL with a hash', input: 'https://vimeo.com/123456789/abcdef1234', id: '123456789' },
      { name: 'channels URL', input: 'https://vimeo.com/channels/staffpicks/123456789', id: '123456789' },
      { name: 'existing player embed URL', input: 'https://player.vimeo.com/video/123456789', id: '123456789' }
    ];

    for (const { name, input, id } of cases) {
      it(`converts a ${name} to the player embed URL`, () => {
        expect(parseVideoEmbed(input)).toEqual({
          provider: 'vimeo',
          embedUrl: `https://player.vimeo.com/video/${id}`
        });
      });
    }
  });

  describe('rejects everything else (visible message in the editor)', () => {
    const rejected: { name: string; input: unknown }[] = [
      { name: 'a non-provider host', input: 'https://evil.example/watch?v=dQw4w9WgXcQ' },
      { name: 'a look-alike host', input: 'https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ' },
      { name: 'a suffix look-alike host', input: 'https://notyoutube.com/watch?v=dQw4w9WgXcQ' },
      { name: 'a data: URL', input: 'data:text/html,<script>alert(1)</script>' },
      { name: 'a javascript: URL', input: 'javascript:alert(1)' },
      { name: 'a file: URL', input: 'file:///etc/passwd' },
      { name: 'a scheme-less host', input: 'youtu.be/dQw4w9WgXcQ' },
      { name: 'plain text', input: 'my favourite video' },
      { name: 'an empty string', input: '' },
      { name: 'a whitespace-only string', input: '   ' },
      { name: 'a non-string', input: 42 },
      { name: 'null', input: null },
      { name: 'undefined', input: undefined },
      { name: 'a YouTube URL with no video id', input: 'https://www.youtube.com/watch?v=' },
      { name: 'a YouTube URL with a malformed id', input: 'https://youtu.be/short' },
      { name: 'a Vimeo URL with a non-numeric id', input: 'https://vimeo.com/not-a-video' },
      { name: 'a Vimeo staff page', input: 'https://vimeo.com/staff' }
    ];

    for (const { name, input } of rejected) {
      it(`returns null for ${name}`, () => {
        expect(parseVideoEmbed(input)).toBeNull();
      });
    }
  });
});

describe('isAllowedEmbedUrl', () => {
  it('accepts an https URL on an allow-listed provider host', () => {
    for (const host of ALLOWED_IFRAME_HOSTNAMES) {
      expect(isAllowedEmbedUrl(`https://${host}/embed/x`)).toBe(true);
    }
  });

  it('rejects http, other hosts and non-strings', () => {
    expect(isAllowedEmbedUrl('http://www.youtube.com/embed/x')).toBe(false);
    expect(isAllowedEmbedUrl('https://evil.example/embed/x')).toBe(false);
    expect(isAllowedEmbedUrl('data:text/html,x')).toBe(false);
    expect(isAllowedEmbedUrl(null)).toBe(false);
  });
});

describe('safeImageSrc', () => {
  it('accepts absolute http(s) URLs', () => {
    expect(safeImageSrc('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
  });

  it('rejects data:, protocol-relative and relative sources', () => {
    expect(safeImageSrc('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(safeImageSrc('//cdn.example/a.png')).toBeNull();
    expect(safeImageSrc('/a.png')).toBeNull();
    expect(safeImageSrc('javascript:alert(1)')).toBeNull();
    expect(safeImageSrc(undefined)).toBeNull();
  });
});

describe('HTML builders escape rather than concatenate (never insert raw user HTML)', () => {
  const payload = '"><script>alert(1)</script>';

  it('emits a figure with a caption, escaping the caption text', () => {
    const html = imageHtml({ src: 'https://cdn.example/a.png', alt: payload, caption: payload });
    expect(html.startsWith('<figure>')).toBe(true);
    expect(html).toContain('<figcaption>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('alt=""><script');
  });

  it('emits a bare img when there is no caption', () => {
    const html = imageHtml({ src: 'https://cdn.example/a.png', alt: 'A' });
    expect(html).not.toContain('<figure>');
    expect(html.startsWith('<img ')).toBe(true);
  });

  it('emits width/height only when both are usable integers', () => {
    expect(imageHtml({ src: 'https://cdn.example/a.png', alt: '', width: '1200', height: '630' })).toContain('width="1200" height="630"');
    expect(imageHtml({ src: 'https://cdn.example/a.png', alt: '', width: 'wide', height: '' })).not.toContain('width=');
  });

  it('refuses to build an image from a rejected source', () => {
    expect(imageHtml({ src: 'data:image/png;base64,AAAA', alt: 'x' })).toBe('');
    expect(imageHtml({ src: '', alt: 'x' })).toBe('');
  });

  it('emits an aspect-ratio figure for an allow-listed embed', () => {
    const html = videoEmbedHtml({
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      title: payload,
      caption: payload
    });
    expect(html.startsWith('<figure class="af-video">')).toBe(true);
    expect(html).toContain('<iframe ');
    expect(html).toContain('allowfullscreen');
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<figcaption>');
  });

  it('omits the figcaption when there is no caption', () => {
    const html = videoEmbedHtml({ embedUrl: 'https://player.vimeo.com/video/123456789', title: 'V' });
    expect(html).not.toContain('<figcaption>');
    expect(html).toContain('</iframe></figure>');
  });

  it('refuses to build an embed from a non-allow-listed URL', () => {
    expect(videoEmbedHtml({ embedUrl: 'https://evil.example/embed/x', title: 'x' })).toBe('');
    expect(videoEmbedHtml({ embedUrl: 'javascript:alert(1)', title: 'x' })).toBe('');
    expect(videoEmbedHtml({ embedUrl: 'http://www.youtube.com/embed/x', title: 'x' })).toBe('');
  });

  it('normalises the src so quotes cannot break out of the attribute', () => {
    const html = videoEmbedHtml({ embedUrl: 'https://www.youtube.com/embed/x " onload="alert(1)', title: 'v' });
    expect(html).not.toMatch(/onload="alert/);
    expect(html.match(/<iframe/g)?.length).toBe(1);
  });
});
