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
  violet: 'bg-primary-500/10 text-primary-100 ring-primary-400/30 shadow-primary-950/20',
  emerald: 'bg-emerald-500/10 text-emerald-100 ring-emerald-400/25 shadow-emerald-950/20',
  amber: 'bg-amber-500/10 text-amber-100 ring-amber-400/25 shadow-amber-950/20',
  sky: 'bg-sky-500/10 text-sky-100 ring-sky-400/25 shadow-sky-950/20',
  slate: 'bg-slate-800/85 text-slate-100 ring-slate-600/80 shadow-slate-950/20',
  rose: 'bg-rose-500/10 text-rose-100 ring-rose-400/25 shadow-rose-950/20',
};

export function MetricCard({
  label,
  value,
  description,
  trend,
  icon,
  tone = 'violet',
  className,
}: MetricCardProps) {
  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-xl border border-slate-800/75 bg-gradient-to-br from-slate-950/80 via-slate-950/60 to-slate-900/50 p-3.5 shadow-[0_18px_42px_-34px_rgba(2,6,23,0.95)] ring-1 ring-white/[0.035]',
        'transition duration-200 hover:-translate-y-0.5 hover:border-slate-700/95 hover:bg-slate-900/70',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-70"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-slate-400">{label}</p>
          <div className="mt-1.5 text-[1.65rem] font-semibold leading-none tracking-normal text-white tabular-nums">
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
          {description ? <span className="text-slate-500">{description}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

export function MetricStrip({ children, className }: MetricStripProps) {
  return <div className={cn('grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
}
