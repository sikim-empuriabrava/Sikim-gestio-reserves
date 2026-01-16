import { getAllowlistRoleForUserEmail, getDefaultModulePath, isAdmin } from '@/lib/auth/requireRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function CocinaLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?error=unauthorized&next=${encodeURIComponent('/cocina')}`);
  }

  const requesterEmail = user.email?.trim().toLowerCase();
  if (!requesterEmail) {
    redirect('/login?error=not_allowed');
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    redirect('/login?error=not_allowed');
  }

  if (!isAdmin(allowlistInfo.role) && !allowlistInfo.allowedUser?.can_cocina) {
    redirect(getDefaultModulePath(allowlistInfo.allowedUser));
  }

  return (
    <div className="space-y-6">{children}</div>
  );
}
