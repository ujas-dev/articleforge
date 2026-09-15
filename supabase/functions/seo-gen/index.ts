import { heuristicStrategy } from '../_shared/heuristic.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface OpenAiResponse {
  choices?: { message?: { content?: string } }[];
}

async function generateWithOpenAI(keyword: string, apiKey: string): Promise<unknown | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You generate SEO strategies. Respond with JSON keys: title (<=60 chars), metaDescription (<=160 chars), h1, outline (array of >=3 H2 headings), faq (array of {q,a} with >=3), internalLinks (array of 3 anchor suggestions). All strings must reference the keyword.' },
          { role: 'user', content: `Keyword: ${keyword}` }
        ]
      })
    });
    if (!res.ok) return null;
    const json = (await res.json()) as OpenAiResponse;
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function isValidStrategy(s: unknown): boolean {
  if (typeof s !== 'object' || s === null) return false;
  const v = s as Record<string, unknown>;
  return (
    typeof v.title === 'string' && v.title.length > 0 && v.title.length <= 60 &&
    typeof v.metaDescription === 'string' && v.metaDescription.length > 0 && v.metaDescription.length <= 160 &&
    typeof v.h1 === 'string' && v.h1.length > 0 &&
    Array.isArray(v.outline) && v.outline.length >= 3 &&
    Array.isArray(v.faq) && v.faq.length >= 3 &&
    Array.isArray(v.internalLinks)
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!token || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: serviceKey } });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  // The gateway already verified the JWT; this confirms the token maps to a real user.
  const user = (await userRes.json()) as { id?: string };
  if (!user.id) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  let body: { keyword?: unknown; article_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
  const keyword = typeof body.keyword === 'string' ? body.keyword.trim().slice(0, 100) : '';
  if (keyword.length < 2) {
    return new Response(JSON.stringify({ error: 'keyword must be 2-100 chars' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  let strategy: unknown = openaiKey ? await generateWithOpenAI(keyword, openaiKey) : null;
  if (!isValidStrategy(strategy)) strategy = heuristicStrategy(keyword);
  if (!isValidStrategy(strategy)) {
    return new Response(JSON.stringify({ error: 'generation failed' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ strategy }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
});
