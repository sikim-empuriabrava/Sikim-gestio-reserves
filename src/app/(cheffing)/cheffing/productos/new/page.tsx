import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import type { Unit } from '@/lib/cheffing/types';

import { ProductsNewForm } from '../ProductsNewForm';

export default async function CheffingProductosNewPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const { data: units, error: unitsError } = await supabase
    .from('cheffing_units')
    .select('code, name, dimension, to_base_factor')
    .order('dimension', { ascending: true })
    .order('to_base_factor', { ascending: true });

  if (unitsError) {
    console.error('[cheffing/productos/new] Failed to load units', unitsError);
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Nuevo producto</h2>
        <p className="text-sm text-slate-400">
          Añade productos con su formato de compra para calcular costes netos.
        </p>
      </header>

      <ProductsNewForm units={(units ?? []) as Unit[]} />
    </section>
  );
}
