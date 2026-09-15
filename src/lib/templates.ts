export interface Template {
  id: string;
  name: string;
  description: string;
  outline: string[];
}

export const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: 'how-to',
    name: 'How-To Guide',
    description: 'Step-by-step walkthrough with numbered steps',
    outline: ['Prerequisites', 'Step-by-Step Guide', 'Tips and Pitfalls', 'FAQ']
  },
  {
    id: 'listicle',
    name: 'Listicle',
    description: 'Ranked or grouped list with quick picks',
    outline: ['Quick Picks', 'The Full List', 'How We Selected', 'FAQ']
  },
  {
    id: 'comparison',
    name: 'Comparison',
    description: 'Side-by-side comparison of options',
    outline: ['Comparison Overview', 'Option A vs Option B', 'Which Should You Choose', 'FAQ']
  },
  {
    id: 'review',
    name: 'Review',
    description: 'In-depth review with verdict',
    outline: ['First Impressions', 'Features and Performance', 'Pros and Cons', 'Verdict', 'FAQ']
  },
  {
    id: 'faq',
    name: 'FAQ',
    description: 'Question-and-answer format',
    outline: ['Top Questions', 'Deeper Answers', 'Still Unsure']
  }
];

export function findBuiltInTemplate(id: string): Template | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}

export function applyTemplate(id: string, keyword: string): string {
  const tpl = findBuiltInTemplate(id);
  if (!tpl) return '';
  return tpl.outline
    .map((h) => `<h2>${h.replace(/\{keyword\}/g, keyword)}</h2><p>Write about ${h} for ${keyword}.</p>`)
    .join('\n');
}
