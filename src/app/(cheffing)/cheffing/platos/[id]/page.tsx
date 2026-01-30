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

  const { data: dishMeta, error: dishMetaError } = await supabase
    .from('cheffing_dishes')
    .select(
      'id, allergens_manual_add, allergens_manual_exclude, indicators_manual_add, indicators_manual_exclude, image_path, venue_id',
    )
    .eq('id', params.id)
    .maybeSingle();

  const { data: items, error: itemsError } = await supabase
    .from('v_cheffing_dish_items_cost')
    .select(
      'id, dish_id, ingredient_id, subrecipe_id, unit_code, quantity, waste_pct, notes, line_cost_total, ingredient:cheffing_ingredients(id, name), subrecipe:cheffing_subrecipes(id, name)',
    )
    .eq('dish_id', params.id)
    .order('created_at', { ascending: true });
  const { data: ingredients, error: ingredientsError } = await supabase
    .from('cheffing_ingredients')
    .select(
      'id, name, purchase_unit_code, purchase_pack_qty, purchase_price, waste_pct, allergens, indicators, created_at, updated_at',
    )
    .order('name', { ascending: true });
  const { data: subrecipes, error: subrecipesError } = await supabase
    .from('cheffing_subrecipes')
    .select(
      'id, name, output_unit_code, output_qty, waste_pct, notes, allergens_manual_add, allergens_manual_exclude, indicators_manual_add, indicators_manual_exclude, created_at, updated_at',
    )
    .order('name', { ascending: true });
  const { data: subrecipeItems, error: subrecipeItemsError } = await supabase
    .from('cheffing_subrecipe_items')
    .select('subrecipe_id, ingredient_id, subrecipe_component_id');
  const { data: units, error: unitsError } = await supabase
    .from('cheffing_units')
    .select('code, name, dimension, to_base_factor')
    .order('dimension', { ascending: true })
    .order('to_base_factor', { ascending: true });

  if (itemsError || ingredientsError || subrecipesError || subrecipeItemsError || unitsError || dishMetaError) {
    console.error(
      '[cheffing/platos] Failed to load dish items',
      itemsError ?? ingredientsError ?? subrecipesError ?? subrecipeItemsError ?? unitsError ?? dishMetaError,
    );
  }

  const normalizedItems = (items ?? []).map((item) => ({
    ...item,
    ingredient: Array.isArray(item.ingredient) ? item.ingredient[0] ?? null : item.ingredient ?? null,
    subrecipe: Array.isArray(item.subrecipe) ? item.subrecipe[0] ?? null : item.subrecipe ?? null,
  }));

  const ingredientLookup = new Map((ingredients ?? []).map((entry) => [entry.id, entry]));
  const subrecipeLookup = new Map((subrecipes ?? []).map((entry) => [entry.id, entry]));
  const itemsBySubrecipe = new Map<string, { ingredient_id: string | null; subrecipe_component_id: string | null }[]>();

  (subrecipeItems ?? []).forEach((item) => {
    const list = itemsBySubrecipe.get(item.subrecipe_id) ?? [];
    list.push({ ingredient_id: item.ingredient_id, subrecipe_component_id: item.subrecipe_component_id });
    itemsBySubrecipe.set(item.subrecipe_id, list);
  });

  const effectiveCache = new Map<string, { allergens: string[]; indicators: string[] }>();
  const inProgress = new Set<string>();

  const resolveEffective = (subrecipeId: string) => {
    const cached = effectiveCache.get(subrecipeId);
    if (cached) return cached;

    const current = subrecipeLookup.get(subrecipeId);
    const manualAddAllergens = current?.allergens_manual_add ?? [];
    const manualExcludeAllergens = current?.allergens_manual_exclude ?? [];
    const manualAddIndicators = current?.indicators_manual_add ?? [];
    const manualExcludeIndicators = current?.indicators_manual_exclude ?? [];

    if (inProgress.has(subrecipeId)) {
      const fallbackAllergens = new Set(manualAddAllergens);
      manualExcludeAllergens.forEach((key) => fallbackAllergens.delete(key));
      const fallbackIndicators = new Set(manualAddIndicators);
      manualExcludeIndicators.forEach((key) => fallbackIndicators.delete(key));
      const fallback = {
        allergens: Array.from(fallbackAllergens),
        indicators: Array.from(fallbackIndicators),
      };
      effectiveCache.set(subrecipeId, fallback);
      return fallback;
    }

    inProgress.add(subrecipeId);

    const inheritedAllergens = new Set<string>();
    const inheritedIndicators = new Set<string>();
    const relatedItems = itemsBySubrecipe.get(subrecipeId) ?? [];

    relatedItems.forEach((item) => {
      if (item.ingredient_id) {
        const ingredient = ingredientLookup.get(item.ingredient_id);
        ingredient?.allergens?.forEach((key) => inheritedAllergens.add(key));
        ingredient?.indicators?.forEach((key) => inheritedIndicators.add(key));
      } else if (item.subrecipe_component_id) {
        const nested = resolveEffective(item.subrecipe_component_id);
        nested.allergens.forEach((key) => inheritedAllergens.add(key));
        nested.indicators.forEach((key) => inheritedIndicators.add(key));
      }
    });

    const effectiveAllergens = new Set([...inheritedAllergens, ...manualAddAllergens]);
    manualExcludeAllergens.forEach((key) => effectiveAllergens.delete(key));
    const effectiveIndicators = new Set([...inheritedIndicators, ...manualAddIndicators]);
    manualExcludeIndicators.forEach((key) => effectiveIndicators.delete(key));

    const resolved = {
      allergens: Array.from(effectiveAllergens),
      indicators: Array.from(effectiveIndicators),
    };

    effectiveCache.set(subrecipeId, resolved);
    inProgress.delete(subrecipeId);
    return resolved;
  };

  const enrichedSubrecipes = (subrecipes ?? []).map((entry) => {
    const effective = resolveEffective(entry.id);
    return {
      ...entry,
      effective_allergens: effective.allergens,
      effective_indicators: effective.indicators,
    };
  });

  const mergedDish = {
    ...dish,
    ...(dishMeta ?? {}),
  };

  return (
    <section className="space-y-6">
      <div className="text-sm text-slate-400">
        <span className="mr-2">Cheffing</span>/<span className="mx-2">Platos</span>/
        <span className="ml-2 text-white">{dish.name}</span>
      </div>

      <DishDetailManager
        dish={mergedDish as DishCost}
        items={(normalizedItems ?? []) as DishItemWithDetails[]}
        ingredients={(ingredients ?? []) as Ingredient[]}
        subrecipes={enrichedSubrecipes as Subrecipe[]}
        units={(units ?? []) as Unit[]}
      />
    </section>
  );
}
