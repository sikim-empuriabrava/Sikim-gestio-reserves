import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from './utils';

type SurfaceElement = 'div' | 'section' | 'article';
type SurfaceTone = 'panel' | 'inset' | 'muted';
type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: SurfaceElement;
  children: ReactNode;
  padding?: SurfacePadding;
  tone?: SurfaceTone;
};

const toneClassName: Record<SurfaceTone, string> = {
  panel:
    'border-slate-700/70 bg-gradient-to-br from-slate-900/75 via-slate-900/60 to-slate-950/70 shadow-[0_20px_48px_-36px_rgba(2,6,23,0.95)] ring-1 ring-white/[0.035]',
  inset: 'border-slate-800/80 bg-slate-950/60 shadow-inner shadow-slate-950/30 ring-1 ring-white/[0.02]',
  muted: 'border-slate-800/70 bg-slate-900/50 ring-1 ring-white/[0.025]',
};

const paddingClassName: Record<SurfacePadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 md:p-6',
  lg: 'p-6 md:p-7',
};

export function Surface({
  as: Component = 'section',
  children,
  className,
  padding = 'md',
  tone = 'panel',
  ...props
}: SurfaceProps) {
  return (
    <Component
      className={cn(
        'rounded-2xl border backdrop-blur transition-colors duration-200',
        toneClassName[tone],
        paddingClassName[padding],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
