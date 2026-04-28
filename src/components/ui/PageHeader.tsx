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
        'relative overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900/90 via-slate-950/80 to-slate-950/70 px-5 py-5 shadow-[0_22px_55px_-38px_rgba(2,6,23,0.95)] ring-1 ring-white/[0.03]',
        'md:px-6',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary-300/45 to-transparent"
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-200">
              {eyebrow}
            </div>
          ) : null}
          <div>
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-normal text-white md:text-3xl">
              {title}
            </h1>
            {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p> : null}
          </div>
          {meta ? <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">{meta}</div> : null}
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 pt-1">{actions}</div> : null}
      </div>
    </header>
  );
}
