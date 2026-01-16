import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAllowlistRoleForUserEmail, getDefaultModulePath, isAdmin } from '@/lib/auth/requireRole';

type PageSearchParams = {
  week_start?: string;
};

export default async function MantenimientoRutinasPage({ searchParams }: { searchParams: PageSearchParams }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?error=unauthorized&next=%2Fmantenimiento%2Frutinas');
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

  const params = new URLSearchParams();

  if (searchParams.week_start) {
    params.set('week_start', searchParams.week_start);
  }

  const query = params.toString();
  redirect(query ? `/admin/rutinas?${query}` : '/admin/rutinas');
}
