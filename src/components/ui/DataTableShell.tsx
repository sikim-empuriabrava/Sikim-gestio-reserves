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
        'overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-lg shadow-slate-950/20',
        className,
      )}
    >
      {title || description || toolbar ? (
        <div className="space-y-4 border-b border-slate-800/70 p-4 md:p-5">
          {title || description ? (
            <div className="space-y-1">
              {title ? <h2 className="text-base font-semibold text-white">{title}</h2> : null}
              {description ? <p className="text-sm text-slate-400">{description}</p> : null}
            </div>
          ) : null}
          {toolbar}
        </div>
      ) : null}

      <div className={cn('overflow-x-auto', tableClassName)}>{children}</div>

      {footer ? (
        <div className="border-t border-slate-800/70 bg-slate-950/30 px-4 py-3 text-sm text-slate-400 md:px-5">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
