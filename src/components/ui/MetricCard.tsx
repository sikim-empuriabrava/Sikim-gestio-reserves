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
  violet: 'bg-primary-500/10 text-primary-100 ring-primary-500/30',
  emerald: 'bg-emerald-500/10 text-emerald-100 ring-emerald-500/25',
  amber: 'bg-amber-500/10 text-amber-100 ring-amber-500/25',
  sky: 'bg-sky-500/10 text-sky-100 ring-sky-500/25',
  slate: 'bg-slate-800/80 text-slate-100 ring-slate-700',
  rose: 'bg-rose-500/10 text-rose-100 ring-rose-500/25',
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
        'rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4 shadow-lg shadow-slate-950/20',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <div className="mt-2 text-2xl font-semibold tracking-normal text-white">{value}</div>
        </div>
        {icon ? (
          <div className={cn('rounded-xl p-2.5 ring-1', toneClassName[tone])} aria-hidden="true">
            {icon}
          </div>
        ) : null}
      </div>
      {description || trend ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {trend ? <span className="font-semibold text-emerald-300">{trend}</span> : null}
          {description ? <span className="text-slate-500">{description}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

export function MetricStrip({ children, className }: MetricStripProps) {
  return <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>;
}
