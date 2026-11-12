import { createServerClient } from '@supabase/ssr';
import type { CookieMethodsServer } from '@supabase/ssr';
import { cookies } from 'next/headers';

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase environment variables');
  return { url, key };
}

export function createClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const { url, key } = getSupabaseEnv();
  const cookieMethods: CookieMethodsServer = {
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      } catch {
        // Server Components cannot set cookies; middleware refreshes the session.
      }
    },
  };
  return createServerClient(url, key, { cookies: cookieMethods });
}
