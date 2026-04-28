import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from './utils';

type StatusBadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'muted';

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: StatusBadgeTone;
};

const toneClassName: Record<StatusBadgeTone, string> = {
  neutral: 'border-slate-700 bg-slate-800/70 text-slate-200',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  danger: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  accent: 'border-primary-500/30 bg-primary-500/10 text-primary-100',
  muted: 'border-slate-800 bg-slate-950/50 text-slate-400',
};

export function StatusBadge({ children, tone = 'neutral', className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none',
        toneClassName[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
