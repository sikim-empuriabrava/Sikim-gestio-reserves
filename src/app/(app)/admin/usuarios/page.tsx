import { redirect } from 'next/navigation';
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

  const email = user.email?.trim().toLowerCase();

  if (!email) {
    redirect('/login?error=not_allowed');
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(email);

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    redirect('/login?error=not_allowed');
  }

  if (!isAdmin(allowlistInfo.role)) {
    redirect(getDefaultModulePath(allowlistInfo.allowedUser));
  }

  return (
    <AllowedUsersManager
      initialUsers={[]}
      currentUserEmail={email}
      currentUserRole={allowlistInfo.role}
    />
  );
}
