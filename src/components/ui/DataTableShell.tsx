import type { ReactNode } from 'react';

import { cn } from './utils';

type DataTableShellProps = {
  title?: ReactNode;
  description?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  tableClassName?: string;
};

export function DataTableShell({
  title,
  description,
  toolbar,
  children,
  footer,
  className,
  tableClassName,
}: DataTableShellProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900/75 via-slate-900/60 to-slate-950/70 shadow-[0_22px_52px_-38px_rgba(2,6,23,0.95)] ring-1 ring-white/[0.035]',
        className,
      )}
    >
      {title || description || toolbar ? (
        <div className="space-y-3.5 border-b border-slate-800/70 bg-slate-950/30 p-4 md:p-5">
          {title || description ? (
            <div className="space-y-1">
              {title ? <h2 className="text-base font-semibold text-white">{title}</h2> : null}
              {description ? <p className="text-sm text-slate-300">{description}</p> : null}
            </div>
          ) : null}
          {toolbar}
        </div>
      ) : null}

      <div className={cn('overflow-x-auto', tableClassName)}>{children}</div>

      {footer ? (
        <div className="border-t border-slate-800/70 bg-slate-950/50 px-4 py-3 text-sm text-slate-400 md:px-5">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
