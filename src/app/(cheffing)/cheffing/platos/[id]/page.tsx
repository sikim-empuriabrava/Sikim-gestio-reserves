import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import type { AllergenKey, ProductIndicatorKey } from '@/lib/cheffing/allergensIndicators';
import { sanitizeAllergens, sanitizeProductIndicators } from '@/lib/cheffing/allergensHelpers';
import type { Ingredient, Subrecipe, Unit } from '@/lib/cheffing/types';
import {
  normalizeDishCompatibilityMeta,
  normalizeIngredient,
  normalizeSubrecipe,
} from '@/lib/cheffing/compat';
import {
  addAllergens,
  addIndicators,
  removeAllergens,
  removeIndicators,
  type EffectiveAI,
} from '@/lib/cheffing/allergensIndicatorsOps';

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
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  const { data: items, error: itemsError } = await supabase
    .from('v_cheffing_dish_items_cost')
    .select(
      'id, dish_id, ingredient_id, subrecipe_id, unit_code, quantity, waste_pct, waste_pct_override, notes, line_cost_total',
    )
    .eq('dish_id', params.id)
    .order('created_at', { ascending: true });
  const { data: ingredients, error: ingredientsError } = await supabase
    .from('cheffing_ingredients')
    .select('*')
    .order('name', { ascending: true });
  const { data: subrecipes, error: subrecipesError } = await supabase
    .from('cheffing_subrecipes')
    .select('*')
    .order('name', { ascending: true });
  const { data: subrecipeItems, error: subrecipeItemsError } = await supabase
    .from('cheffing_subrecipe_items')
    .select('subrecipe_id, ingredient_id, subrecipe_component_id');
  const { data: units, error: unitsError } = await supabase
    .from('cheffing_units')
    .select('code, name, dimension, to_base_factor')
    .order('dimension', { ascending: true })
    .order('to_base_factor', { ascending: true });

  if (dishMetaError || itemsError || ingredientsError || subrecipesError || subrecipeItemsError || unitsError) {
    const loadError =
      dishMetaError ?? itemsError ?? ingredientsError ?? subrecipesError ?? subrecipeItemsError ?? unitsError;
    console.error('[cheffing/platos] Failed to load dish detail data', loadError);
    throw new Error('No se pudieron cargar los datos del plato por incompatibilidad de schema.');
  }

  const ingredientsTyped = (ingredients ?? []).map((raw) =>
    normalizeIngredient(raw as Record<string, unknown>),
  ) as Ingredient[];
  const subrecipesTyped = (subrecipes ?? []).map((raw) =>
    normalizeSubrecipe(raw as Record<string, unknown>),
  ) as Subrecipe[];

  const ingredientLookup = new Map<string, Ingredient>(
    ingredientsTyped.map((entry) => [entry.id, entry] as const),
  );
  const subrecipeLookup = new Map<string, Subrecipe>(subrecipesTyped.map((entry) => [entry.id, entry] as const));
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
    const manualAddIndicators = sanitizeProductIndicators(current?.indicators_manual_add);
    const manualExcludeIndicators = sanitizeProductIndicators(current?.indicators_manual_exclude);

    if (inProgress.has(subrecipeId)) {
      const fallbackAllergens = new Set<AllergenKey>(manualAddAllergens);
      removeAllergens(fallbackAllergens, manualExcludeAllergens);
      const fallbackIndicators = new Set<ProductIndicatorKey>(manualAddIndicators);
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
    const inheritedIndicators = new Set<ProductIndicatorKey>();
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
    const effectiveIndicators = new Set<ProductIndicatorKey>([...inheritedIndicators, ...manualAddIndicators]);
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

  const normalizedItems = (items ?? []).map((item) => {
    const ingredient = item.ingredient_id ? ingredientLookup.get(item.ingredient_id) : null;
    const subrecipe = item.subrecipe_id ? subrecipeLookup.get(item.subrecipe_id) : null;
    return {
      ...item,
      ingredient: ingredient ? { id: ingredient.id, name: ingredient.name } : null,
      subrecipe: subrecipe ? { id: subrecipe.id, name: subrecipe.name } : null,
    };
  });

  const mergedDish = {
    ...dish,
    ...normalizeDishCompatibilityMeta((dishMeta ?? null) as Record<string, unknown> | null),
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
        ingredients={ingredientsTyped}
        subrecipes={enrichedSubrecipes as Subrecipe[]}
        units={(units ?? []) as Unit[]}
      />
    </section>
  );
}
