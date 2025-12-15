'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from './env';

export function createSupabaseBrowserClient() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseAnonKey();

  return createBrowserClient(supabaseUrl, supabaseKey);
}
