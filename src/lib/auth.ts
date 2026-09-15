import { getSupabase } from './supabase';

export function redirectToLogin() {
  const base = import.meta.env.BASE_URL;
  window.location.assign(`${base}app/login/`);
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
    options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}app/` }
  });
}

export async function signInGoogle() {
  await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}app/` }
  });
}

export async function signOut() {
  await getSupabase().auth.signOut();
  redirectToLogin();
}
