# Constitution

Immutable principles for ArticleForge — a solo-creator SEO article writing platform
on GitHub Pages + Supabase free tier.

## 1. Smallest viable diff
Every change must be the smallest change that satisfies the approved task.
No speculative abstractions, no drive-by refactors, no new dependencies
without explicit approval.

## 2. Data lives in Supabase free tier
PostgreSQL via Supabase. No separate database server. All data: articles,
SEO metadata, user settings, templates, analytics. Auth via Supabase Auth
(GitHub/Gmail OAuth).

## 3. Hosted on GitHub Pages
Static + SSR-hybrid frontend on Astro. No Vercel/Netlify hosting cost.
Edge Functions for server-side SEO generation.

## 4. Tests are the contract
TDD: failing test first, then minimal code. Before claiming done: run tests +
lint + typecheck and paste real output.

## 5. No secrets in code
API keys (OpenAI, Supabase, SerpAPI) live in environment variables only.
Never commit `.env*`. Use `<REDACTED>` in examples.

## 6. Security first
Parameterized queries only (Supabase client handles this). Validate all
external input at trust boundaries. AuthN/AuthZ enforced server-side via
Supabase RLS. Never trust client-supplied SEO content for rendering.

## 7. Accessibility (WCAG 2.2 AA)
Every interactive component must be keyboard-navigable, have sufficient
contrast, and be screen-reader friendly. Animations respect
`prefers-reduced-motion`.

## 8. Unique, attractive, animation-forward design
The site must stand out from generic blogs. Custom animations, bold
typography, and micro-interactions are a core requirement, not decoration.
Performance must still be excellent (LCP < 2.5s, CLS < 0.1).

## 9. Spec-driven scope lock
Anything not in the approved spec is out of scope until the spec changes.
Ambiguity means STOP and ask, never silently assume.

## 10. Minimal dependencies
Prefer Astro built-ins + Tailwind + a few vetted libs. Pin exact versions.
No new dependency without license + maintenance check + user approval.
