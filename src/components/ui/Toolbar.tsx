import type { ReactNode } from 'react';

import { cn } from './utils';

type ToolbarProps = {
  leading?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function Toolbar({ leading, filters, actions, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-700/70 bg-slate-950/60 p-3 shadow-inner shadow-slate-950/30 ring-1 ring-white/[0.02]',
        'flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between',
        className,
      )}
    >
      {leading ? <div className="min-w-0">{leading}</div> : null}
      {filters ? <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{filters}</div> : null}
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
