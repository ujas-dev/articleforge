export type TrackEventType = 'view' | 'scroll_25' | 'scroll_50' | 'scroll_75' | 'scroll_100';

export const TRACK_EVENTS: TrackEventType[] = ['view', 'scroll_25', 'scroll_50', 'scroll_75', 'scroll_100'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TrackPayload {
  article_id: string;
  event_type: TrackEventType;
  referrer_host: string;
}

/**
 * Builds a privacy-safe analytics payload: allow-listed event type,
 * UUID-validated article id, referrer reduced to bare hostname.
 * No PII ever enters the payload (T6.4).
 */
export function buildTrackPayload(
  articleId: unknown,
  eventType: unknown,
  referrer: string
): TrackPayload | null {
  if (typeof articleId !== 'string' || !UUID_RE.test(articleId)) return null;
  if (typeof eventType !== 'string') return null;
  if (!TRACK_EVENTS.includes(eventType as TrackEventType)) return null;
  let referrer_host = '';
  try {
    referrer_host = referrer ? new URL(referrer).hostname.replace(/[^a-z0-9.-]/gi, '').slice(0, 100) : '';
  } catch {
    referrer_host = '';
  }
  return { article_id: articleId, event_type: eventType as TrackEventType, referrer_host };
}

export function shouldTrack(dnt: string | null | undefined, gpc: string | null | undefined): boolean {
  const dntOn = dnt === '1' || dnt === 'yes';
  const gpcOn = gpc === '1' || gpc === 'true';
  return !dntOn && !gpcOn;
}
