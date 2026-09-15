/**
 * Supabase/Postgres errors are written for DBAs, not creators. Anything shown
 * in a live region goes through here (finding F16).
 */
export interface SupabaseLikeError {
  code?: string | null;
  message: string;
  details?: string | null;
}

export function isUniqueViolation(error: SupabaseLikeError | null): boolean {
  return error?.code === '23505';
}

/** Turns a Postgres/PostgREST error into a message safe to show a human. */
export function toFriendlyError(error: SupabaseLikeError, action: string): Error {
  if (isUniqueViolation(error)) {
    return new Error('That slug is already used by another published article. Try a different title.');
  }
  if (error.code === '23503') {
    return new Error(`${action} failed: the referenced record no longer exists.`);
  }
  if (error.code === '42501' || error.code === 'PGRST301') {
    return new Error(`${action} failed: you do not have access to that article.`);
  }
  return new Error(`${action} failed: ${error.message}`);
}

/** Best-effort message for an unknown thrown value (network errors, thrown Errors, ...). */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong. Please try again.';
}
