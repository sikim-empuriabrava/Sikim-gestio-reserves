import { getAllowlistRoleForUserEmail, getDefaultModulePath } from '@/lib/auth/requireRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ReservasLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?error=unauthorized&next=${encodeURIComponent('/reservas')}`);
  }

  const email = user.email?.trim().toLowerCase();
  if (!email) {
    redirect('/login?error=not_allowed');
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(email);
  if (!allowlistInfo.allowlisted) {
    redirect('/login?error=not_allowed');
  }

  if (!allowlistInfo.can_reservas) {
    redirect(getDefaultModulePath(allowlistInfo) ?? '/sin-acceso');
  }

  return (
    <div className="space-y-6">{children}</div>
  );
}
