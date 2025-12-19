import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from './env';

export function createSupabaseMiddlewareClient(req: NextRequest, res: NextResponse) {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseAnonKey();

  return createMiddlewareClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
    },
    cookies: {
      getAll: () => req.cookies.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value })),
      setCookie: (name, value, options) => {
        res.cookies.set({ name, value, ...options });
      },
    },
  });
}
