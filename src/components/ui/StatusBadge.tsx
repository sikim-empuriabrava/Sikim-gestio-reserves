import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from './utils';

type StatusBadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'muted';

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: StatusBadgeTone;
};

const toneClassName: Record<StatusBadgeTone, string> = {
  neutral: 'border-stone-700 bg-stone-800/70 text-stone-200',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  danger: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  info: 'border-stone-500/30 bg-stone-500/10 text-stone-200',
  accent: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  muted: 'border-stone-800 bg-stone-950/50 text-stone-400',
};

export function StatusBadge({ children, tone = 'neutral', className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold leading-none shadow-sm shadow-black/15 transition-colors duration-200',
        toneClassName[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
