import type { SupabaseClient } from '@supabase/supabase-js';

export type AllowlistInfo = {
  allowlisted: boolean;
  role: string | null;
  error: string | null;
};

export async function getAllowlistRoleFromRequest(supabaseAuthClient: SupabaseClient): Promise<AllowlistInfo> {
  const { data, error } = await supabaseAuthClient.from('app_allowed_users').select('id, role').maybeSingle();

  if (error) {
    return { allowlisted: false, role: null, error: error.message };
  }

  if (!data) {
    return { allowlisted: false, role: null, error: null };
  }

  return { allowlisted: true, role: data.role ?? null, error: null };
}

export function isAdmin(role: string | null): boolean {
  return role === 'admin';
}
