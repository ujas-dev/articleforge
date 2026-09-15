import { describe, it, expect } from 'vitest';
import { applyTemplate, BUILT_IN_TEMPLATES } from './templates';

describe('templates (T4.5)', () => {
  it('listicle pre-fills H2 structure', () => {
    const html = applyTemplate('listicle', 'running shoes');
    expect(html).toContain('<h2>Quick Picks</h2>');
    expect(html).toContain('<h2>The Full List</h2>');
    expect(html).toMatch(/<h2>.+<\/h2>\s*<p>Write about/);
  });
  it('has all five built-in templates', () => {
    expect(BUILT_IN_TEMPLATES.map((t) => t.id)).toEqual(['how-to', 'listicle', 'comparison', 'review', 'faq']);
  });
  it('unknown template returns empty', () => {
    expect(applyTemplate('nope', 'x')).toBe('');
  });
});
