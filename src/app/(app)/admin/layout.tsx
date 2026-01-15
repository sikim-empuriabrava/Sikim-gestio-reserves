import { getAllowlistRoleForUserEmail, getDefaultModulePath, isAdmin } from '@/lib/auth/requireRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';
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
  const email = user.email?.trim().toLowerCase();

  if (!email) {
    redirect('/login?error=not_allowed');
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(email);

  if (!allowlistInfo.allowlisted) {
    redirect('/login?error=not_allowed');
  }

  if (!isAdmin(allowlistInfo.role)) {
    redirect(getDefaultModulePath(allowlistInfo) ?? '/sin-acceso');
  }

  return (
    <div className="space-y-6">{children}</div>
  );
}
