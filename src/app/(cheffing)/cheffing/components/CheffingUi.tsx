import type { ButtonHTMLAttributes, ComponentPropsWithoutRef, ReactNode } from 'react';
import Link from 'next/link';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

import { cn } from '@/components/ui';

type Tone = 'primary' | 'success' | 'neutral' | 'danger' | 'muted';

const buttonToneClassName: Record<Tone, string> = {
  primary:
    'border-[#d6a76e]/65 bg-[#c9833f] text-[#160f09] shadow-[0_20px_44px_-30px_rgba(214,143,65,0.95),inset_0_1px_0_rgba(255,235,205,0.28)] hover:border-[#efbf7d] hover:bg-[#dc9c58] focus-visible:ring-[#d6a76e]/40',
  success:
    'border-emerald-400/50 bg-emerald-500/10 text-emerald-100 hover:border-emerald-300 hover:bg-emerald-500/20 focus-visible:ring-emerald-300/30',
  neutral:
    'border-[#4a3f32]/80 bg-[#151412]/90 text-[#efe8dc] hover:border-[#8b6a43]/75 hover:bg-[#211f1b] hover:text-[#ffe2b6] focus-visible:ring-[#d6a76e]/30',
  danger:
    'border-rose-500/50 bg-rose-500/10 text-rose-200 hover:border-rose-400 hover:bg-rose-500/15 hover:text-rose-100 focus-visible:ring-rose-300/25',
  muted:
    'border-[#3c342a]/80 bg-[#12110f]/70 text-[#a99d90] hover:border-[#5b5146]/80 hover:text-[#d8cfc2] focus-visible:ring-[#d6a76e]/20',
};

export const cheffingInputClassName =
  'h-10 w-full rounded-xl border border-[#4a3f32]/80 bg-[#12110f]/90 px-3 text-sm text-[#f4ede3] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition-colors duration-150 placeholder:text-[#7c7266] hover:border-[#6f5434]/80 focus:border-[#d6a76e]/80 focus:ring-2 focus:ring-[#d6a76e]/15';

export const cheffingSelectClassName =
  'h-10 w-full rounded-xl border border-[#4a3f32]/80 bg-[#12110f]/90 px-3 text-sm text-[#f4ede3] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition-colors duration-150 hover:border-[#6f5434]/80 focus:border-[#d6a76e]/80 focus:ring-2 focus:ring-[#d6a76e]/15';

export const cheffingTableClassName = 'w-full text-left text-sm text-[#d8cfc2]';

export const cheffingTheadClassName =
  'bg-[#12110f]/85 text-[11px] uppercase tracking-wide text-[#a99d90]';

export const cheffingHeaderButtonClassName =
  'inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 font-semibold text-[#d8cfc2] transition-colors duration-150 hover:bg-[#25221d]/80 hover:text-[#ffe2b6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a76e]/25';

export const cheffingRowClassName =
  'border-t border-[#3c342a]/70 transition-colors duration-150 hover:bg-[#211f1b]/60';

export const cheffingEditingRowClassName = 'bg-[#3a2a1b]/45 hover:bg-[#3a2a1b]/55';

export const cheffingNumericClassName = 'tabular-nums text-[#f6f0e8]';

export const cheffingMobileListClassName = 'space-y-3 p-3 md:hidden';

export const cheffingMobileCardClassName =
  'rounded-xl border border-[#3c342a]/80 bg-[#12110f]/72 p-3.5 shadow-[0_16px_36px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.025]';

export const cheffingMobileCardEditingClassName =
  'border-[#d6a76e]/55 bg-[#2a2016]/70 shadow-[inset_3px_0_0_rgba(214,167,110,0.55)]';

export const cheffingMobileMetaGridClassName = 'mt-3 grid grid-cols-2 gap-2';

export function CheffingMobileMeta({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 rounded-lg border border-[#3c342a]/65 bg-[#171512]/80 px-3 py-2', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8f8173]">{label}</p>
      <div className="mt-1 min-w-0 break-words text-sm font-semibold text-[#f6f0e8]">{value}</div>
    </div>
  );
}

export function CheffingButton({
  tone = 'neutral',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold shadow-lg transition duration-150 hover:-translate-y-0.5 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2',
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
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold shadow-lg transition duration-150 hover:-translate-y-0.5 active:translate-y-px focus-visible:outline-none focus-visible:ring-2',
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
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f8173]"
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
    <label className={cn('block space-y-1.5 text-sm text-[#d8cfc2]', className)}>
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8f8173]">
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
        <div className="mx-auto max-w-md rounded-xl border border-dashed border-[#5b5146]/80 bg-[#12110f]/55 px-4 py-5 ring-1 ring-white/[0.025]">
          <p className="text-sm font-semibold text-[#efe8dc]">{title}</p>
          {description ? <p className="mt-1 text-sm text-[#8f8173]">{description}</p> : null}
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
