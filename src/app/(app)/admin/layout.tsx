import {
  canReceiveExternalReservationNotifications,
  getAllowlistRoleForUserEmail,
  getDefaultModulePath,
  isAdmin,
} from '@/lib/auth/requireRole';
import { OperationalPage } from '@/components/operational/OperationalUI';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?error=unauthorized&next=${encodeURIComponent('/admin')}`);
  }

  // Segunda barrera server-side por si el middleware falla y evitar renderizar el panel sin allowlist.
  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    redirect('/login?error=not_allowed');
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    redirect('/login?error=not_allowed');
  }

  const pathname = headers().get('x-sikim-pathname') ?? '';
  const canUseNotificationsPage =
    pathname === '/admin/notificaciones' &&
    canReceiveExternalReservationNotifications(allowlistInfo.role, allowlistInfo.allowedUser);

  if (!isAdmin(allowlistInfo.role) && !canUseNotificationsPage) {
    redirect(getDefaultModulePath(allowlistInfo.allowedUser));
  }

  return <OperationalPage className="admin-warm-page">{children}</OperationalPage>;
}
