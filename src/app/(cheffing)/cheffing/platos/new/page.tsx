import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import type { Ingredient, Subrecipe, Unit } from '@/lib/cheffing/types';

import { DishNewForm } from '../DishNewForm';

export default async function CheffingPlatosNewPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const { data: ingredients, error: ingredientsError } = await supabase
    .from('cheffing_ingredients')
    .select('id, name, purchase_unit_code, purchase_pack_qty, purchase_price, waste_pct, created_at, updated_at')
    .order('name', { ascending: true });
  const { data: subrecipes, error: subrecipesError } = await supabase
    .from('cheffing_subrecipes')
    .select('id, name, output_unit_code, output_qty, waste_pct, notes, created_at, updated_at')
    .order('name', { ascending: true });
  const { data: units, error: unitsError } = await supabase
    .from('cheffing_units')
    .select('code, name, dimension, to_base_factor')
    .order('dimension', { ascending: true })
    .order('to_base_factor', { ascending: true });

  if (ingredientsError || subrecipesError || unitsError) {
    console.error(
      '[cheffing/platos/new] Failed to load data',
      ingredientsError ?? subrecipesError ?? unitsError,
    );
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Nuevo plato</h2>
        <p className="text-sm text-slate-400">
          Crea platos finales y define el PVP para evaluar el margen.
        </p>
      </header>

      <DishNewForm
        ingredients={(ingredients ?? []) as Ingredient[]}
        subrecipes={(subrecipes ?? []) as Subrecipe[]}
        units={(units ?? []) as Unit[]}
      />
    </section>
  );
}
