# Spec: ArticleForge

> WHAT and WHY only. No tech choices here — those live in plan.md.
> Approved by: user (solo creator, Astro frontend, Supabase + Edge Functions)

## Problem Statement

A solo content creator wants to write SEO-optimized articles faster and better,
with every page getting a full SEO strategy (title, meta, headings, schema,
internal links), a unique and attractive design with stand-out animations,
and zero hosting cost — everything on GitHub Pages + Supabase free tier.

## User Stories

- **US-1**: As a creator, I can create a new article from a keyword/topic so
  that I have a structured canvas ready for SEO content.
- **US-2**: As a creator, I can type article content in a rich editor with
  real-time word count, reading time, and heading hierarchy checks.
- **US-3**: As a creator, I can generate an SEO strategy (title, meta
  description, H1/H2/H3 outline, schema markup, internal link suggestions)
  from the keyword so each page is fully optimized.
- **US-4**: As a creator, I can save drafts and publish articles.
- **US-5**: As a creator, I can preview the published article exactly as it
  will render on GitHub Pages, including SEO metadata.
- **US-6**: As a creator, I can reuse article templates (e.g. "how-to",
  "listicle", "comparison") to start faster.
- **US-7**: As a creator, I can view basic analytics (views, scroll depth)
  for published articles.
- **US-8**: As a creator, I can style the site with a unique, attractive,
  animation-forward theme that stands out from generic blogs.

## Functional Requirements

- **FR-1**: Article CRUD — create, read, update, delete (soft delete).
- **FR-2**: Rich text editor supporting headings, bold, italic, links, code,
  images, lists. Output clean HTML.
- **FR-3**: SEO strategy generator — produces title, meta description, H1/H2/H3
  outline, FAQ schema, Article schema, and internal-link suggestions from a
  keyword + optional context.
- **FR-4**: Template library — predefined article structures (how-to,
  listicle, comparison, review, FAQ).
- **FR-5**: Draft / publish state machine with scheduled publishing optional.
- **FR-6**: Published article pages rendered with full SEO metadata:
  title tag, meta description, canonical, Open Graph, Twitter card, JSON-LD
  Article + FAQ schema, breadcrumb schema.
- **FR-7**: Analytics — page view counter, scroll depth tracking, referrer.
- **FR-8**: Responsive, unique, animation-forward theme with dark/light toggle.
- **FR-9**: Auth — solo creator signs in once (GitHub/Gmail via Supabase).
  All data scoped to the authenticated user.
- **FR-10**: Settings — site name, SEO defaults, social handles, custom domain
  note.

## Non-Functional Requirements

- **NFR-1**: Hosting cost: $0. GitHub Pages static + Supabase free tier
  (500MB DB, 2M API calls, 50K auth users).
- **NFR-2**: Performance: LCP < 2.5s, CLS < 0.1, TBT < 200ms on 4G.
- **NFR-3**: Accessibility: WCAG 2.2 AA.
- **NFR-4**: SEO: valid structured data, semantic HTML, fast Core Web Vitals.
- **NFR-5**: Security: RLS on all tables, parameterized queries, no secrets in
  code, input validation at every trust boundary.
- **NFR-6**: Animations must respect `prefers-reduced-motion`.

## Out of Scope (until spec changes)

- Multi-author / teams.
- E-commerce / paywalls / payments.
- Image CDN hosting (images stored in Supabase Storage, not a CDN).
- Full keyword research tool (e.g. Ahrefs competitor) — keyword input only.
- Comment system.
- Newsletter / email sending.
- Mobile native app.

## Acceptance Criteria

- AC-1: Creator can create, edit, and publish an article end-to-end.
- AC-2: Published page renders with valid JSON-LD Article schema and all
  meta tags.
- AC-3: SEO strategy generator produces a non-empty title, meta description,
  and H1/H2 outline from a keyword.
- AC-4: Site loads on GitHub Pages with LCP < 2.5s (Lighthouse).
- AC-5: All pages pass axe WCAG 2.2 AA.
- AC-6: All Supabase tables have RLS enabled and tests cover CRUD per user.
- AC-7: Animations disabled when `prefers-reduced-motion` is set.
