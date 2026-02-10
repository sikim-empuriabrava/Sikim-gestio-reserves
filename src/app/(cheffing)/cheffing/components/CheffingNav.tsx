'use client';

import Link from 'next/link';
import { useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/cheffing', label: 'Cheffing' },
  { href: '/cheffing/productos', label: 'Productos' },
  { href: '/cheffing/elaboraciones', label: 'Elaboraciones' },
  { href: '/cheffing/platos', label: 'Platos' },
  { href: '/cheffing/menus', label: 'Menús' },
  { href: '/cheffing/dashboard', label: 'Dashboard' },
  { href: '/cheffing/menu-engineering', label: 'Menu Engineering' },
] as const;

function withParams(href: string, searchParams: ReadonlyURLSearchParams) {
  const params = new URLSearchParams(searchParams.toString());

  if (params.toString().length === 0) {
    return href;
  }

  return `${href}?${params.toString()}`;
}

export function CheffingNav() {
  const searchParams = useSearchParams();
  return (
    <nav className="flex flex-wrap gap-2 text-sm font-semibold text-slate-200">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={withParams(item.href, searchParams)}
          className="rounded-full border border-slate-700 bg-slate-950/60 px-4 py-1 transition hover:border-slate-500 hover:text-white"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
