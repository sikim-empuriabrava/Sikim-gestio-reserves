import { ModuleSubnav } from '@/components/ModuleSubnav';

const links = [
  { label: 'Usuarios y permisos', href: '/admin/usuarios', basePath: '/admin/usuarios' },
  { label: 'Notas del día', href: '/admin/notas-del-dia', basePath: '/admin/notas-del-dia' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <ModuleSubnav title="Admin" links={links} />
      <div className="space-y-6">{children}</div>
    </div>
  );
}
