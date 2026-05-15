import { redirect } from 'next/navigation';

import { getAllowlistRoleForUserEmail, getDefaultLandingPath } from '@/lib/auth/requireRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function Page() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    redirect('/login?error=not_allowed');
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    redirect('/login?error=not_allowed');
  }

  const landingPath = getDefaultLandingPath(allowlistInfo.allowedUser);

  if (landingPath === '/') {
    redirect('/login?error=not_allowed');
  }

  redirect(landingPath);
}
