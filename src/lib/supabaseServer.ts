import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import {
  getSupabaseAnonKey,
  getSupabaseAuthStorageKey,
  getSupabaseUrl,
} from './supabaseClient';

const SECURE_COOKIES = process.env.NODE_ENV === 'production';

function getExpiresFromSession(value: string) {
  try {
    const parsed = JSON.parse(value) as { expires_at?: number };

    if (parsed?.expires_at) {
      return new Date(parsed.expires_at * 1000);
    }
  } catch (error) {
    console.warn('Unable to parse Supabase session cookie expiration', error);
  }

  return undefined;
}

export function createSupabaseServerClient() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  const storageKey = getSupabaseAuthStorageKey();
  const cookieStore = cookies();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: {
        getItem: (key) => {
          if (key !== storageKey) return null;

          return cookieStore.get(key)?.value ?? null;
        },
        setItem: async (key, value) => {
          if (key !== storageKey) return;

          const expires = getExpiresFromSession(value);

          cookieStore.set(key, value, {
            path: '/',
            sameSite: 'lax',
            secure: SECURE_COOKIES,
            ...(expires ? { expires } : { maxAge: 60 * 60 * 24 * 7 }),
          });
        },
        removeItem: async (key) => {
          if (key !== storageKey) return;

          cookieStore.set(key, '', {
            path: '/',
            sameSite: 'lax',
            secure: SECURE_COOKIES,
            expires: new Date(0),
          });
        },
      },
    },
  });
}
