import 'server-only';

import { redirect } from 'next/navigation';

import { getAllowlistRoleForUserEmail, getDefaultModulePath, isAdmin } from '@/lib/auth/requireRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function requireCapacityHistoryAdmin(nextPath: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const requesterEmail = user.email?.trim().toLowerCase();
  if (!requesterEmail) {
    redirect('/login?error=not_allowed');
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    redirect('/login?error=not_allowed');
  }

  if (!isAdmin(allowlistInfo.role)) {
    redirect(getDefaultModulePath(allowlistInfo.allowedUser));
  }

  return { user, allowlistInfo };
}
