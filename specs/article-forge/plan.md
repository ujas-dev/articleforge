# Plan: ArticleForge

> HOW only. Approved by user: solo creator, Astro frontend, Supabase + Edge Functions.

## Architecture

```
Creator Browser -> GitHub Pages (Astro SSR/static) -> Supabase Edge Functions (auth, SEO gen, analytics)
                                  -> Supabase Postgres (data) + Storage (images)
```

## Data Model (Supabase)

- profiles(id, github_id, email, display_name, avatar_url, settings_json)
- articles(id, author_id, title, slug, keyword, content_html, status, published_at, template, seo_json, view_count)
- seo_strategies(id, article_id, title_tag, meta_description, h1, h2_outline, faq_schema, internal_links)
- templates(id, author_id, name, structure_json, is_default)
- analytics_events(id, article_id, event, referrer, created_at)

All tables: RLS enabled, scoped to auth.uid() = author_id (or user id for profiles).

## Stack

- Frontend: Astro (SSG + SSR hybrid), Tailwind CSS, Framer Motion for animations
- Backend: Supabase (Postgres, Auth, Storage, Edge Functions)
- SEO gen: Edge Function calling OpenAI (or local heuristic fallback)
- Auth: Supabase Auth (GitHub + Google OAuth)
- Testing: Vitest + Playwright + axe-core
- Lint/Typecheck: ESLint + TypeScript strict

## File Layout

```
articleforge/
  specs/article-forge/
    constitution.md
    spec.md
    plan.md            <- this file
    tasks.md
  src/
    astro.config.mjs
    package.json
    tailwind.config.ts
    src/
      pages/           <- Astro pages (SSG/SSR)
      components/      <- React/Preact components
      layouts/         <- shared layouts
      content/         <- MDX articles if needed
      lib/             <- supabase client, seo helpers
      styles/          <- design tokens, animations
    supabase/
      migrations/      <- SQL migrations
      functions/       <- Edge Functions (seo-gen, track)
    public/
      robots.txt, sitemap.xml, og-image template
```

## Risks

- Supabase free tier limits: 2M API calls/month. Mitigate with caching + local SEO heuristic fallback.
- Astro + animations: keep motion on `prefers-reduced-motion` off; use CSS transforms for GPU.
- GitHub Pages + SSR: SSR pages use Edge Functions; static pages prebuilt.
