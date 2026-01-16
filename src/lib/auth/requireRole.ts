import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export type AllowedUser = {
  id: string;
  email: string;
  display_name: string | null;
  role: string | null;
  is_active: boolean;
  can_reservas: boolean;
  can_mantenimiento: boolean;
  can_cocina: boolean;
};

export type AllowlistInfo = {
  allowlisted: boolean;
  role: string | null;
  allowedUser: AllowedUser | null;
  error: string | null;
};

export async function getAllowlistRoleForUserEmail(email: string | null | undefined): Promise<AllowlistInfo> {
  if (!email) {
    return { allowlisted: false, role: null, allowedUser: null, error: null };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabaseAdmin
    .from('app_allowed_users')
    .select('id, email, display_name, role, is_active, can_reservas, can_mantenimiento, can_cocina')
    .eq('email', normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (error) {
    return { allowlisted: false, role: null, allowedUser: null, error: error.message };
  }

  if (!data) {
    return { allowlisted: false, role: null, allowedUser: null, error: null };
  }

  return {
    allowlisted: true,
    role: data.role ?? null,
    allowedUser: {
      id: data.id,
      email: data.email,
      display_name: data.display_name ?? null,
      role: data.role ?? null,
      is_active: Boolean(data.is_active),
      can_reservas: Boolean(data.can_reservas),
      can_mantenimiento: Boolean(data.can_mantenimiento),
      can_cocina: Boolean(data.can_cocina),
    },
    error: null,
  };
}

export function isAdmin(role: string | null): boolean {
  return role === 'admin';
}

export function getDefaultModulePath(allowedUser: AllowedUser | null): string {
  if (allowedUser?.role === 'admin') return '/admin';
  if (allowedUser?.can_reservas) return '/reservas';
  if (allowedUser?.can_mantenimiento) return '/mantenimiento';
  if (allowedUser?.can_cocina) return '/cocina';
  return '/';
}

export function hasRole(role: string | null, allowedRoles: string[]): boolean {
  if (!role) return false;
  return allowedRoles.includes(role);
}
