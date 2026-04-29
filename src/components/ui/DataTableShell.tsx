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
        'overflow-hidden rounded-2xl border border-stone-700/70 bg-gradient-to-br from-[#1f1d19]/85 via-[#181612]/78 to-[#11100e]/85 shadow-[0_22px_52px_-40px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.025]',
        className,
      )}
    >
      {title || description || toolbar ? (
        <div className="space-y-3.5 border-b border-stone-800/75 bg-stone-950/30 p-4 md:p-5">
          {title || description ? (
            <div className="space-y-1">
              {title ? <h2 className="text-base font-semibold text-stone-50">{title}</h2> : null}
              {description ? <p className="text-sm text-stone-300">{description}</p> : null}
            </div>
          ) : null}
          {toolbar}
        </div>
      ) : null}

      <div className={cn('overflow-x-auto', tableClassName)}>{children}</div>

      {footer ? (
        <div className="border-t border-stone-800/75 bg-stone-950/45 px-4 py-3 text-sm text-stone-400 md:px-5">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
