import 'server-only';

import { redirect } from 'next/navigation';
import { getAllowlistRoleForUserEmail, getDefaultModulePath, isAdmin, type AllowedUser } from '@/lib/auth/requireRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export function canReadCrm(role: string | null, allowedUser: AllowedUser | null) {
  return isAdmin(role) || Boolean(allowedUser?.can_reservas);
}

export function canWriteCrm(role: string | null) {
  return isAdmin(role);
}

export async function requireCrmReadAccess(nextPath = '/crm') {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?error=unauthorized&next=${encodeURIComponent(nextPath)}`);
  }

  const requesterEmail = user.email?.trim().toLowerCase();
  if (!requesterEmail) {
    redirect('/login?error=not_allowed');
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    redirect('/login?error=not_allowed');
  }

  if (!canReadCrm(allowlistInfo.role, allowlistInfo.allowedUser)) {
    redirect(getDefaultModulePath(allowlistInfo.allowedUser));
  }

  return {
    user,
    role: allowlistInfo.role,
    allowedUser: allowlistInfo.allowedUser,
    canWrite: canWriteCrm(allowlistInfo.role),
  };
}

export async function requireCrmWriteAccess(nextPath = '/crm') {
  const access = await requireCrmReadAccess(nextPath);

  if (!access.canWrite) {
    redirect('/sin-acceso');
  }

  return access;
}
