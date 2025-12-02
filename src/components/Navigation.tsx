'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/reservas', label: 'Reservas' },
  { href: '/reservas-dia', label: 'Reservas (BD)' },
  { href: '/reservas/nueva', label: 'Nueva reserva' },
  { href: '/configuracion', label: 'Configuración' },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2 rounded-xl border border-slate-800 bg-surface/70 px-3 py-2 shadow-lg shadow-slate-900/40 backdrop-blur">
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
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
    </nav>
  );
}
