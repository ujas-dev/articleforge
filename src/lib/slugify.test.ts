import { describe, it, expect } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('produces clean lowercase slugs', () => {
    expect(slugify('Best Running Shoes 2026!')).toBe('best-running-shoes-2026');
  });
  it('strips punctuation and collapses dashes', () => {
    expect(slugify('  How -- to & Fix __ Wheels ')).toBe('how-to-fix-wheels');
  });
  it('falls back to article when empty', () => {
    expect(slugify('!!!')).toBe('article');
  });
  it('caps length at 80', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});
