import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import type { Subrecipe, Unit } from '@/lib/cheffing/types';

import { SubrecipesManager } from './SubrecipesManager';

type SubrecipeCost = Subrecipe & {
  output_unit_dimension: string | null;
  output_unit_factor: number | null;
  items_cost_total: number | null;
  cost_gross_per_base: number | null;
  cost_net_per_base: number | null;
  waste_factor: number | null;
};

export default async function CheffingElaboracionesPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const { data: subrecipes, error: subrecipesError } = await supabase
    .from('v_cheffing_subrecipe_cost')
    .select(
      'id, name, output_unit_code, output_qty, waste_pct, created_at, updated_at, output_unit_dimension, output_unit_factor, items_cost_total, cost_gross_per_base, cost_net_per_base, waste_factor',
    )
    .order('name', { ascending: true });
  const { data: units, error: unitsError } = await supabase
    .from('cheffing_units')
    .select('code, name, dimension, to_base_factor')
    .order('dimension', { ascending: true })
    .order('to_base_factor', { ascending: true });

  if (subrecipesError || unitsError) {
    console.error('[cheffing/elaboraciones] Failed to load subrecipes', subrecipesError ?? unitsError);
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Elaboraciones</h2>
        <p className="text-sm text-slate-400">
          Define producciones internas, merma y coste base por unidad para reutilizarlas en platos.
        </p>
      </header>

      <SubrecipesManager
        initialSubrecipes={(subrecipes ?? []) as SubrecipeCost[]}
        units={(units ?? []) as Unit[]}
      />
    </section>
  );
}
