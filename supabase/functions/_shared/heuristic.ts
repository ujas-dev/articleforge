/**
 * Deterministic heuristic SEO strategy generator.
 *
 * This is the SINGLE implementation (finding F20). It is imported both by the
 * seo-gen Edge Function (Deno, `../_shared/heuristic.ts`) and, via
 * src/lib/seo.ts, by the browser and by the build. Keeping one file means the
 * local fallback can never drift from what the Edge Function returns.
 */
export interface FaqEntry { q: string; a: string; }
export interface SeoStrategy {
  title: string;
  metaDescription: string;
  h1: string;
  outline: string[];
  faq: FaqEntry[];
  internalLinks: string[];
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1));
}

function clip(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '\u2026';
}

export function heuristicStrategy(keyword: string): SeoStrategy {
  const k = keyword.trim().replace(/\s+/g, ' ');
  const K = titleCase(k);
  const title = k.split(' ').length <= 5 ? clip(`${K} \u2013 The Complete Guide (2026)`, 60) : clip(K, 60);
  const metaDescription = clip(
    `Looking for ${k}? This guide covers what matters: honest comparisons, practical tips, and clear answers. Updated for 2026.`,
    160
  );
  const outline = [
    `What Is ${K}?`,
    `Why ${K} Matters`,
    `How to Choose the Right ${K}`,
    `Common ${K} Mistakes to Avoid`,
    'FAQ'
  ];
  const faq: FaqEntry[] = [
    { q: `What is the best ${k}?`, a: `The best ${k} depends on your needs, budget, and use case; this guide breaks down the top options.` },
    { q: `How do I get started with ${k}?`, a: `Start by defining your goals, then follow the step-by-step walkthrough in this guide.` },
    { q: `Is ${k} worth it in 2026?`, a: `For most people, yes \u2014 this guide explains when it pays off and when to skip it.` }
  ];
  const internalLinks = [
    `${K}: alternatives compared`,
    `${K} for beginners`,
    `${K} deep dive`
  ];
  return { title, metaDescription, h1: K, outline, faq, internalLinks };
}
