import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';

import { DishNewForm } from '../DishNewForm';

export default async function CheffingPlatosNewPage() {
  await requireCheffingAccess();

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Nuevo plato</h2>
        <p className="text-sm text-slate-400">
          Crea platos finales y define el PVP para evaluar el margen.
        </p>
      </header>

      <DishNewForm />
    </section>
  );
}
