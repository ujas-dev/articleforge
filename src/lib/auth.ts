import { getSupabase } from './supabase';
import { sitePath } from './site';

export function redirectToLogin() {
  // sitePath() applies the Astro `base` exactly once. import.meta.env.BASE_URL
  // has no trailing slash here, so the old `${base}app/login/` produced
  // "/articleforgeapp/login/" and 404'd (found via a live browser check).
  window.location.assign(sitePath('/app/login/'));
}

export async function requireSession(): Promise<{ userId: string } | null> {
  const sb = getSupabase();
  // getUser() verifies the token against Supabase Auth; getSession() trusts
  // whatever is in local storage (finding F15).
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) {
    redirectToLogin();
    return null;
  }
  return { userId: data.user.id };
}

export async function signInGitHub() {
  await getSupabase().auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: `${window.location.origin}${sitePath('/app/')}` }
  });
}

export async function signInGoogle() {
  await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${sitePath('/app/')}` }
  });
}

export async function signOut() {
  await getSupabase().auth.signOut();
  redirectToLogin();
}