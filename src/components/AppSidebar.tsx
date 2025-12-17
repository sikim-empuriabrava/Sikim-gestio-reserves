'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

type NavigationLink = {
  label: string;
  href: string;
  basePath: string;
  matchPaths?: string[];
};

type NavigationGroup = {
  label: string;
  links: NavigationLink[];
};

const groups: NavigationGroup[] = [
  {
    label: 'Reservas',
    links: [
      {
        label: 'Calendario',
        href: '/reservas?view=week',
        basePath: '/reservas',
        matchPaths: ['/reservas-dia', '/reservas-semana', '/reservas/grupo'],
      },
      {
        label: 'Nueva reserva',
        href: '/reservas/nueva',
        basePath: '/reservas/nueva',
      },
    ],
  },
  {
    label: 'Mantenimiento',
    links: [
      { label: 'Dashboard', href: '/mantenimiento', basePath: '/mantenimiento' },
      { label: 'Tareas / Incidencias', href: '/mantenimiento/tareas', basePath: '/mantenimiento/tareas' },
      { label: 'Rutinas semanales', href: '/mantenimiento/rutinas', basePath: '/mantenimiento/rutinas' },
      { label: 'Stock / reposición', href: '/mantenimiento/stock', basePath: '/mantenimiento/stock' },
    ],
  },
  {
    label: 'Cocina',
    links: [
      { label: 'Servicio de hoy', href: '/cocina', basePath: '/cocina' },
      { label: 'Notas cocina', href: '/cocina/notas', basePath: '/cocina/notas' },
      { label: 'Stock / mise en place', href: '/cocina/stock', basePath: '/cocina/stock' },
    ],
  },
  {
    label: 'Admin',
    links: [{ label: 'Usuarios y permisos', href: '/admin/usuarios', basePath: '/admin/usuarios' }],
  },
];

function isLinkActive(pathname: string, link: NavigationLink) {
  const matchChildren = pathname === link.basePath || pathname.startsWith(`${link.basePath}/`);
  const matchesExtra = link.matchPaths?.some((matchPath) => pathname.startsWith(matchPath));
  return matchChildren || Boolean(matchesExtra);
}

export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [openSection, setOpenSection] = useState<string | null>('reservas');

  useEffect(() => {
    const activeGroup = groups.find((group) => group.links.some((link) => isLinkActive(pathname, link)));

    if (activeGroup) {
      setOpenSection((prev) => {
        const normalizedLabel = activeGroup.label.toLowerCase();
        return prev === normalizedLabel ? prev : normalizedLabel;
      });
    }
  }, [pathname]);

  return (
    <nav className={`space-y-3 ${className ?? ''}`} aria-label="Navegación principal">
      {groups.map((group) => {
        const isGroupActive = group.links.some((link) => isLinkActive(pathname, link));

        const normalizedLabel = group.label.toLowerCase();
        const isOpen = openSection === normalizedLabel || (!openSection && isGroupActive);

        return (
          <div
            key={group.label}
            className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 shadow-lg shadow-slate-950/30"
          >
            <button
              type="button"
              onClick={() =>
                setOpenSection((prev) => (prev === normalizedLabel ? null : normalizedLabel))
              }
              className="flex w-full items-center justify-between gap-2 bg-slate-900/80 px-4 py-3 text-left text-sm font-semibold text-slate-100"
            >
              <span>{group.label}</span>
              <ChevronDownIcon
                className={`h-4 w-4 text-slate-400 transition duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {isOpen ? (
              <div className="flex flex-col gap-1 p-2">
                {group.links.map((link) => {
                  const active = isLinkActive(pathname, link);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        active
                          ? 'bg-primary-600/80 text-white shadow shadow-primary-900/40'
                          : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
