/**
 * Minimal Deno surface used by the ArticleForge Edge Functions, so they can be
 * type-checked with the repo's TypeScript (`npm run check:functions`) without
 * pulling in the full Deno type package (finding F20).
 *
 * Only add declarations here when a function actually uses them.
 */
declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
    function set(key: string, value: string): void;
  }
  function serve(
    handler: (request: Request) => Response | Promise<Response>
  ): { finished: Promise<void>; shutdown: () => Promise<void> };
}
