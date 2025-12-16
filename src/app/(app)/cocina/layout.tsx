import { ModuleSubnav } from '@/components/ModuleSubnav';

const links = [
  { label: 'Servicio de hoy', href: '/cocina', basePath: '/cocina' },
  { label: 'Notas cocina', href: '/cocina/notas', basePath: '/cocina/notas' },
  { label: 'Stock / mise en place', href: '/cocina/stock', basePath: '/cocina/stock' },
];

export default function CocinaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <ModuleSubnav title="Cocina" links={links} />
      <div className="space-y-6">{children}</div>
    </div>
  );
}
