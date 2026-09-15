import { describe, it, expect } from 'vitest';
import { transition } from './article-state';

describe('article state machine', () => {
  it('draft -> published sets published_at', () => {
    const r = transition({ status: 'draft', published_at: null }, 'published');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe('published');
      expect(r.published_at).not.toBeNull();
    }
  });
  it('published -> draft clears published_at', () => {
    const r = transition({ status: 'published', published_at: '2026-01-01T00:00:00Z' }, 'draft');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.published_at).toBeNull();
  });
  it('published <-> archived allowed', () => {
    expect(transition({ status: 'published', published_at: '2026-01-01T00:00:00Z' }, 'archived').ok).toBe(true);
    expect(transition({ status: 'archived', published_at: null }, 'draft').ok).toBe(true);
  });
  it('rejects invalid transitions', () => {
    expect(transition({ status: 'draft', published_at: null }, 'archived').ok).toBe(false);
    expect(transition({ status: 'draft', published_at: null }, 'draft').ok).toBe(false);
  });
});
