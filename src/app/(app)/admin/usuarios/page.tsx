import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAllowlistRoleForUserEmail, getDefaultModulePath, isAdmin } from '@/lib/auth/requireRole';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { AllowedUsersManager } from './AllowedUsersManager';

export default async function AdminUsuariosPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/admin/usuarios')}`);
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

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: rows, error } = await supabaseAdmin
    .from('app_allowed_users')
    .select('id,email,display_name,role,is_active,can_reservas,can_mantenimiento,can_cocina')
    .order('email', { ascending: true });
  if (error) {
    console.error('[admin/usuarios] Failed to load app_allowed_users', error);
  }
  const initialUsers = rows ?? [];

  return (
    <AllowedUsersManager
      initialUsers={initialUsers}
      initialLoadError={error?.message ?? null}
      currentUserEmail={requesterEmail}
      currentUserRole={allowlistInfo.role}
    />
  );
}
