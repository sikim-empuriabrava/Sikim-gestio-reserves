'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/cheffing', label: 'Cheffing' },
  { href: '/cheffing/productos', label: 'Productos' },
  { href: '/cheffing/elaboraciones', label: 'Elaboraciones' },
  { href: '/cheffing/platos', label: 'Platos' },
  { href: '/cheffing/menus', label: 'Menús' },
  { href: '/cheffing/dashboard', label: 'Dashboard' },
  { href: '/cheffing/menu-engineering', label: 'Menu Engineering' },
] as const;

function withIva(href: string, iva: string | null) {
  if (!iva) {
    return href;
  }

  const params = new URLSearchParams();
  params.set('iva', iva);
  return `${href}?${params.toString()}`;
}

export function CheffingNav() {
  const searchParams = useSearchParams();
  const iva = searchParams.get('iva');

  return (
    <nav className="flex flex-wrap gap-2 text-sm font-semibold text-slate-200">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={withIva(item.href, iva)}
          className="rounded-full border border-slate-700 bg-slate-950/60 px-4 py-1 transition hover:border-slate-500 hover:text-white"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
