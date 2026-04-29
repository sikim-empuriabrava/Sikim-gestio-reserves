import type { ReactNode } from 'react';

import { cn } from './utils';

type MetricTone = 'violet' | 'emerald' | 'amber' | 'sky' | 'slate' | 'rose';

type MetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  trend?: ReactNode;
  icon?: ReactNode;
  tone?: MetricTone;
  className?: string;
};

type MetricStripProps = {
  children: ReactNode;
  className?: string;
};

const toneClassName: Record<MetricTone, string> = {
  violet: 'bg-violet-500/10 text-violet-100 ring-violet-400/25 shadow-violet-950/20',
  emerald: 'bg-emerald-500/10 text-emerald-100 ring-emerald-400/25 shadow-emerald-950/20',
  amber: 'bg-amber-500/10 text-amber-100 ring-amber-400/25 shadow-amber-950/20',
  sky: 'bg-stone-500/10 text-stone-100 ring-stone-400/25 shadow-black/15',
  slate: 'bg-stone-800/85 text-stone-100 ring-stone-600/80 shadow-black/20',
  rose: 'bg-rose-500/10 text-rose-100 ring-rose-400/25 shadow-rose-950/20',
};

export function MetricCard({
  label,
  value,
  description,
  trend,
  icon,
  tone = 'amber',
  className,
}: MetricCardProps) {
  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-xl border border-stone-800/75 bg-gradient-to-br from-[#171512]/85 via-[#14120f]/75 to-[#1f1d19]/55 p-3.5 shadow-[0_18px_42px_-36px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.025]',
        'transition duration-200 hover:-translate-y-0.5 hover:border-stone-700/95 hover:bg-stone-900/70',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-amber-100/15 to-transparent opacity-80"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-stone-400">{label}</p>
          <div className="mt-1.5 text-[1.65rem] font-semibold leading-none tracking-normal text-stone-50 tabular-nums">
            {value}
          </div>
        </div>
        {icon ? (
          <div
            className={cn(
              'rounded-xl p-2.5 shadow-lg ring-1 transition-colors duration-200 group-hover:bg-opacity-20',
              toneClassName[tone],
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        ) : null}
      </div>
      {description || trend ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {trend ? <span className="font-semibold text-emerald-300">{trend}</span> : null}
          {description ? <span className="text-stone-500">{description}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

export function MetricStrip({ children, className }: MetricStripProps) {
  return <div className={cn('grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
}
