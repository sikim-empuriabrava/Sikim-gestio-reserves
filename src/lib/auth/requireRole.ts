import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export type AllowlistInfo = {
  allowlisted: boolean;
  role: string | null;
  can_reservas: boolean;
  can_mantenimiento: boolean;
  can_cocina: boolean;
  error: string | null;
};

export async function getAllowlistRoleForUserEmail(email: string | null | undefined): Promise<AllowlistInfo> {
  if (!email) {
    return {
      allowlisted: false,
      role: null,
      can_reservas: false,
      can_mantenimiento: false,
      can_cocina: false,
      error: null,
    };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabaseAdmin
    .from('app_allowed_users')
    .select('id, role, can_reservas, can_mantenimiento, can_cocina')
    .eq('email', normalizedEmail)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      allowlisted: false,
      role: null,
      can_reservas: false,
      can_mantenimiento: false,
      can_cocina: false,
      error: error.message,
    };
  }

  if (!data) {
    return {
      allowlisted: false,
      role: null,
      can_reservas: false,
      can_mantenimiento: false,
      can_cocina: false,
      error: null,
    };
  }

  return {
    allowlisted: true,
    role: data.role ?? null,
    can_reservas: Boolean(data.can_reservas),
    can_mantenimiento: Boolean(data.can_mantenimiento),
    can_cocina: Boolean(data.can_cocina),
    error: null,
  };
}

export function isAdmin(role: string | null): boolean {
  return role === 'admin';
}

export function getDefaultModulePath(allowlist: AllowlistInfo): string | null {
  if (allowlist.can_reservas) return '/reservas';
  if (allowlist.can_mantenimiento) return '/mantenimiento';
  if (allowlist.can_cocina) return '/cocina';
  return null;
}

export function hasRole(role: string | null, allowedRoles: string[]): boolean {
  if (!role) return false;
  return allowedRoles.includes(role);
}
