const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const ALLOWED_EVENTS = new Set(['view', 'scroll_25', 'scroll_50', 'scroll_75', 'scroll_100']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(null, { status: 405, headers: CORS });
  }

  let body: { article_id?: unknown; event_type?: unknown; referrer_host?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400, headers: CORS });
  }

  const articleId = typeof body.article_id === 'string' ? body.article_id : '';
  const eventType = typeof body.event_type === 'string' ? body.event_type : '';
  const referrerHost = typeof body.referrer_host === 'string' ? body.referrer_host.replace(/[^a-z0-9.-]/gi, '').slice(0, 100) : '';
  if (!UUID_RE.test(articleId) || !ALLOWED_EVENTS.has(eventType)) {
    return new Response(null, { status: 400, headers: CORS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) return new Response(null, { status: 500, headers: CORS });

  // Verify article is published before recording (deny-by-default).
  const checkRes = await fetch(`${supabaseUrl}/rest/v1/articles?id=eq.${articleId}&status=eq.published&deleted_at=is.null&select=id`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  });
  if (!checkRes.ok) return new Response(null, { status: 500, headers: CORS });
  const rows = (await checkRes.json()) as unknown[];
  if (rows.length === 0) return new Response(null, { status: 404, headers: CORS });

  const insertRes = await fetch(`${supabaseUrl}/rest/v1/analytics_events`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ article_id: articleId, event_type: eventType, referrer_host: referrerHost })
  });
  if (!insertRes.ok) return new Response(null, { status: 500, headers: CORS });

  return new Response(null, { status: 204, headers: CORS });
});
