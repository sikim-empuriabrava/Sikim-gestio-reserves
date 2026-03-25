'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { mergeQueryString } from '@/lib/cheffing/url';

const NAV_ITEMS = [
  { href: '/cheffing', label: 'Cheffing' },
  { href: '/cheffing/productos', label: 'Productos' },
  { href: '/cheffing/elaboraciones', label: 'Elaboraciones' },
  { href: '/cheffing/platos', label: 'Platos' },
  { href: '/cheffing/bebidas', label: 'Bebidas' },
  { href: '/cheffing/menus', label: 'Menús' },
  { href: '/cheffing/carta', label: 'Carta' },
  { href: '/cheffing/dashboard', label: 'Dashboard' },
  { href: '/cheffing/menu-engineering', label: 'Menu Engineering' },
  { href: '/cheffing/ventas', label: 'Ventas POS' },
  { href: '/cheffing/compras', label: 'Compras' },
  { href: '/cheffing/proveedores', label: 'Proveedores' },
] as const;

export function CheffingNav() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  return (
    <nav className="flex flex-wrap gap-2 text-sm font-semibold text-slate-200">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={mergeQueryString(item.href, query)}
          className="rounded-full border border-slate-700 bg-slate-950/60 px-4 py-1 transition hover:border-slate-500 hover:text-white"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
