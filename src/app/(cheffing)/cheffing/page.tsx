import Link from 'next/link';

const modules = [
  {
    title: 'Ingredientes',
    description: 'Controla materias primas y fichas técnicas (próximamente).',
    href: '/cheffing/ingredientes',
  },
  {
    title: 'Recetas',
    description: 'Gestiona recetas, escandallos y costes (próximamente).',
    href: '/cheffing/recetas',
  },
  {
    title: 'Menús',
    description: 'Planifica menús y servicios semanales (próximamente).',
    href: '/cheffing/menus',
  },
];

export default function CheffingPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 text-sm text-slate-200">
        <p>
          Este módulo centraliza toda la gestión de cocina: ingredientes, recetas, escandallos y
          menús.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
