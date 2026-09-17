# ArticleForge

Solo-creator SEO article writing and publishing platform.
Astro static frontend on GitHub Pages, Supabase free-tier backend.

## Features

- GitHub / Google sign-in (Supabase Auth), one profile per user
- Rich text article editor with H2/H3, bold, italic, lists, links, code
- Per-keyword SEO strategy generation (OpenAI-backed Edge Function with deterministic local fallback)
- Title tag, meta description, H1, H2 outline, FAQ schema, internal-link suggestions
- Draft / publish / archive state machine with unique slug enforcement
- Built-in templates: how-to, listicle, comparison, review, FAQ
- Published pages render full SEO metadata: title, meta description, canonical, Open Graph, Twitter card, JSON-LD (Article, FAQ, Breadcrumb)
- Privacy-first analytics: page views, scroll depth, referrer hostname. DNT/GPC honored, no PII
- Animation-forward dark/light theme with `prefers-reduced-motion` support

## Quickstart

1. `npm ci`
2. Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key
3. `npm run dev`

Node 20.3+ (see `.nvmrc`).

## Supabase setup

1. Create a free project at supabase.com
2. Run the SQL in `supabase/migrations/0001_init.sql` in the SQL editor (tables, RLS
   policies, triggers, seed templates). The file is idempotent and runs in a single
   transaction, so it is safe to re-run.
3. Enable the GitHub and Google auth providers under Authentication -> Providers
4. Deploy the Edge Functions. `supabase/config.toml` is part of the repo and is read
   by the CLI on deploy, so use the CLI from the project root:
   - `supabase functions deploy seo-gen`
   - `supabase functions deploy track`
5. Set the Edge Function secret `OPENAI_API_KEY` in the dashboard (optional - without it the deterministic heuristic generator is used)

### Why `track` disables the JWT check

`supabase/config.toml` sets `[functions.track] verify_jwt = false`. The public
article page reports analytics with `navigator.sendBeacon()`, which cannot attach an
`Authorization` header; with the default gateway setting every beacon would be
rejected with 401 before reaching the function. The function is deny-by-default
instead: it accepts only `POST`, only allow-listed event types, only UUID article
ids, reduces the referrer to a bare hostname, and only records events for articles
that are already published. `seo-gen` keeps `verify_jwt = true`.

## Environment variables

| Variable | Scope | Notes |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | build | **Origin only**, e.g. `https://USERNAME.github.io`. The `/articleforge` sub-path comes from `base` in `astro.config.mjs`. |
| `PUBLIC_SUPABASE_URL` | build + browser | Supabase project URL. |
| `PUBLIC_SUPABASE_ANON_KEY` | build + browser | Supabase anon key (public by design, RLS enforces access). |
| `PUBLIC_ENV_STRICT` | build | `1` makes a missing public var a fatal build error (the deploy workflow sets this). |
| `OPENAI_API_KEY` | Supabase secret | Never in this repo or in `.env`. |

All URL generation goes through `src/lib/site.ts`; nothing else should concatenate
`PUBLIC_SITE_URL` by hand.

## Publishing flow

GitHub Pages serves a static build, so publishing an article marks it `published` in
Supabase and the next site build (GitHub Actions `workflow_dispatch` on the deploy
workflow) renders its public page and sitemap entry.

## Generated assets

- `public/og-image.png` - regenerated with `npm run og:image` after brand colour changes.
- `robots.txt` and `sitemap.xml` are generated at build time from `src/pages/robots.txt.ts`
  and `src/pages/sitemap.xml.ts`, so the GitHub Pages sub-path and sitemap URL always
  match the configured `base` / `PUBLIC_SITE_URL`.

## Scripts

- `npm run dev` - local dev server
- `npm run build` - static build to `dist/`
- `npm run check` - astro type check
- `npm run check:functions` - type check the Supabase Edge Functions
- `npm run test` - vitest unit tests
- `npm run lint` - eslint
- `npm run audit` - npm audit (prod deps)

## Security notes

- All tables use row-level security scoped to `auth.uid()`; published articles are the only rows readable anonymously
- Analytics ingestion is deny-by-default: allow-listed event types, UUID-validated article ids, referrer reduced to bare hostname, article must be published
- Article HTML is sanitized both on save (editor) and at render time (build)
- JSON-LD is serialized with `<` escaped to `\u003c` so stored content cannot break out of the inline `<script>` element
- No secrets in code; `.env*` is git-ignored and examples use placeholders


## Admin sign-in

The owner signs in either with **GitHub / Google OAuth** (the account is created
on first sign-in - no separate registration), or with the **email + password** form
on /app/login/. The deploy workflow ensures a default admin user exists, using
these repository secrets:

- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service-role key (Project Settings -> API)
- `ADMIN_EMAIL` - the admin account email
- `ADMIN_PASSWORD` - a strong password for that account
- `PUBLIC_SUPABASE_URL` - the project URL

If they are absent the step is skipped and the deploy still succeeds. Rotate
`ADMIN_PASSWORD` if it has ever been exposed.
