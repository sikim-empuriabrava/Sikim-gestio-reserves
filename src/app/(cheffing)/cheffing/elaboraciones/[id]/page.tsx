import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import type { Ingredient, Subrecipe, Unit } from '@/lib/cheffing/types';
import type { AllergenKey, IndicatorKey } from '@/lib/cheffing/allergensIndicators';
import { sanitizeAllergens, sanitizeIndicators } from '@/lib/cheffing/allergensHelpers';
import {
  addAllergens,
  addIndicators,
  removeAllergens,
  removeIndicators,
  type EffectiveAI,
} from '@/lib/cheffing/allergensIndicatorsOps';

import {
  SubrecipeDetailManager,
  type SubrecipeCost,
  type SubrecipeItemWithDetails,
} from './SubrecipeDetailManager';

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
    .select(
      'id, name, purchase_unit_code, purchase_pack_qty, purchase_price, waste_pct, allergens, indicators, created_at, updated_at',
    )
    .order('name', { ascending: true });
  const { data: subrecipes, error: subrecipesError } = await supabase
    .from('cheffing_subrecipes')
    .select(
      'id, name, output_unit_code, output_qty, waste_pct, notes, allergens_manual_add, allergens_manual_exclude, indicators_manual_add, indicators_manual_exclude, image_path, created_at, updated_at',
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

  if (itemsError || ingredientsError || subrecipesError || subrecipeItemsError || unitsError) {
    console.error(
      '[cheffing/elaboraciones] Failed to load subrecipe items',
      itemsError ?? ingredientsError ?? subrecipesError ?? subrecipeItemsError ?? unitsError,
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

  const subrecipesTyped = (subrecipes ?? []) as Subrecipe[];
  const ingredientsTyped = (ingredients ?? []) as Ingredient[];

  const subrecipeLookup = new Map<string, Subrecipe>(subrecipesTyped.map((entry) => [entry.id, entry] as const));
  const ingredientLookup = new Map<string, Ingredient>(
    ingredientsTyped.map((entry) => [entry.id, entry] as const),
  );
  const itemsBySubrecipe = new Map<string, { ingredient_id: string | null; subrecipe_component_id: string | null }[]>();

  (subrecipeItems ?? []).forEach((item) => {
    const list = itemsBySubrecipe.get(item.subrecipe_id) ?? [];
    list.push({ ingredient_id: item.ingredient_id, subrecipe_component_id: item.subrecipe_component_id });
    itemsBySubrecipe.set(item.subrecipe_id, list);
  });

  const effectiveCache = new Map<string, EffectiveAI>();
  const inProgress = new Set<string>();

  const resolveEffective = (subrecipeId: string): EffectiveAI => {
    const cached = effectiveCache.get(subrecipeId);
    if (cached) return cached;

    const current = subrecipeLookup.get(subrecipeId);
    const manualAddAllergens = sanitizeAllergens(current?.allergens_manual_add);
    const manualExcludeAllergens = sanitizeAllergens(current?.allergens_manual_exclude);
    const manualAddIndicators = sanitizeIndicators(current?.indicators_manual_add);
    const manualExcludeIndicators = sanitizeIndicators(current?.indicators_manual_exclude);

    if (inProgress.has(subrecipeId)) {
      const fallbackAllergens = new Set<AllergenKey>(manualAddAllergens);
      removeAllergens(fallbackAllergens, manualExcludeAllergens);
      const fallbackIndicators = new Set<IndicatorKey>(manualAddIndicators);
      removeIndicators(fallbackIndicators, manualExcludeIndicators);
      const fallback = {
        allergens: Array.from(fallbackAllergens),
        indicators: Array.from(fallbackIndicators),
      };
      effectiveCache.set(subrecipeId, fallback);
      return fallback;
    }

    inProgress.add(subrecipeId);

    const inheritedAllergens = new Set<AllergenKey>();
    const inheritedIndicators = new Set<IndicatorKey>();
    const relatedItems = itemsBySubrecipe.get(subrecipeId) ?? [];

    for (const item of relatedItems) {
      if (item.ingredient_id) {
        const ingredient = ingredientLookup.get(item.ingredient_id);
        addAllergens(inheritedAllergens, ingredient?.allergens);
        addIndicators(inheritedIndicators, ingredient?.indicators);
      } else if (item.subrecipe_component_id) {
        const nested = resolveEffective(item.subrecipe_component_id);
        addAllergens(inheritedAllergens, nested.allergens);
        addIndicators(inheritedIndicators, nested.indicators);
      }
    }

    const effectiveAllergens = new Set<AllergenKey>([...inheritedAllergens, ...manualAddAllergens]);
    removeAllergens(effectiveAllergens, manualExcludeAllergens);
    const effectiveIndicators = new Set<IndicatorKey>([...inheritedIndicators, ...manualAddIndicators]);
    removeIndicators(effectiveIndicators, manualExcludeIndicators);

    const resolved = {
      allergens: Array.from(effectiveAllergens),
      indicators: Array.from(effectiveIndicators),
    };

    effectiveCache.set(subrecipeId, resolved);
    inProgress.delete(subrecipeId);
    return resolved;
  };

  const enrichedSubrecipes = subrecipesTyped.map((entry) => {
    const effective = resolveEffective(entry.id);
    return {
      ...entry,
      effective_allergens: effective.allergens,
      effective_indicators: effective.indicators,
    };
  });

  const subrecipeManual = subrecipeLookup.get(params.id);
  const mergedSubrecipe = {
    ...subrecipe,
    ...(subrecipeManual ?? {}),
  };

  return (
    <section className="space-y-6">
      <div className="text-sm text-slate-400">
        <span className="mr-2">Cheffing</span>/
        <span className="mx-2">Elaboraciones</span>/<span className="ml-2 text-white">{subrecipe.name}</span>
      </div>

      <SubrecipeDetailManager
        subrecipe={mergedSubrecipe as SubrecipeCost}
        items={normalizedItems as SubrecipeItemWithDetails[]}
        ingredients={ingredientsTyped}
        subrecipes={enrichedSubrecipes}
        units={(units ?? []) as Unit[]}
      />
    </section>
  );
}
