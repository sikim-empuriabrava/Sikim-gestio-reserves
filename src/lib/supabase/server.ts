import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from './env';

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseAnonKey();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value })),
      setCookie: (name, value, options) => {
        cookieStore.set({ name, value, ...options });
      },
    },
  });
}
