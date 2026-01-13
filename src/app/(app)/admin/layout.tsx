import { ModuleSubnav } from '@/components/ModuleSubnav';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const links = [
  { label: 'Usuarios y permisos', href: '/admin/usuarios', basePath: '/admin/usuarios' },
  { label: 'Notas del día', href: '/admin/notas-del-dia', basePath: '/admin/notas-del-dia' },
  { label: 'Centro de control', href: '/admin/tareas', basePath: '/admin/tareas' },
  { label: 'Rutinas', href: '/admin/rutinas', basePath: '/admin/rutinas' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/admin')}`);
  }

  const email = user.email?.toLowerCase();

  if (!email) {
    redirect('/');
  }

  const {
    data: allowedUser,
    error: allowlistError,
  } = await supabase
    .from('app_allowed_users')
    .select('email, role, is_active')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();

  if (allowlistError) {
    console.error('[admin layout] allowlist query error', allowlistError);
    redirect('/');
  }

  if (!allowedUser || allowedUser.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="flex flex-col gap-6">
      <ModuleSubnav title="Admin" links={links} />
      <div className="space-y-6">{children}</div>
    </div>
  );
}
