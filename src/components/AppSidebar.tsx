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

type AccessFlags = {
  canReservas: boolean;
  canMantenimiento: boolean;
  canCocina: boolean;
  role: string | null;
};

type Props = {
  className?: string;
  access: AccessFlags;
};

function buildGroups(access: AccessFlags): NavigationGroup[] {
  const groups: NavigationGroup[] = [];

  if (access.canReservas) {
    groups.push({
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
    });
  }

  if (access.canMantenimiento) {
    groups.push({
      label: 'Mantenimiento',
      links: [
        { label: 'Dashboard', href: '/mantenimiento', basePath: '/mantenimiento' },
        { label: 'Tareas', href: '/mantenimiento/tareas', basePath: '/mantenimiento/tareas' },
        { label: 'Calendario', href: '/mantenimiento/calendario', basePath: '/mantenimiento/calendario' },
        { label: 'Stock / reposición', href: '/mantenimiento/stock', basePath: '/mantenimiento/stock' },
      ],
    });
  }

  if (access.canCocina) {
    groups.push({
      label: 'Cocina',
      links: [
        { label: 'Servicio de hoy', href: '/cocina', basePath: '/cocina' },
        { label: 'Tareas', href: '/cocina/tareas', basePath: '/cocina/tareas' },
        { label: 'Notas cocina', href: '/cocina/notas', basePath: '/cocina/notas' },
        { label: 'Stock / mise en place', href: '/cocina/stock', basePath: '/cocina/stock' },
      ],
    });
  }

  if (access.role === 'admin') {
    groups.push({
      label: 'Admin',
      links: [
        { label: 'Panel', href: '/admin', basePath: '/admin' },
        { label: 'Notas del día', href: '/admin/notas-del-dia', basePath: '/admin/notas-del-dia' },
        { label: 'Tareas', href: '/admin/tareas', basePath: '/admin/tareas' },
        { label: 'Rutinas', href: '/admin/rutinas', basePath: '/admin/rutinas' },
        { label: 'Usuarios y permisos', href: '/admin/usuarios', basePath: '/admin/usuarios' },
      ],
    });
  }

  return groups;
}

function isLinkActive(pathname: string, link: NavigationLink) {
  const matchChildren = pathname === link.basePath || pathname.startsWith(`${link.basePath}/`);
  const matchesExtra = link.matchPaths?.some((matchPath) => pathname.startsWith(matchPath));
  return matchChildren || Boolean(matchesExtra);
}

export function AppSidebar({ className, access }: Props) {
  const pathname = usePathname();
  const groups = buildGroups(access);
  const defaultSection = groups[0]?.label.toLowerCase() ?? null;
  const [openSection, setOpenSection] = useState<string | null>(defaultSection);

  useEffect(() => {
    if (!defaultSection) {
      setOpenSection(null);
      return;
    }

    const exists = groups.some((group) => group.label.toLowerCase() === openSection);
    if (!exists) {
      setOpenSection(defaultSection);
    }
  }, [defaultSection, groups, openSection]);

  useEffect(() => {
    const activeGroup = groups.find((group) => group.links.some((link) => isLinkActive(pathname, link)));

    if (activeGroup) {
      setOpenSection((prev) => {
        const normalizedLabel = activeGroup.label.toLowerCase();
        return prev === normalizedLabel ? prev : normalizedLabel;
      });
    }
  }, [groups, pathname]);

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
