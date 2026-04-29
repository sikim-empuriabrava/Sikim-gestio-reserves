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
    'border-stone-700/70 bg-gradient-to-br from-[#1f1d19]/85 via-[#181612]/80 to-[#11100e]/85 shadow-[0_20px_48px_-38px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.025]',
  inset: 'border-stone-800/80 bg-stone-950/55 shadow-inner shadow-black/30 ring-1 ring-white/[0.018]',
  muted: 'border-stone-800/70 bg-stone-900/45 ring-1 ring-white/[0.02]',
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
        'rounded-2xl border transition-colors duration-200',
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
