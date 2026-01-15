import { redirect } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAllowlistRoleForUserEmail, getDefaultModulePath, isAdmin } from '@/lib/auth/requireRole';
import { AllowedUsersManager } from './AllowedUsersManager';

export default async function AdminUsuariosPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/admin/usuarios')}`);
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(user.email);

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    redirect('/login?error=not_allowed');
  }

  if (!isAdmin(allowlistInfo.role)) {
    redirect(getDefaultModulePath(allowlistInfo.allowedUser));
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data } = await supabaseAdmin
    .from('app_allowed_users')
    .select('id,email,display_name,role,is_active,can_reservas,can_mantenimiento,can_cocina')
    .order('email', { ascending: true });

  return <AllowedUsersManager initialUsers={data ?? []} />;
}
