import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import type { Ingredient, Subrecipe, Unit } from '@/lib/cheffing/types';

import { SubrecipeDetailManager } from './SubrecipeDetailManager';

type SubrecipeCost = Subrecipe & {
  output_unit_dimension: string | null;
  output_unit_factor: number | null;
  items_cost_total: number | null;
  cost_gross_per_base: number | null;
  cost_net_per_base: number | null;
  waste_factor: number | null;
};

type SubrecipeItemWithDetails = {
  id: string;
  subrecipe_id: string;
  ingredient_id: string | null;
  subrecipe_component_id: string | null;
  unit_code: string;
  quantity: number;
  waste_pct: number;
  notes: string | null;
  line_cost_total: number | null;
  ingredient?: { id: string; name: string } | null;
  subrecipe_component?: { id: string; name: string } | null;
};

export default async function CheffingElaboracionDetailPage({ params }: { params: { id: string } }) {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const { data: subrecipe, error: subrecipeError } = await supabase
    .from('v_cheffing_subrecipe_cost')
    .select(
      'id, name, output_unit_code, output_qty, waste_pct, notes, created_at, updated_at, output_unit_dimension, output_unit_factor, items_cost_total, cost_gross_per_base, cost_net_per_base, waste_factor',
    )
    .eq('id', params.id)
    .maybeSingle();

  if (subrecipeError || !subrecipe) {
    console.error('[cheffing/elaboraciones] Failed to load subrecipe', subrecipeError);
    notFound();
  }

  const { data: items, error: itemsError } = await supabase
    .from('v_cheffing_subrecipe_items_cost')
    .select(
      'id, subrecipe_id, ingredient_id, subrecipe_component_id, unit_code, quantity, waste_pct, notes, line_cost_total, ingredient:cheffing_ingredients!cheffing_subrecipe_items_ingredient_id_fkey(id, name), subrecipe_component:cheffing_subrecipes!cheffing_subrecipe_items_subrecipe_component_id_fkey(id, name)',
    )
    .eq('subrecipe_id', params.id)
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
      '[cheffing/elaboraciones] Failed to load subrecipe items',
      itemsError ?? ingredientsError ?? subrecipesError ?? unitsError,
    );
  }

  const normalizedItems = (items ?? []).map((item) => {
    const ingredient = Array.isArray(item.ingredient) ? item.ingredient[0] ?? null : item.ingredient ?? null;
    const subrecipeComponent = Array.isArray(item.subrecipe_component)
      ? item.subrecipe_component[0] ?? null
      : item.subrecipe_component ?? null;
    return {
      ...item,
      ingredient,
      subrecipe_component: subrecipeComponent,
    };
  });

  return (
    <section className="space-y-6">
      <div className="text-sm text-slate-400">
        <span className="mr-2">Cheffing</span>/
        <span className="mx-2">Elaboraciones</span>/<span className="ml-2 text-white">{subrecipe.name}</span>
      </div>

      <SubrecipeDetailManager
        subrecipe={subrecipe as SubrecipeCost}
        items={normalizedItems as SubrecipeItemWithDetails[]}
        ingredients={(ingredients ?? []) as Ingredient[]}
        subrecipes={(subrecipes ?? []) as Subrecipe[]}
        units={(units ?? []) as Unit[]}
      />
    </section>
  );
}
