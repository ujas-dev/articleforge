import type { FaqEntry } from './seo';

/**
 * Serialises a JSON-LD object for injection into an inline `<script>`.
 *
 * `<` is escaped to `\u003c` so a value containing `</script>` (or `<!--`)
 * cannot terminate the script element early - a stored-XSS vector, since the
 * layout injects these with `set:html` (finding F6). `\u003c` is valid JSON,
 * so consumers parse the payload exactly as before.
 */
function ld(obj: Record<string, unknown>): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

export function articleJsonLd(input: {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  authorName: string;
}): string {
  return ld({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    datePublished: input.publishedAt,
    author: { '@type': 'Person', name: input.authorName },
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.url }
  });
}

export function faqJsonLd(faq: FaqEntry[]): string {
  return ld({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((e) => ({
      '@type': 'Question',
      name: e.q,
      acceptedAnswer: { '@type': 'Answer', text: e.a }
    }))
  });
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]): string {
  return ld({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url
    }))
  });
}
