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
    tone: 'text-[#f1c98f] bg-[#7d5932]/30 ring-[#b77b3e]/35',
  },
  {
    title: 'Elaboraciones',
    description: 'Producciones internas, merma y coste base.',
    href: '/cheffing/elaboraciones',
    icon: BeakerIcon,
    tone: 'text-emerald-200 bg-emerald-500/10 ring-emerald-500/30',
  },
  {
    title: 'Platos',
    description: 'Platos finales, escandallo y coste por ración.',
    href: '/cheffing/platos',
    icon: RectangleStackIcon,
    tone: 'text-[#d8cfc2] bg-[#25221d]/80 ring-[#5b5146]/80',
  },
  {
    title: 'Bebidas',
    description: 'Bebidas finales y familias de carta.',
    href: '/cheffing/bebidas',
    icon: ShoppingBagIcon,
    tone: 'text-[#e0aa69] bg-[#3a2a1b]/70 ring-[#6f5434]/70',
  },
  {
    title: 'Menús',
    description: 'Consumo por persona, coste y margen conservador.',
    href: '/cheffing/menus',
    icon: ClipboardDocumentListIcon,
    tone: 'text-amber-200 bg-amber-500/10 ring-amber-500/30',
  },
  {
    title: 'Carta',
    description: 'Colecciones comerciales de platos y bebidas.',
    href: '/cheffing/carta',
    icon: DocumentTextIcon,
    tone: 'text-rose-200 bg-rose-500/10 ring-rose-500/30',
  },
  {
    title: 'Compras',
    description: 'Documentos, borradores y revisión operativa.',
    href: '/cheffing/compras',
    icon: ShoppingBagIcon,
    tone: 'text-emerald-200 bg-emerald-500/10 ring-emerald-500/30',
  },
  {
    title: 'Proveedores',
    description: 'Base manual de proveedores de compra.',
    href: '/cheffing/proveedores',
    icon: TruckIcon,
    tone: 'text-[#d8cfc2] bg-[#25221d]/80 ring-[#5b5146]/80',
  },
  {
    title: 'Menu Engineering',
    description: 'Rentabilidad, popularidad y lectura BCM.',
    href: '/cheffing/menu-engineering',
    icon: ChartBarSquareIcon,
    tone: 'text-[#f1c98f] bg-[#7d5932]/30 ring-[#b77b3e]/35',
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
              className="group relative overflow-hidden rounded-2xl border border-[#4a3f32]/70 bg-[#181715] p-5 shadow-[0_24px_80px_-58px_rgba(0,0,0,0.96),inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-[#d6a76e]/10 transition duration-200 hover:-translate-y-0.5 hover:border-[#8b6a43]/75 hover:bg-[#211f1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a76e]/30 active:translate-y-px"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#d6a76e]/25 to-transparent"
              />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-[#f6f0e8] transition-colors group-hover:text-[#f1c98f]">
                    {module.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#b9aea1]">{module.description}</p>
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
