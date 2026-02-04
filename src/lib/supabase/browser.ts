'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from './env.public';

export function createSupabaseBrowserClient() {
  const supabaseUrl = getPublicSupabaseUrl();
  const supabaseKey = getPublicSupabaseAnonKey();

  return createBrowserClient(supabaseUrl, supabaseKey);
}
