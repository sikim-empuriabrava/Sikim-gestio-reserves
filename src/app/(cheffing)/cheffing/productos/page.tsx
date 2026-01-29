import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import type { IngredientCost, Unit } from '@/lib/cheffing/types';

import { ProductsManager } from './ProductsManager';

export default async function CheffingProductosPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const { data: ingredients, error: ingredientsError } = await supabase
    .from('v_cheffing_ingredients_cost')
    .select(
      'id, name, purchase_unit_code, purchase_pack_qty, purchase_price, waste_pct, created_at, updated_at, purchase_unit_dimension, purchase_unit_factor, cost_gross_per_base, cost_net_per_base, waste_factor',
    )
    .order('name', { ascending: true });
  const { data: units, error: unitsError } = await supabase
    .from('cheffing_units')
    .select('code, name, dimension, to_base_factor')
    .order('dimension', { ascending: true })
    .order('to_base_factor', { ascending: true });

  if (ingredientsError || unitsError) {
    console.error('[cheffing/productos] Failed to load products', ingredientsError ?? unitsError);
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Productos</h2>
        <p className="text-sm text-slate-400">
          Gestiona los productos que compras a proveedores y calcula sus costes unitarios.
        </p>
      </header>

      <ProductsManager
        initialIngredients={(ingredients ?? []) as IngredientCost[]}
        units={(units ?? []) as Unit[]}
      />
    </section>
  );
}
