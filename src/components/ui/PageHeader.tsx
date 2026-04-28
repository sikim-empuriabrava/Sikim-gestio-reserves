import type { ReactNode } from 'react';

import { cn } from './utils';

type PageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, actions, meta, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'rounded-2xl border border-slate-800/80 bg-slate-950/70 px-5 py-5 shadow-lg shadow-slate-950/25',
        'md:px-6',
        className,
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow ? (
            <div className="text-xs font-semibold uppercase tracking-wide text-primary-200">{eyebrow}</div>
          ) : null}
          <div>
            <h1 className="text-2xl font-bold tracking-normal text-white md:text-3xl">{title}</h1>
            {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p> : null}
          </div>
          {meta ? <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">{meta}</div> : null}
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
