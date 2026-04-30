import type { ComponentType, ReactNode, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type OperationalPageProps = {
  children: ReactNode;
  className?: string;
};

type OperationalPageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
};

type OperationalPanelProps = {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'article' | 'div';
};

type OperationalSectionHeaderProps = {
  icon?: IconComponent;
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
};

type OperationalEmptyStateProps = {
  icon: IconComponent;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: 'neutral' | 'warning';
  className?: string;
};

type OperationalFeatureCardProps = {
  icon: IconComponent;
  title: ReactNode;
  description: ReactNode;
  badge?: ReactNode;
  footer?: ReactNode;
  highlighted?: boolean;
};

type OperationalMetricCardProps = {
  icon: IconComponent;
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export const operationalButtonClass =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#6f4d2a]/80 bg-[#2a1e16]/88 px-4 py-2.5 text-sm font-semibold text-[#f3c98d] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_42px_-34px_rgba(197,128,55,0.95)] transition duration-200 hover:-translate-y-0.5 hover:border-[#bd8145]/80 hover:bg-[#3a2618] hover:text-[#ffe2b6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a76e]/35 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0';

export const operationalPrimaryButtonClass =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#d6a76e]/65 bg-[#c9833f] px-4 py-2.5 text-sm font-bold text-[#160f09] shadow-[0_20px_44px_-30px_rgba(214,143,65,0.95),inset_0_1px_0_rgba(255,235,205,0.28)] transition duration-200 hover:-translate-y-0.5 hover:border-[#efbf7d] hover:bg-[#dc9c58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a76e]/40 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0';

export const operationalSecondaryButtonClass =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#4a3f32]/80 bg-[#151412]/90 px-4 py-2.5 text-sm font-semibold text-[#efe8dc] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#8b6a43]/75 hover:bg-[#211f1b] hover:text-[#ffe2b6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a76e]/30 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0';

export const operationalFieldClass =
  'w-full rounded-xl border border-[#4a3f32]/80 bg-[#12110f]/90 px-3.5 py-2.5 text-sm text-[#f4ede3] placeholder:text-[#7c7266] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition focus:border-[#d6a76e]/80 focus:outline-none focus:ring-2 focus:ring-[#d6a76e]/15 disabled:cursor-not-allowed disabled:opacity-70';

export const operationalLabelClass = 'space-y-2 text-sm text-[#d8cfc2]';

export function OperationalChromeStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          body:has(.operational-warm-page) {
            background: #11100e;
          }

          .aforo-standalone-shell:has(.operational-warm-page) {
            max-width: none;
            gap: 0;
            padding: 0;
            background:
              radial-gradient(circle at 18% 0%, rgba(156, 117, 70, 0.10), transparent 26rem),
              linear-gradient(135deg, #171614 0%, #11100e 52%, #0f0e0d 100%);
          }

          .aforo-standalone-shell:has(.operational-warm-page) > aside {
            width: 18.5rem;
            border-right: 1px solid rgba(120, 103, 82, 0.30);
            background: linear-gradient(180deg, rgba(29, 28, 25, 0.98), rgba(20, 19, 17, 0.98));
          }

          .aforo-standalone-shell:has(.operational-warm-page) > aside > div {
            top: 0;
            min-height: 100dvh;
            padding: 1rem;
          }

          .aforo-standalone-shell:has(.operational-warm-page) > div {
            min-width: 0;
            gap: 0;
          }

          .aforo-standalone-shell:has(.operational-warm-page) > div > header {
            position: relative;
            overflow: hidden;
            margin: 1rem 1rem 0;
            border-color: rgba(120, 103, 82, 0.34);
            background:
              radial-gradient(circle at 58% 100%, rgba(181, 112, 48, 0.16), transparent 16rem),
              linear-gradient(135deg, rgba(35, 31, 27, 0.92), rgba(18, 17, 15, 0.90) 52%, rgba(16, 18, 18, 0.92));
            box-shadow: 0 28px 80px -58px rgba(0, 0, 0, 0.95), inset 0 1px 0 rgba(255,255,255,0.04);
          }

          .aforo-standalone-shell:has(.operational-warm-page) > div > header::before {
            content: "";
            position: absolute;
            inset: 0 18% auto 36%;
            height: 100%;
            pointer-events: none;
            opacity: 0.28;
            background:
              linear-gradient(120deg, transparent 0 44%, rgba(164, 101, 41, 0.22) 45%, transparent 46%),
              repeating-linear-gradient(132deg, transparent 0 18px, rgba(194, 128, 66, 0.12) 19px, transparent 20px);
            mask-image: radial-gradient(circle at 50% 100%, #000 0, transparent 68%);
          }

          .aforo-standalone-shell:has(.operational-warm-page) footer {
            margin: 0 1rem;
            border-color: rgba(120, 103, 82, 0.30);
            color: rgba(170, 157, 139, 0.55);
          }

          .aforo-standalone-shell:has(.operational-warm-page) nav > div {
            border-color: rgba(120, 103, 82, 0.22);
            background: transparent;
            box-shadow: none;
          }

          .aforo-standalone-shell:has(.operational-warm-page) nav button {
            background: rgba(28, 27, 24, 0.62);
            color: #efe8dc;
          }

          .aforo-standalone-shell:has(.operational-warm-page) nav button:hover {
            background: rgba(39, 35, 30, 0.88);
          }

          .aforo-standalone-shell:has(.operational-warm-page) nav a[aria-current="page"] {
            background: rgba(150, 112, 66, 0.22);
            color: #f1c98f;
            box-shadow: inset 0 0 0 1px rgba(194, 144, 82, 0.20);
          }

          .aforo-standalone-shell:has(.operational-warm-page) nav a:not([aria-current="page"]):hover {
            background: rgba(42, 38, 32, 0.88);
            color: #f6f0e8;
          }

          .aforo-standalone-shell:has(.operational-warm-page) a {
            color: inherit;
          }

          .operational-warm-page .operational-surface {
            border-color: rgba(86, 72, 56, 0.76) !important;
            background:
              radial-gradient(circle at 0% 0%, rgba(145, 93, 45, 0.12), transparent 18rem),
              linear-gradient(135deg, rgba(29, 27, 23, 0.98), rgba(23, 21, 18, 0.98) 54%, rgba(16, 15, 13, 0.99)) !important;
            box-shadow:
              0 24px 80px -58px rgba(0, 0, 0, 0.96),
              inset 0 1px 0 rgba(255, 255, 255, 0.045) !important;
          }

          .operational-warm-page .operational-surface.is-highlighted {
            border-color: rgba(188, 126, 61, 0.68) !important;
            background:
              radial-gradient(circle at 0% 0%, rgba(183, 112, 50, 0.18), transparent 16rem),
              linear-gradient(135deg, rgba(43, 33, 24, 0.98), rgba(27, 23, 18, 0.98) 55%, rgba(18, 16, 14, 0.99)) !important;
          }

          .operational-warm-page .operational-inset {
            border-color: rgba(66, 56, 44, 0.84) !important;
            background:
              linear-gradient(135deg, rgba(18, 17, 15, 0.96), rgba(13, 12, 11, 0.98)) !important;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025) !important;
          }

          .operational-warm-page .operational-soft {
            border-color: rgba(74, 63, 50, 0.78) !important;
            background: rgba(21, 20, 18, 0.84) !important;
          }

          @media (max-width: 1023px) {
            .aforo-standalone-shell:has(.operational-warm-page) {
              min-height: 100dvh;
            }

            .aforo-standalone-shell:has(.operational-warm-page) > div > header {
              margin: 0;
              border-radius: 0;
              border-width: 0 0 1px 0;
            }
          }
        `,
      }}
    />
  );
}

export function OperationalPage({ children, className }: OperationalPageProps) {
  return (
    <div
      className={classNames(
        'operational-warm-page min-h-[calc(100dvh-4.5rem)] space-y-6 bg-[#12110f] px-4 py-6 text-[#efe8dc] md:px-6 lg:px-8',
        className,
      )}
    >
      <OperationalChromeStyles />
      {children}
    </div>
  );
}

export function OperationalPageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
}: OperationalPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#d69c57]">{eyebrow}</p>
        ) : null}
        <h1 className="text-[2rem] font-semibold leading-tight tracking-normal text-[#f6f0e8] md:text-[2.35rem]">
          {title}
        </h1>
        {description ? <p className="mt-2 max-w-4xl text-base leading-7 text-[#b9aea1]">{description}</p> : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#a99d90]">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function OperationalPanel({ children, className, as: Component = 'section' }: OperationalPanelProps) {
  return (
    <Component
      className={classNames(
        'operational-surface relative overflow-hidden rounded-2xl border border-[#4a3f32]/70 bg-[#181715] shadow-[0_24px_80px_-58px_rgba(0,0,0,0.96),inset_0_1px_0_rgba(255,255,255,0.04)]',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#d6a76e]/30 to-transparent"
      />
      {children}
    </Component>
  );
}

export function OperationalSectionHeader({ icon: Icon, title, meta, children }: OperationalSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#6f5434]/70 bg-[#3a2a1b]/70 text-[#e0aa69] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <Icon className="h-5 w-5 stroke-[1.7]" aria-hidden="true" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-tight text-[#f6f0e8]">{title}</h2>
          {children ? <div className="mt-1 text-sm leading-6 text-[#a99d90]">{children}</div> : null}
        </div>
      </div>
      {meta ? <div className="shrink-0 text-sm text-[#a99d90]">{meta}</div> : null}
    </div>
  );
}

export function OperationalEmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'neutral',
  className,
}: OperationalEmptyStateProps) {
  const iconTone =
    tone === 'warning'
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
      : 'border-[#7d5932]/45 bg-[#3a2d20]/60 text-[#e0aa69]';

  return (
    <div
      className={classNames(
        'operational-inset flex min-h-[18rem] flex-col items-center justify-center rounded-2xl border border-[#3c342a]/70 bg-[#12110f]/60 px-5 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]',
        className,
      )}
    >
      <div className={classNames('relative flex h-20 w-20 items-center justify-center rounded-full border', iconTone)}>
        <Icon className="h-9 w-9 stroke-[1.45]" aria-hidden="true" />
        <span className="absolute -left-3 top-7 h-1 w-1 rounded-full bg-[#d69c57]/70" aria-hidden="true" />
        <span className="absolute -right-4 top-4 h-1.5 w-1.5 rounded-full bg-[#d69c57]/60" aria-hidden="true" />
        <span className="absolute bottom-4 right-0 h-1 w-1 rounded-full bg-[#d69c57]/55" aria-hidden="true" />
      </div>
      <h3 className="mt-6 text-2xl font-semibold leading-tight text-[#f6f0e8]">{title}</h3>
      {description ? <p className="mt-3 max-w-md text-sm leading-6 text-[#b9aea1]">{description}</p> : null}
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}

export function OperationalFeatureCard({
  icon: Icon,
  title,
  description,
  badge,
  footer,
  highlighted = false,
}: OperationalFeatureCardProps) {
  return (
    <OperationalPanel
      as="article"
      className={classNames(
        'flex min-h-[13rem] flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#8b6a43]/75',
        highlighted && 'is-highlighted border-[#c98545]/75',
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#6f5434]/70 bg-[#3a2a1b]/70 text-[#e0aa69]">
          <Icon className="h-6 w-6 stroke-[1.7]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold leading-tight text-[#f6f0e8]">{title}</h3>
            {badge ? <OperationalPill tone="accent">{badge}</OperationalPill> : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-[#b9aea1]">{description}</p>
        </div>
      </div>
      {footer ? <div className="mt-auto pt-5 text-sm text-[#d69c57]">{footer}</div> : null}
    </OperationalPanel>
  );
}

export function OperationalMetricCard({ icon: Icon, label, value, description }: OperationalMetricCardProps) {
  return (
    <OperationalPanel as="article" className="p-4">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#6f5434]/70 bg-[#3a2a1b]/70 text-[#e0aa69]">
          <Icon className="h-5 w-5 stroke-[1.8]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#d8cfc2]">{label}</p>
          <p className="mt-2 text-3xl font-semibold leading-none text-[#f6f0e8] tabular-nums">{value}</p>
          {description ? <p className="mt-2 text-sm text-[#9d9285]">{description}</p> : null}
        </div>
      </div>
    </OperationalPanel>
  );
}

export function OperationalPill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
  className?: string;
}) {
  const toneClass = {
    neutral: 'border-[#5b5146]/80 bg-[#25221d]/80 text-[#d8cfc2]',
    accent: 'border-[#b77b3e]/35 bg-[#7d5932]/30 text-[#f1c98f]',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    danger: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    info: 'border-[#7b684f]/50 bg-[#26221b]/80 text-[#d8cfc2]',
    muted: 'border-[#4a3f32]/70 bg-[#151412]/70 text-[#a99d90]',
  }[tone];

  return (
    <span
      className={classNames(
        'inline-flex h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-3 text-xs font-semibold leading-none',
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function OperationalQuickNotes({
  items,
  action,
}: {
  items: string[];
  action?: ReactNode;
}) {
  return (
    <OperationalPanel className="p-5 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[#f6f0e8]">Notas rápidas</h2>
        <OperationalPill tone="muted">Borrador</OperationalPill>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-[#d8cfc2]">
        {items.map((item) => (
          <li
            key={item}
            className="operational-soft flex gap-3 rounded-xl border border-[#3c342a]/70 bg-[#151412]/70 px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"
          >
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d69c57]" aria-hidden="true" />
            <span className="leading-6 text-[#e8dfd2]">{item}</span>
          </li>
        ))}
      </ul>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </OperationalPanel>
  );
}

export function OperationalQuickActions() {
  return (
    <OperationalPanel className="p-5">
      <h2 className="text-xl font-semibold text-[#f6f0e8]">Acciones rápidas</h2>
      <p className="mt-3 text-sm leading-6 text-[#b9aea1]">
        Añade recordatorios breves para el equipo. Este espacio se conectará con datos reales en la siguiente iteración.
      </p>
      <div className="mt-5 space-y-3 text-sm">
        <p className="rounded-xl border border-[#8b5a2b]/55 bg-[#7d3f18]/25 px-4 py-3 font-semibold text-[#f2bf7a]">
          Marca tareas críticas como atendidas.
        </p>
        <p className="rounded-xl border border-[#4a3f32]/75 bg-[#151412]/70 px-4 py-3 text-[#d8cfc2]">
          Comparte notas operativas con otros turnos.
        </p>
      </div>
    </OperationalPanel>
  );
}
