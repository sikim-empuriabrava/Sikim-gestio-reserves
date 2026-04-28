import type { ButtonHTMLAttributes, ComponentPropsWithoutRef, ReactNode } from 'react';
import Link from 'next/link';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

import { cn } from '@/components/ui';

type Tone = 'primary' | 'success' | 'neutral' | 'danger' | 'muted';

const buttonToneClassName: Record<Tone, string> = {
  primary:
    'border-primary-400/50 bg-primary-600 text-white shadow-primary-900/25 hover:border-primary-300 hover:bg-primary-500 focus-visible:ring-primary-300/40',
  success:
    'border-emerald-400/50 bg-emerald-500/10 text-emerald-100 hover:border-emerald-300 hover:bg-emerald-500/20 focus-visible:ring-emerald-300/30',
  neutral:
    'border-slate-700/80 bg-slate-950/50 text-slate-200 hover:border-slate-500 hover:bg-slate-900/70 hover:text-white focus-visible:ring-primary-400/25',
  danger:
    'border-rose-500/50 bg-rose-500/10 text-rose-200 hover:border-rose-400 hover:bg-rose-500/15 hover:text-rose-100 focus-visible:ring-rose-300/25',
  muted:
    'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-600 hover:text-slate-200 focus-visible:ring-slate-400/20',
};

export const cheffingInputClassName =
  'h-10 w-full rounded-xl border border-slate-700/80 bg-slate-950/75 px-3 text-sm text-white outline-none transition-colors duration-150 placeholder:text-slate-500 hover:border-slate-600 focus:border-primary-400/70 focus:ring-2 focus:ring-primary-500/20';

export const cheffingSelectClassName =
  'h-10 w-full rounded-xl border border-slate-700/80 bg-slate-950/75 px-3 text-sm text-white outline-none transition-colors duration-150 hover:border-slate-600 focus:border-primary-400/70 focus:ring-2 focus:ring-primary-500/20';

export const cheffingTableClassName = 'w-full text-left text-sm text-slate-200';

export const cheffingTheadClassName =
  'bg-slate-950/80 text-[11px] uppercase tracking-wide text-slate-400';

export const cheffingHeaderButtonClassName =
  'inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 font-semibold text-slate-300 transition-colors duration-150 hover:bg-slate-800/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/25';

export const cheffingRowClassName =
  'border-t border-slate-800/60 transition-colors duration-150 hover:bg-slate-800/35';

export const cheffingEditingRowClassName = 'bg-primary-900/20 hover:bg-primary-900/25';

export const cheffingNumericClassName = 'tabular-nums text-slate-100';

export function CheffingButton({
  tone = 'neutral',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold shadow-lg shadow-slate-950/15 transition duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2',
        buttonToneClassName[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function CheffingLinkButton({
  href,
  tone = 'neutral',
  className,
  children,
}: {
  href: string;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold shadow-lg shadow-slate-950/20 transition duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2',
        buttonToneClassName[tone],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function CheffingSearchInput({
  label,
  className,
  inputClassName,
  ...props
}: ComponentPropsWithoutRef<'input'> & {
  label: string;
  inputClassName?: string;
}) {
  return (
    <label className={cn('relative block min-w-0', className)}>
      <span className="sr-only">{label}</span>
      <MagnifyingGlassIcon
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        aria-hidden="true"
      />
      <input
        type="search"
        className={cn(cheffingInputClassName, 'pl-9', inputClassName)}
        {...props}
      />
    </label>
  );
}

export function CheffingField({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5 text-sm text-slate-300', className)}>
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function CheffingEmptyState({
  title,
  description,
  colSpan,
}: {
  title: ReactNode;
  description?: ReactNode;
  colSpan: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center">
        <div className="mx-auto max-w-md rounded-xl border border-dashed border-slate-700/80 bg-slate-950/40 px-4 py-5">
          <p className="text-sm font-semibold text-slate-200">{title}</p>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
      </td>
    </tr>
  );
}

export function CheffingTableActionLink({
  href,
  tone = 'neutral',
  className,
  children,
}: {
  href: string;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-2',
        buttonToneClassName[tone],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function CheffingTableActionButton({
  tone = 'neutral',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2',
        buttonToneClassName[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
