import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export type AllowlistInfo = {
  allowlisted: boolean;
  role: string | null;
  error: string | null;
};

export async function getAllowlistRoleForUserEmail(email: string | null | undefined): Promise<AllowlistInfo> {
  if (!email) {
    return { allowlisted: false, role: null, error: null };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabaseAdmin
    .from('app_allowed_users')
    .select('id, role')
    .eq('email', normalizedEmail)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

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

export function hasRole(role: string | null, allowedRoles: string[]): boolean {
  if (!role) return false;
  return allowedRoles.includes(role);
}
