import { describe, it, expect } from 'vitest';
import { sanitizeArticleHtml } from './sanitize';

/**
 * The allow-list is the only control protecting published pages, which inject
 * the stored HTML with `set:html` (findings F24 / stored XSS).
 */
describe('sanitizeArticleHtml (T5.4)', () => {
  describe('keeps the formatting the editor produces', () => {
    it('keeps headings, inline formatting and lists', () => {
      const out = sanitizeArticleHtml('<h2>Hi</h2><p>Some <strong>bold</strong> <em>text</em></p><ul><li>one</li></ul>');
      expect(out).toContain('<h2>Hi</h2>');
      expect(out).toContain('<strong>bold</strong>');
      expect(out).toContain('<em>text</em>');
      expect(out).toContain('<li>one</li>');
    });

    it('keeps safe links and forces rel="noopener noreferrer"', () => {
      const out = sanitizeArticleHtml('<a href="https://example.com" title="Example">x</a>');
      expect(out).toContain('href="https://example.com"');
      expect(out).toContain('title="Example"');
      expect(out).toContain('noopener noreferrer');
    });

    it('keeps mailto links and image attributes', () => {
      const out = sanitizeArticleHtml('<a href="mailto:a@b.c">mail</a><img src="https://x.example/y.png" alt="a" width="10">');
      expect(out).toContain('mailto:a@b.c');
      expect(out).toContain('src="https://x.example/y.png"');
      expect(out).toContain('alt="a"');
      expect(out).toContain('width="10"');
    });

    it('keeps code and pre blocks', () => {
      const out = sanitizeArticleHtml('<pre><code>const a = 1;</code></pre>');
      expect(out).toContain('<pre><code>const a = 1;</code></pre>');
    });
  });

  describe('bypass corpus', () => {
    const corpus: { name: string; dirty: string; forbidden: RegExp }[] = [
      { name: 'inline event handler on img', dirty: '<img src=x onerror="alert(1)">', forbidden: /onerror/i },
      { name: 'inline event handler on p', dirty: '<p onclick="evil()">x</p>', forbidden: /onclick/i },
      { name: 'svg with onload', dirty: '<svg onload="alert(1)"><circle /></svg>', forbidden: /<svg|onload/i },
      { name: 'iframe', dirty: '<iframe src="https://evil.example"></iframe>', forbidden: /<iframe/i },
      { name: 'script tag', dirty: '<script>alert(1)</script>', forbidden: /<script|alert\(1\)/i },
      { name: 'data: URL in an anchor', dirty: '<a href="data:text/html,<script>alert(1)</script>">x</a>', forbidden: /data:/i },
      { name: 'data: URL in an image', dirty: '<img src="data:image/svg+xml;base64,PHN2Zz4=">', forbidden: /data:/i },
      { name: 'javascript: URL with odd casing and whitespace', dirty: '<a href="  JaVaScRiPt:alert(1)">x</a>', forbidden: /javascript:/i },
      { name: 'protocol-relative URL', dirty: '<a href="//evil.example/x">x</a>', forbidden: /href="\/\//i },
      { name: 'style tag', dirty: '<style>body{display:none}</style>', forbidden: /<style|display:none/i },
      { name: 'inline style attribute', dirty: '<p style="position:fixed;top:0">x</p>', forbidden: /style=/i },
      { name: 'form and input', dirty: '<form action="https://evil.example"><input name="p"></form>', forbidden: /<form|<input/i },
      { name: 'object / embed', dirty: '<object data="x"></object><embed src="y">', forbidden: /<object|<embed/i },
      { name: 'meta refresh', dirty: '<meta http-equiv="refresh" content="0;url=https://evil.example">', forbidden: /<meta/i },
      { name: 'base tag', dirty: '<base href="https://evil.example/">', forbidden: /<base/i },
      { name: 'nested script obfuscation', dirty: '<scr<script>ipt>alert(1)</script>', forbidden: /<script/i },
      { name: 'unclosed script inside a comment', dirty: '<!--<script>alert(1)</script>-->', forbidden: /<script/i },
      { name: 'html comment with tag break-out', dirty: '<p><!--</p><script>alert(1)</script>', forbidden: /<script/i },
      { name: 'event handler without quotes', dirty: '<img src=x onerror=alert(1)>', forbidden: /onerror/i },
      { name: 'math/annotation-xml', dirty: '<math><annotation-xml encoding="text/html"><script>alert(1)</script></annotation-xml></math>', forbidden: /<math|<script/i }
    ];

    for (const { name, dirty, forbidden } of corpus) {
      it(`strips: ${name}`, () => {
        const out = sanitizeArticleHtml(dirty);
        expect(out).not.toMatch(forbidden);
      });
    }

    it('never emits a raw "<" for dangerous payloads that contain no allowed text', () => {
      const out = sanitizeArticleHtml('<script>alert(1)</script><iframe src="x"></iframe><object></object>');
      expect(out.trim()).toBe('');
    });

    it('rewrites target="_blank" links so they cannot reach window.opener', () => {
      const out = sanitizeArticleHtml('<a href="https://x.example" target="_blank">x</a>');
      expect(out).toContain('rel="noopener noreferrer"');
    });
  });

  describe('strips the non-existent sanitize-html option that was silently ignored (F24)', () => {
    it('drops nested disallowed tags through the allow-list alone', () => {
      const out = sanitizeArticleHtml('<div><style>p{color:red}</style><p>kept</p></div>');
      expect(out).not.toMatch(/<style|color:red/i);
      expect(out).toContain('<p>kept</p>');
      expect(out).not.toMatch(/<div/i);
    });
  });

  /**
   * Article media (spec FR-2). The allow-list is the only thing standing between
   * a stored `<iframe>` and every reader of the published page, so both
   * directions are pinned: an allow-listed provider survives, everything else is
   * removed completely (not just stripped of its `src`).
   */
  describe('iframes are restricted to the provider allow-list', () => {
    const allowed: { name: string; dirty: string }[] = [
      { name: 'YouTube privacy embed', dirty: '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="Video"></iframe>' },
      { name: 'YouTube embed', dirty: '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>' },
      { name: 'Vimeo player embed', dirty: '<iframe src="https://player.vimeo.com/video/123456789"></iframe>' }
    ];

    for (const { name, dirty } of allowed) {
      it(`keeps an allow-listed ${name}`, () => {
        const out = sanitizeArticleHtml(dirty);
        expect(out).toContain('<iframe ');
        expect(out).toContain('loading="lazy"');
        expect(out).toContain('referrerpolicy="strict-origin-when-cross-origin"');
      });
    }

    it('keeps the embed src of an allow-listed provider', () => {
      const out = sanitizeArticleHtml('<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>');
      expect(out).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    });

    const rejected: { name: string; dirty: string }[] = [
      { name: 'an arbitrary host', dirty: '<iframe src="https://evil.example/embed/dQw4w9WgXcQ"></iframe>' },
      { name: 'a look-alike host', dirty: '<iframe src="https://www.youtube.com.evil.example/embed/dQw4w9WgXcQ"></iframe>' },
      { name: 'a suffix look-alike host', dirty: '<iframe src="https://evil-youtube-nocookie.com/embed/x"></iframe>' },
      { name: 'a data: URL', dirty: '<iframe src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></iframe>' },
      { name: 'a javascript: URL', dirty: '<iframe src="javascript:alert(1)"></iframe>' },
      { name: 'an http (non-https) embed', dirty: '<iframe src="http://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>' },
      { name: 'a protocol-relative embed', dirty: '<iframe src="//www.youtube.com/embed/dQw4w9WgXcQ"></iframe>' },
      { name: 'a relative embed', dirty: '<iframe src="/embed/dQw4w9WgXcQ"></iframe>' },
      { name: 'an unparseable src', dirty: '<iframe src="relative:exploit"></iframe>' }
    ];

    for (const { name, dirty } of rejected) {
      it(`removes an iframe pointing at ${name}`, () => {
        const out = sanitizeArticleHtml(dirty);
        expect(out).not.toMatch(/<iframe/i);
        // The whole element is gone - no empty frame is left behind.
        expect(out.trim()).toBe('');
      });
    }

    it('removes the iframe but keeps the surrounding text', () => {
      expect(sanitizeArticleHtml('before<iframe src="https://evil.example/x"></iframe>after')).toBe('beforeafter');
    });

    it('strips event handlers from an allow-listed embed without dropping it', () => {
      const out = sanitizeArticleHtml('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" onload="alert(1)"></iframe>');
      expect(out).toContain('<iframe ');
      expect(out).not.toMatch(/onload/i);
    });

    it('never lets a data: URL through on any media attribute', () => {
      const out = sanitizeArticleHtml(
        '<img src="data:image/svg+xml;base64,PHN2Zz4=" alt="x">' +
          '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>'
      );
      expect(out).not.toMatch(/data:/i);
      expect(out).not.toMatch(/<iframe/i);
    });
  });

  describe('image and figure markup produced by the editor', () => {
    it('keeps figure/figcaption/img and forces lazy, async loading', () => {
      const out = sanitizeArticleHtml(
        '<figure><img src="https://cdn.example/a.png" alt="A" width="1200" height="630"><figcaption>Caption</figcaption></figure>'
      );
      expect(out).toContain('<figure>');
      expect(out).toContain('<figcaption>Caption</figcaption>');
      expect(out).toContain('src="https://cdn.example/a.png"');
      expect(out).toContain('alt="A"');
      expect(out).toContain('width="1200"');
      expect(out).toContain('loading="lazy"');
      expect(out).toContain('decoding="async"');
    });

    it('keeps only allow-listed class tokens on a figure', () => {
      const out = sanitizeArticleHtml('<figure class="af-video af-evil" data-x="1"><figcaption>c</figcaption></figure>');
      expect(out).toContain('class="af-video"');
      expect(out).not.toContain('af-evil');
      expect(out).not.toContain('data-x');
    });
  });
});
