import Link from 'next/link';

const modules = [
  {
    title: 'Productos',
    description: 'Controla materias primas, proveedores y fichas técnicas.',
    href: '/cheffing/productos',
  },
  {
    title: 'Elaboraciones',
    description: 'Crea elaboraciones internas con productos y merma.',
    href: '/cheffing/elaboraciones',
  },
  {
    title: 'Platos',
    description: 'Define platos finales y añade sus líneas de coste.',
    href: '/cheffing/platos',
  },
  {
    title: 'Menús',
    description: 'Planifica menús y consumo por persona con multiplicadores.',
    href: '/cheffing/menus',
  },
  {
    title: 'Carta',
    description: 'Construye cartas consumidoras de platos y bebidas canónicas.',
    href: '/cheffing/carta',
  },
];

export default function CheffingPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 text-sm text-slate-200">
        <p>
          Este módulo centraliza toda la gestión de cocina: productos, escandallos y menús.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <Link
            key={module.title}
            href={module.href}
            className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 transition hover:border-slate-600"
          >
            <h2 className="text-lg font-semibold text-white">{module.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{module.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
