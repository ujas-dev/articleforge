import { describe, it, expect } from 'vitest';
import { heuristicStrategy } from './seo';
import { articleJsonLd, faqJsonLd, breadcrumbJsonLd } from './seo-schema';

describe('heuristicStrategy', () => {
  it('produces a full strategy for "best running shoes" (T3.5)', () => {
    const s = heuristicStrategy('best running shoes');
    expect(s.title).toBeTruthy();
    expect(s.title.length).toBeLessThanOrEqual(60);
    expect(s.metaDescription).toBeTruthy();
    expect(s.metaDescription.length).toBeLessThanOrEqual(160);
    expect(s.h1).toBe('Best Running Shoes');
    expect(s.outline.length).toBeGreaterThanOrEqual(3);
    expect(s.faq.length).toBeGreaterThanOrEqual(3);
    expect(s.internalLinks.length).toBeGreaterThanOrEqual(3);
  });
  it('is deterministic', () => {
    expect(heuristicStrategy('wireless earbuds')).toEqual(heuristicStrategy('wireless earbuds'));
  });
  it('clips an over-long keyword to its limits', () => {
    const s = heuristicStrategy('a'.repeat(300));
    expect(s.title.length).toBeLessThanOrEqual(60);
    expect(s.metaDescription.length).toBeLessThanOrEqual(160);
  });
});

describe('JSON-LD builders (T5.3)', () => {
  it('emits valid Article schema', () => {
    const parsed = JSON.parse(articleJsonLd({ title: 'T', description: 'D', url: 'https://x.y/a', publishedAt: '2026-01-01T00:00:00Z', authorName: 'A' }));
    expect(parsed['@type']).toBe('Article');
    expect(parsed.headline).toBe('T');
  });
  it('emits valid FAQ schema', () => {
    const parsed = JSON.parse(faqJsonLd([{ q: 'Q1?', a: 'A1' }]));
    expect(parsed['@type']).toBe('FAQPage');
    expect(parsed.mainEntity[0].name).toBe('Q1?');
  });
  it('emits valid Breadcrumb schema', () => {
    const parsed = JSON.parse(breadcrumbJsonLd([{ name: 'Home', url: 'https://x.y/' }]));
    expect(parsed['@type']).toBe('BreadcrumbList');
    expect(parsed.itemListElement[0].position).toBe(1);
  });
});

/**
 * The layout injects these strings with `set:html` inside a
 * <script type="application/ld+json"> element, so any raw "<" in stored data
 * could close the script early (finding F6).
 */
describe('JSON-LD script-injection hardening (F6)', () => {
  const breakout = '</script><script>alert(1)</script>';
  const commentBreakout = '<!--<script>alert(1)</script>-->';

  const cases: { label: string; json: string; expectPayload: (parsed: Record<string, unknown>) => void }[] = [
    {
      label: 'article title',
      json: articleJsonLd({ title: breakout, description: 'd', url: 'https://x.y/', publishedAt: '2026-01-01T00:00:00Z', authorName: 'a' }),
      expectPayload: (parsed) => expect(parsed.headline).toBe(breakout)
    },
    {
      label: 'article description',
      json: articleJsonLd({ title: 't', description: commentBreakout, url: 'https://x.y/', publishedAt: '2026-01-01T00:00:00Z', authorName: 'a' }),
      expectPayload: (parsed) => expect(parsed.description).toBe(commentBreakout)
    },
    {
      label: 'FAQ question',
      json: faqJsonLd([{ q: breakout, a: 'a' }]),
      expectPayload: (parsed) => {
        const entity = (parsed.mainEntity as { name: string }[])[0];
        expect(entity.name).toBe(breakout);
      }
    },
    {
      label: 'FAQ answer',
      json: faqJsonLd([{ q: 'q', a: breakout }]),
      expectPayload: (parsed) => {
        const entity = (parsed.mainEntity as { acceptedAnswer: { text: string } }[])[0];
        expect(entity.acceptedAnswer.text).toBe(breakout);
      }
    },
    {
      label: 'breadcrumb name',
      json: breadcrumbJsonLd([{ name: breakout, url: 'https://x.y/' }]),
      expectPayload: (parsed) => {
        const item = (parsed.itemListElement as { name: string }[])[0];
        expect(item.name).toBe(breakout);
      }
    }
  ];

  for (const { label, json, expectPayload } of cases) {
    it(`escapes "<" in the ${label}`, () => {
      expect(json).not.toContain('<');
      expect(json).toContain('\\u003c');
    });

    it(`stays semantically identical after escaping in the ${label}`, () => {
      expectPayload(JSON.parse(json) as Record<string, unknown>);
    });
  }

  it('produces JSON that a script element can contain safely', () => {
    const json = faqJsonLd([{ q: breakout, a: commentBreakout }]);
    // The only way to end a <script> element is a literal "</script".
    expect(json.toLowerCase()).not.toContain('</script');
    expect(json.toLowerCase()).not.toContain('<!--');
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
