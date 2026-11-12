import { createServerClient } from '@supabase/ssr';
import type { CookieMethodsServer } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase environment variables');

  let response = NextResponse.next({ request: { headers: request.headers } });
  const cookieMethods: CookieMethodsServer = {
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      cookiesToSet.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options),
      );
    },
  };
  const supabase = createServerClient(url, key, { cookies: cookieMethods });

  await supabase.auth.getUser();
  return response;
}
