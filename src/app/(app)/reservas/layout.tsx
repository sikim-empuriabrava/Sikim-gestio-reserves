import { ModuleSubnav } from '@/components/ModuleSubnav';

const links = [
  { label: 'Calendario', href: '/reservas?view=week', basePath: '/reservas', matchPaths: ['/reservas-dia', '/reservas-semana', '/reservas/grupo'] },
  { label: 'Nueva reserva', href: '/reservas/nueva', basePath: '/reservas/nueva' },
];

export default function ReservasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <ModuleSubnav title="Reservas" links={links} />
      <div className="space-y-6">{children}</div>
    </div>
  );
}
