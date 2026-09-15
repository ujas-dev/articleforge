/**
 * The SEO strategy generator lives in ONE place: supabase/functions/_shared/
 * heuristic.ts, which is also bundled into the seo-gen Edge Function. This
 * module is a thin re-export so the browser, the build and Deno all run
 * identical code (finding F20 - previously a hand-copied duplicate).
 */
export { heuristicStrategy } from '../../supabase/functions/_shared/heuristic';
export type { FaqEntry, SeoStrategy } from '../../supabase/functions/_shared/heuristic';
