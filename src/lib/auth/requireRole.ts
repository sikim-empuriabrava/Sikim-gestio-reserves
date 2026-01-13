import type { SupabaseClient } from '@supabase/supabase-js';

type AllowlistRoleResponse = {
  role: string | null;
};

export async function getAllowlistRoleFromRequest(supabaseAuthClient: SupabaseClient): Promise<AllowlistRoleResponse> {
  const { data, error } = await supabaseAuthClient.from('app_allowed_users').select('role').maybeSingle();

  if (error) {
    return { role: null };
  }

  return { role: data?.role ?? null };
}

export function isAdmin(role: string | null): boolean {
  return role === 'admin';
}
