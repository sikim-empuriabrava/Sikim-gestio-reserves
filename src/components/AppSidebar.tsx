'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDaysIcon,
  ChevronDownIcon,
  FireIcon,
  MusicalNoteIcon,
  SparklesIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type NavigationLink = {
  label: string;
  href: string;
  basePath: string;
  matchPaths?: string[];
};

type NavigationGroup = {
  label: string;
  icon: IconComponent;
  links: NavigationLink[];
};

type AllowedUser = {
  role: string | null;
  can_reservas: boolean;
  can_mantenimiento: boolean;
  can_cocina: boolean;
  can_cheffing: boolean;
  view_live_capacity: boolean;
  manage_live_capacity: boolean;
};

type Props = {
  className?: string;
  allowedUser: AllowedUser | null;
};

function buildGroups(allowedUser: AllowedUser | null): NavigationGroup[] {
  const groups: NavigationGroup[] = [];
  const isAdmin = allowedUser?.role === 'admin';

  if (isAdmin || allowedUser?.can_reservas) {
    groups.push({
      label: 'Reservas',
      icon: CalendarDaysIcon,
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

  if (isAdmin || allowedUser?.can_mantenimiento) {
    groups.push({
      label: 'Mantenimiento',
      icon: WrenchScrewdriverIcon,
      links: [
        { label: 'Dashboard', href: '/mantenimiento', basePath: '/mantenimiento' },
        { label: 'Tareas', href: '/mantenimiento/tareas', basePath: '/mantenimiento/tareas' },
        { label: 'Calendario', href: '/mantenimiento/calendario', basePath: '/mantenimiento/calendario' },
        { label: 'Stock / reposicion', href: '/mantenimiento/stock', basePath: '/mantenimiento/stock' },
      ],
    });
  }

  if (isAdmin || allowedUser?.can_cocina) {
    groups.push({
      label: 'Cocina',
      icon: FireIcon,
      links: [
        { label: 'Servicio de hoy', href: '/cocina', basePath: '/cocina' },
        { label: 'Tareas', href: '/cocina/tareas', basePath: '/cocina/tareas' },
        { label: 'Notas cocina', href: '/cocina/notas', basePath: '/cocina/notas' },
        { label: 'Stock / mise en place', href: '/cocina/stock', basePath: '/cocina/stock' },
      ],
    });
  }

  if (isAdmin || allowedUser?.can_cheffing) {
    groups.push({
      label: 'Cheffing',
      icon: SparklesIcon,
      links: [{ label: 'Cheffing', href: '/cheffing', basePath: '/cheffing' }],
    });
  }

  if (isAdmin || allowedUser?.view_live_capacity || allowedUser?.manage_live_capacity) {
    const discoLinks: NavigationLink[] = [
      { label: 'Aforo en directo', href: '/disco/aforo-en-directo', basePath: '/disco/aforo-en-directo' },
    ];

    if (isAdmin) {
      discoLinks.push({
        label: 'Historico aforo',
        href: '/disco/historico-aforo',
        basePath: '/disco/historico-aforo',
      });
    }

    groups.push({
      label: 'Disco',
      icon: MusicalNoteIcon,
      links: discoLinks,
    });
  }

  if (isAdmin) {
    groups.push({
      label: 'Admin',
      icon: UserGroupIcon,
      links: [
        { label: 'Panel', href: '/admin', basePath: '/admin' },
        { label: 'Notas del dia', href: '/admin/notas-del-dia', basePath: '/admin/notas-del-dia' },
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

export function AppSidebar({ className, allowedUser }: Props) {
  const pathname = usePathname();
  const role = allowedUser?.role ?? null;
  const canReservas = Boolean(allowedUser?.can_reservas);
  const canMantenimiento = Boolean(allowedUser?.can_mantenimiento);
  const canCocina = Boolean(allowedUser?.can_cocina);
  const canCheffing = Boolean(allowedUser?.can_cheffing);
  const canViewLiveCapacity = Boolean(allowedUser?.view_live_capacity);
  const canManageLiveCapacity = Boolean(allowedUser?.manage_live_capacity);
  const groups = useMemo(
    () =>
      buildGroups({
        role,
        can_reservas: canReservas,
        can_mantenimiento: canMantenimiento,
        can_cocina: canCocina,
        can_cheffing: canCheffing,
        view_live_capacity: canViewLiveCapacity,
        manage_live_capacity: canManageLiveCapacity,
      }),
    [role, canReservas, canMantenimiento, canCocina, canCheffing, canViewLiveCapacity, canManageLiveCapacity],
  );
  const groupsRef = useRef(groups);
  const [openSection, setOpenSection] = useState<string | null>(() => {
    const activeGroup = groups.find((group) =>
      group.links.some((link) => isLinkActive(pathname, link)),
    );
    return activeGroup?.label.toLowerCase() ?? groups[0]?.label.toLowerCase() ?? null;
  });

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    const activeGroup = groupsRef.current.find((group) =>
      group.links.some((link) => isLinkActive(pathname, link)),
    );
    const normalizedActiveLabel = activeGroup?.label.toLowerCase() ?? null;

    if (normalizedActiveLabel) {
      setOpenSection(normalizedActiveLabel);
    }
  }, [pathname]);

  useEffect(() => {
    const defaultSection = groups[0]?.label.toLowerCase() ?? null;
    const hasValidSection = openSection
      ? groups.some((group) => group.label.toLowerCase() === openSection)
      : false;

    if (!defaultSection) {
      if (openSection !== null) {
        setOpenSection(null);
      }
      return;
    }

    if (!hasValidSection && openSection !== defaultSection) {
      setOpenSection(defaultSection);
    }
  }, [groups, openSection]);

  return (
    <nav className={`space-y-1.5 ${className ?? ''}`} aria-label="Navegacion principal">
      {groups.map((group, index) => {
        const Icon = group.icon;
        const isGroupActive = group.links.some((link) => isLinkActive(pathname, link));

        const normalizedLabel = group.label.toLowerCase();
        const isOpen = openSection === normalizedLabel || (!openSection && isGroupActive);

        return (
          <section
            key={group.label}
            className={`${index > 0 ? 'border-t border-stone-800/75 pt-2.5' : ''}`}
          >
            <button
              type="button"
              onClick={() =>
                setOpenSection((prev) => (prev === normalizedLabel ? null : normalizedLabel))
              }
              className={`group/nav flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/25 active:translate-y-px ${
                isGroupActive
                  ? 'bg-amber-300/10 text-amber-100 shadow-[inset_0_0_0_1px_rgba(217,183,121,0.13)]'
                  : 'text-stone-300 hover:bg-stone-900/70 hover:text-stone-50'
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon
                  className={`h-5 w-5 shrink-0 transition-colors duration-200 ${
                    isGroupActive ? 'text-amber-200' : 'text-stone-500 group-hover/nav:text-amber-200/80'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate text-[12px] font-semibold uppercase tracking-[0.16em]">
                  {group.label}
                </span>
              </span>
              <ChevronDownIcon
                className={`h-4 w-4 shrink-0 text-stone-500 transition-transform duration-200 ${
                  isOpen ? 'rotate-180 text-amber-200/80' : ''
                }`}
                aria-hidden="true"
              />
            </button>
            {isOpen ? (
              <div className="mt-1.5 space-y-1 pl-8">
                {group.links.map((link) => {
                  const active = isLinkActive(pathname, link);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex min-h-9 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/25 active:translate-y-px ${
                        active
                          ? 'bg-stone-800/75 text-amber-100 shadow-[inset_3px_0_0_rgba(217,183,121,0.9)]'
                          : 'text-stone-400 hover:bg-stone-900/75 hover:text-stone-100'
                      }`}
                    >
                      <span className="truncate">{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </nav>
  );
}
