import { ModuleSubnav } from '@/components/ModuleSubnav';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';
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
    redirect('/login?error=unauthorized');
  }

  // Segunda barrera server-side por si el middleware falla y evitar renderizar el panel sin allowlist.
  const email = user.email?.trim().toLowerCase();

  const { allowlisted, role } = await getAllowlistRoleForUserEmail(email);

  if (!allowlisted) {
    redirect('/login?error=not_allowed');
  }

  if (!isAdmin(role)) {
    redirect('/?error=forbidden');
  }

  return (
    <div className="flex flex-col gap-6">
      <ModuleSubnav title="Admin" links={links} />
      <div className="space-y-6">{children}</div>
    </div>
  );
}
