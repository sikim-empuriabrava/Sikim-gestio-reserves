import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import type { Dish } from '@/lib/cheffing/types';

import { DishesManager } from './DishesManager';

type DishCost = Dish & {
  items_cost_total: number | null;
};

export default async function CheffingPlatosPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const { data: dishes, error: dishesError } = await supabase
    .from('v_cheffing_dish_cost')
    .select('id, name, selling_price, created_at, updated_at, items_cost_total')
    .order('name', { ascending: true });

  if (dishesError) {
    console.error('[cheffing/platos] Failed to load dishes', dishesError);
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Platos</h2>
        <p className="text-sm text-slate-400">
          Organiza los platos finales y calcula el coste total a partir de ingredientes y elaboraciones.
        </p>
      </header>

      <DishesManager initialDishes={(dishes ?? []) as DishCost[]} />
    </section>
  );
}
