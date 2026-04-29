import Link from 'next/link';
import {
  BeakerIcon,
  ChartBarSquareIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  DocumentTextIcon,
  RectangleStackIcon,
  ShoppingBagIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

import { PageHeader } from '@/components/ui';

const modules = [
  {
    title: 'Productos',
    description: 'Materias primas, proveedores y fichas técnicas.',
    href: '/cheffing/productos',
    icon: CubeIcon,
    tone: 'text-primary-100 bg-primary-500/10 ring-primary-400/30',
  },
  {
    title: 'Elaboraciones',
    description: 'Producciones internas, merma y coste base.',
    href: '/cheffing/elaboraciones',
    icon: BeakerIcon,
    tone: 'text-emerald-100 bg-emerald-500/10 ring-emerald-400/25',
  },
  {
    title: 'Platos',
    description: 'Platos finales, escandallo y coste por ración.',
    href: '/cheffing/platos',
    icon: RectangleStackIcon,
    tone: 'text-sky-100 bg-sky-500/10 ring-sky-400/25',
  },
  {
    title: 'Bebidas',
    description: 'Bebidas finales y familias de carta.',
    href: '/cheffing/bebidas',
    icon: ShoppingBagIcon,
    tone: 'text-cyan-100 bg-cyan-500/10 ring-cyan-400/25',
  },
  {
    title: 'Menús',
    description: 'Consumo por persona, coste y margen conservador.',
    href: '/cheffing/menus',
    icon: ClipboardDocumentListIcon,
    tone: 'text-amber-100 bg-amber-500/10 ring-amber-400/25',
  },
  {
    title: 'Carta',
    description: 'Colecciones comerciales de platos y bebidas.',
    href: '/cheffing/carta',
    icon: DocumentTextIcon,
    tone: 'text-rose-100 bg-rose-500/10 ring-rose-400/25',
  },
  {
    title: 'Compras',
    description: 'Documentos, borradores y revisión operativa.',
    href: '/cheffing/compras',
    icon: ShoppingBagIcon,
    tone: 'text-emerald-100 bg-emerald-500/10 ring-emerald-400/25',
  },
  {
    title: 'Proveedores',
    description: 'Base manual de proveedores de compra.',
    href: '/cheffing/proveedores',
    icon: TruckIcon,
    tone: 'text-slate-100 bg-slate-800/80 ring-slate-700',
  },
  {
    title: 'Menu Engineering',
    description: 'Rentabilidad, popularidad y lectura BCM.',
    href: '/cheffing/menu-engineering',
    icon: ChartBarSquareIcon,
    tone: 'text-primary-100 bg-primary-500/10 ring-primary-400/30',
  },
];

export default function CheffingPage() {
  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Cheffing"
        title="Operativa de cocina"
        description="Accesos principales para costes, carta, compras y análisis de margen."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;

          return (
            <Link
              key={module.title}
              href={module.href}
              className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5 shadow-[0_18px_42px_-34px_rgba(2,6,23,0.95)] ring-1 ring-white/[0.03] transition duration-200 hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/25 active:translate-y-px"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
              />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white transition-colors group-hover:text-primary-100">
                    {module.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{module.description}</p>
                </div>
                <span className={`rounded-xl p-2.5 ring-1 ${module.tone}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
