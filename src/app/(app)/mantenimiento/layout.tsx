import { ModuleSubnav } from '@/components/ModuleSubnav';

const links = [
  { label: 'Dashboard', href: '/mantenimiento', basePath: '/mantenimiento' },
  { label: 'Tareas / Incidencias', href: '/mantenimiento/tareas', basePath: '/mantenimiento/tareas' },
  { label: 'Calendario', href: '/mantenimiento/calendario', basePath: '/mantenimiento/calendario' },
  { label: 'Rutinas semanales', href: '/mantenimiento/rutinas', basePath: '/mantenimiento/rutinas' },
  { label: 'Stock / reposición', href: '/mantenimiento/stock', basePath: '/mantenimiento/stock' },
];

export default function MantenimientoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <ModuleSubnav title="Mantenimiento" links={links} />
      <div className="space-y-6">{children}</div>
    </div>
  );
}
