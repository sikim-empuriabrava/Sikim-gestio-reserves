import { createClient } from '@supabase/supabase-js';

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL for Supabase admin client');
  }

  return url;
}

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error(
      '[supabaseAdmin] Missing SUPABASE_SERVICE_ROLE_KEY. Configure the SUPABASE_SERVICE_ROLE_KEY env var in Vercel Project Settings (Production/Preview).',
    );
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required. Set the SUPABASE_SERVICE_ROLE_KEY env var in Vercel (Production/Preview).',
    );
  }

  return serviceRoleKey;
}

export function createSupabaseAdminClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
