'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type SubnavLink = {
  label: string;
  href: string;
  basePath: string;
  matchPaths?: string[];
};

type Props = {
  title: string;
  links: SubnavLink[];
};

function isActive(pathname: string, link: SubnavLink) {
  const directMatch = pathname === link.basePath || pathname.startsWith(`${link.basePath}/`);
  const extraMatch = link.matchPaths?.some((path) => pathname.startsWith(path));
  return directMatch || Boolean(extraMatch);
}

export function ModuleSubnav({ title, links }: Props) {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-10 rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</span>
        <div className="flex flex-wrap items-center gap-2">
          {links.map((link) => {
            const active = isActive(pathname, link);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? 'bg-primary-600/80 text-white shadow shadow-primary-900/30'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
