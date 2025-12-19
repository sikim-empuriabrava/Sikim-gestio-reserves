import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from './env';

export function createSupabaseRouteHandlerClient(response: NextResponse) {
  const cookieStore = cookies();
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseAnonKey();

  return createRouteHandlerClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
    cookies: {
      getAll: () => cookieStore.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value })),
      setCookie: (name, value, options) => {
        response.cookies.set({ name, value, ...options });
      },
    },
  });
}

export function mergeResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
}
