'use client';

import Link, { type LinkProps } from 'next/link';
import { usePathname } from 'next/navigation';

type NavigationLink = {
  key: string;
  label: string;
  href: LinkProps['href'];
  basePath: string;
  matchPaths?: string[];
  includeChildren?: boolean;
};

type NavigationSection = {
  label: string;
  links: NavigationLink[];
};

const sections: NavigationSection[] = [
  {
    label: 'Reservas',
    links: [
      {
        key: 'reservas-calendario',
        label: 'Calendario',
        href: { pathname: '/reservas', query: { view: 'week' } },
        basePath: '/reservas',
        matchPaths: ['/reservas-dia'],
        includeChildren: false,
      },
      { key: 'reservas-nueva', label: 'Nueva reserva', href: '/reservas/nueva', basePath: '/reservas/nueva' },
    ],
  },
  {
    label: 'Mantenimiento',
    links: [
      {
        key: 'mantenimiento-dashboard',
        label: 'Dashboard',
        href: '/mantenimiento',
        basePath: '/mantenimiento',
        includeChildren: false,
      },
      { key: 'mantenimiento-tareas', label: 'Tareas / Incidencias', href: '/mantenimiento/tareas', basePath: '/mantenimiento/tareas' },
      { key: 'mantenimiento-rutinas', label: 'Rutinas semanales', href: '/mantenimiento/rutinas', basePath: '/mantenimiento/rutinas' },
      { key: 'mantenimiento-stock', label: 'Stock / reposición', href: '/mantenimiento/stock', basePath: '/mantenimiento/stock' },
    ],
  },
  {
    label: 'Cocina',
    links: [
      {
        key: 'cocina-servicio',
        label: 'Servicio de hoy',
        href: '/cocina',
        basePath: '/cocina',
        includeChildren: false,
      },
      { key: 'cocina-tareas', label: 'Tareas', href: '/cocina/tareas', basePath: '/cocina/tareas' },
      { key: 'cocina-notas', label: 'Notas cocina', href: '/cocina/notas', basePath: '/cocina/notas' },
      { key: 'cocina-stock', label: 'Stock / mise en place', href: '/cocina/stock', basePath: '/cocina/stock' },
    ],
  },
  {
    label: 'Admin',
    links: [
      {
        key: 'admin-usuarios',
        label: 'Usuarios y permisos',
        href: '/admin/usuarios',
        basePath: '/admin',
      },
    ],
  },
];

function isLinkActive(link: NavigationLink, pathname: string) {
  const allowChildren = link.includeChildren ?? true;
  const directMatch = pathname === link.basePath;
  const childMatch = allowChildren && pathname.startsWith(`${link.basePath}/`);
  const extraMatches = link.matchPaths?.some((prefix) => pathname.startsWith(prefix));
  return directMatch || childMatch || extraMatches || (link.basePath === '/reservas' && pathname === '/reservas');
}

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-surface/70 px-3 py-3 shadow-lg shadow-slate-900/40 backdrop-blur">
      {sections.map((section) => {
        const sectionActive = section.links.some((link) => isLinkActive(link, pathname));
        return (
          <div key={section.label} className="flex flex-wrap items-center gap-2 border-b border-slate-800/70 pb-2 last:border-b-0 last:pb-0">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wide ${
                sectionActive ? 'text-primary-200' : 'text-slate-400'
              }`}
            >
              {section.label}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {section.links.map((link) => {
                const isActive = isLinkActive(link, pathname);
                return (
                  <Link
                    key={link.key}
                    href={link.href}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-primary-600/80 text-white shadow shadow-primary-900/40'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
