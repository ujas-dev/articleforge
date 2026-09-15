# Tasks: ArticleForge

Numbered, independently-verifiable tasks. Each maps to a test proving it done.

## Phase 0 — Bootstrap

- [ ] T0.1 scaffold Astro project + Tailwind + Supabase client config
- [ ] T0.2 create Supabase schema migrations (profiles, articles, seo_strategies, templates, analytics_events) with RLS
- [ ] T0.3 create Edge Function `seo-gen` (keyword -> title, meta, H1/H2, FAQ schema) with OpenAI + local fallback
- [ ] T0.4 create Edge Function `track` (analytics event ingestion)
- [ ] T0.5 configure GitHub Pages deploy + `astro.config.mjs` output hybrid

## Phase 1 — Auth & Profiles

- [ ] T1.1 Supabase Auth: GitHub + Google OAuth providers enabled
- [ ] T1.2 profile auto-create on first login (trigger or upsert)
- [ ] T1.3 login/logout/auth-guard components
- [ ] T1.4 settings page (site name, SEO defaults, social handles)
- [ ] T1.5 TEST: unauthenticated user redirected from /app; authenticated user sees dashboard

## Phase 2 — Article CRUD

- [ ] T2.1 create article (title, keyword, template) -> draft
- [ ] T2.2 rich text editor component (headings, bold, italic, links, code, lists, images) -> clean HTML
- [ ] T2.3 update article content + metadata
- [ ] T2.4 soft delete article
- [ ] T2.5 draft <-> publish state machine (published_at set on publish)
- [ ] T2.6 slug generation + uniqueness check
- [ ] T2.7 TEST: create -> save draft -> publish -> fetch -> soft delete

## Phase 3 — SEO Strategy

- [ ] T3.1 SEO strategy generator: keyword -> title tag, meta description, H1, H2/H3 outline, FAQ schema, internal link suggestions
- [ ] T3.2 save strategy linked to article (seo_strategies table)
- [ ] T3.3 apply strategy to article (populate article.seo_json)
- [ ] T3.4 preview SEO metadata in editor
- [ ] T3.5 TEST: keyword "best running shoes" produces non-empty title, meta desc, H1, >=3 H2s

## Phase 4 — Templates

- [ ] T4.1 seed default templates (how-to, listicle, comparison, review, FAQ)
- [ ] T4.2 template picker in article create flow
- [ ] T4.3 apply template structure to new article
- [ ] T4.4 user can create custom templates
- [ ] T4.5 TEST: selecting "listicle" template pre-fills H2 structure

## Phase 5 — Publishing & Rendering

- [ ] T5.1 published article page: dynamic route reads article by slug
- [ ] T5.2 render full SEO metadata: title tag, meta description, canonical, OG, Twitter card
- [ ] T5.3 inject JSON-LD Article schema + FAQ schema + breadcrumb schema
- [ ] T5.4 render content HTML safely (sanitized)
- [ ] T5.5 responsive article typography + unique animation-forward theme
- [ ] T5.6 dark/light theme toggle with persisted preference
- [ ] T5.7 TEST: published page has valid JSON-LD, passes axe AA, LCP < 2.5s

## Phase 6 — Analytics

- [ ] T6.1 track view event on published page load (Edge Function)
- [ ] T6.2 track scroll depth (25/50/75/100)
- [ ] T6.3 dashboard: views per article, top referrers
- [ ] T6.4 respect DNT / privacy: no PII stored
- [ ] T6.5 TEST: view event recorded, scroll events recorded, no PII in payload

## Phase 7 — Design & Animations

- [ ] T7.1 design tokens: typography scale, color palette, spacing, motion curves
- [ ] T7.2 custom animated hero on homepage (unique, not generic)
- [ ] T7.3 micro-interactions: button hover, card lift, page transition
- [ ] T7.4 article page reveal animation (staggered headings)
- [ ] T7.5 respect prefers-reduced-motion globally
- [ ] T7.6 TEST: animations disabled under prefers-reduced-motion; LCP < 2.5s

## Phase 8 — Polish & Gates

- [ ] T8.1 sitemap.xml auto-generated
- [ ] T8.2 robots.txt
- [ ] T8.3 ESLint + TypeScript strict pass
- [ ] T8.4 Vitest unit tests (lib functions, seo helper, slugify)
- [ ] T8.5 Playwright E2E: create -> publish -> visit public URL
- [ ] T8.6 axe WCAG 2.2 AA audit on all pages
- [ ] T8.7 npm audit (no known CVEs in new deps)
- [ ] T8.8 Lighthouse CI: performance, accessibility, SEO, best practices
- [ ] T8.9 security review: RLS verified, no secrets, input validation
- [ ] T8.10 deploy to GitHub Pages, verify live
