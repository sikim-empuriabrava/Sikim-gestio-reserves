'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { cn } from '@/components/ui';
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  return (
    <nav className="flex flex-wrap gap-1.5 text-sm font-semibold text-slate-200 lg:justify-end">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === '/cheffing' ? pathname === item.href : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={mergeQueryString(item.href, query)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3.5 py-1.5 shadow-sm shadow-slate-950/20 transition duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/25 active:translate-y-px',
              isActive
                ? 'border-primary-400/70 bg-primary-500/20 text-primary-100 shadow-primary-950/20 ring-1 ring-primary-300/10'
                : 'border-slate-700/75 bg-slate-950/45 text-slate-300 hover:border-slate-500/90 hover:bg-slate-900/75 hover:text-white',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
