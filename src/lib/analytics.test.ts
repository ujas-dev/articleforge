import { describe, it, expect } from 'vitest';
import { buildTrackPayload, shouldTrack } from './analytics';

describe('buildTrackPayload (T6.4/T6.5)', () => {
  it('accepts valid payload and reduces referrer to hostname', () => {
    const p = buildTrackPayload('123e4567-e89b-12d3-a456-426614174000', 'view', 'https://news.example.com/article?utm=x');
    expect(p).toEqual({ article_id: '123e4567-e89b-12d3-a456-426614174000', event_type: 'view', referrer_host: 'news.example.com' });
  });
  it('rejects non-uuid article ids', () => {
    expect(buildTrackPayload('not-a-uuid', 'view', '')).toBeNull();
  });
  it('rejects unknown event types', () => {
    expect(buildTrackPayload('123e4567-e89b-12d3-a456-426614174000', 'admin_dump', '')).toBeNull();
  });
  it('contains no PII fields', () => {
    const p = buildTrackPayload('123e4567-e89b-12d3-a456-426614174000', 'scroll_50', '');
    expect(Object.keys(p ?? {})).toEqual(['article_id', 'event_type', 'referrer_host']);
  });
});

describe('shouldTrack (DNT/GPC)', () => {
  it('allows when no signals', () => {
    expect(shouldTrack(null, null)).toBe(true);
    expect(shouldTrack('0', null)).toBe(true);
  });
  it('blocks DNT=1 and GPC=1', () => {
    expect(shouldTrack('1', null)).toBe(false);
    expect(shouldTrack('yes', null)).toBe(false);
    expect(shouldTrack(null, '1')).toBe(false);
    expect(shouldTrack(null, 'true')).toBe(false);
  });
});
