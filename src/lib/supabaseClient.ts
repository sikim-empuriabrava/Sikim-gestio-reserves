import { createClient } from '@supabase/supabase-js';

const SECURE_COOKIES = process.env.NODE_ENV === 'production';

export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL for Supabase client');
  }

  return url;
}

export function getSupabaseAnonKey() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY for Supabase client');
  }

  return anonKey;
}

export function getSupabaseAuthStorageKey() {
  const supabaseUrl = getSupabaseUrl();
  const projectRef = new URL(supabaseUrl).host.split('.')[0];

  return `sb-${projectRef}-auth-token`;
}

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

function setBrowserCookie(name: string, value: string, expires?: Date) {
  const attributes = [
    'path=/',
    'SameSite=Lax',
    SECURE_COOKIES ? 'Secure' : '',
    expires ? `expires=${expires.toUTCString()}` : `max-age=${60 * 60 * 24 * 7}`,
  ].filter(Boolean);

  document.cookie = `${name}=${encodeURIComponent(value)}; ${attributes.join('; ')}`;
}

function getBrowserCookie(name: string) {
  const value = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];

  return value ? decodeURIComponent(value) : null;
}

export function createSupabaseBrowserClient() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  const storageKey = getSupabaseAuthStorageKey();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
      storage: {
        getItem: (key) => {
          if (key !== storageKey) return null;

          return getBrowserCookie(key);
        },
        setItem: async (key, value) => {
          if (key !== storageKey) return;

          setBrowserCookie(key, value, getExpiresFromSession(value));
        },
        removeItem: async (key) => {
          if (key !== storageKey) return;

          const attributes = ['path=/', 'SameSite=Lax', SECURE_COOKIES ? 'Secure' : '', 'max-age=0'].filter(Boolean);

          document.cookie = `${key}=; ${attributes.join('; ')}`;
        },
      },
    },
  });
}
