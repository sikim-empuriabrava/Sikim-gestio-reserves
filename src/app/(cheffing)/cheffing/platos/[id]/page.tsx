import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import type { Ingredient, Subrecipe, Unit } from '@/lib/cheffing/types';

import {
  DishDetailManager,
  type DishCost,
  type DishItemWithDetails,
} from './DishDetailManager';

export default async function CheffingPlatoDetailPage({ params }: { params: { id: string } }) {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const { data: dish, error: dishError } = await supabase
    .from('v_cheffing_dish_cost')
    .select('id, name, selling_price, servings, notes, created_at, updated_at, items_cost_total, cost_per_serving')
    .eq('id', params.id)
    .maybeSingle();

  if (dishError || !dish) {
    console.error('[cheffing/platos] Failed to load dish', dishError);
    notFound();
  }

  const { data: items, error: itemsError } = await supabase
    .from('v_cheffing_dish_items_cost')
    .select(
      'id, dish_id, ingredient_id, subrecipe_id, unit_code, quantity, waste_pct, notes, line_cost_total, ingredient:cheffing_ingredients(id, name), subrecipe:cheffing_subrecipes(id, name)',
    )
    .eq('dish_id', params.id)
    .order('created_at', { ascending: true });
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

  if (itemsError || ingredientsError || subrecipesError || unitsError) {
    console.error(
      '[cheffing/platos] Failed to load dish items',
      itemsError ?? ingredientsError ?? subrecipesError ?? unitsError,
    );
  }

  const normalizedItems = (items ?? []).map((item) => ({
    ...item,
    ingredient: Array.isArray(item.ingredient) ? item.ingredient[0] ?? null : item.ingredient ?? null,
    subrecipe: Array.isArray(item.subrecipe) ? item.subrecipe[0] ?? null : item.subrecipe ?? null,
  })) as DishItemWithDetails[];

  return (
    <section className="space-y-6">
      <div className="text-sm text-slate-400">
        <span className="mr-2">Cheffing</span>/<span className="mx-2">Platos</span>/
        <span className="ml-2 text-white">{dish.name}</span>
      </div>

      <DishDetailManager
        dish={dish as DishCost}
        items={normalizedItems}
        ingredients={(ingredients ?? []) as Ingredient[]}
        subrecipes={(subrecipes ?? []) as Subrecipe[]}
        units={(units ?? []) as Unit[]}
      />
    </section>
  );
}
