import { ModuleSubnav } from '@/components/ModuleSubnav';

const links = [
  { label: 'Usuarios y permisos', href: '/admin/usuarios', basePath: '/admin/usuarios' },
  { label: 'Notas del día', href: '/admin/notas-del-dia', basePath: '/admin/notas-del-dia' },
  { label: 'Centro de control', href: '/admin/tareas', basePath: '/admin/tareas' },
  { label: 'Rutinas', href: '/admin/rutinas', basePath: '/admin/rutinas' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <ModuleSubnav title="Admin" links={links} />
      <div className="space-y-6">{children}</div>
    </div>
  );
}
