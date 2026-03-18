import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { isAdmin } from '@/lib/auth/requireRole';
import type { Ingredient, Subrecipe, Unit } from '@/lib/cheffing/types';
import type { AllergenKey, ProductIndicatorKey } from '@/lib/cheffing/allergensIndicators';
import { sanitizeAllergens, sanitizeProductIndicators } from '@/lib/cheffing/allergensHelpers';
import { normalizeIngredient, normalizeSubrecipe } from '@/lib/cheffing/compat';
import { addAllergens, addIndicators, type EffectiveAI } from '@/lib/cheffing/allergensIndicatorsOps';

import {
  SubrecipeDetailManager,
  type SubrecipeCost,
  type SubrecipeItemWithDetails,
} from './SubrecipeDetailManager';

export default async function CheffingElaboracionDetailPage({ params }: { params: { id: string } }) {
  const { allowlistInfo } = await requireCheffingAccess();
  const canManageImages =
    isAdmin(allowlistInfo.role) || Boolean(allowlistInfo.allowedUser?.cheffing_images_manage);

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
      'id, subrecipe_id, ingredient_id, subrecipe_component_id, unit_code, quantity, waste_pct, notes, line_cost_total',
    )
    .eq('subrecipe_id', params.id)
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

  if (itemsError || ingredientsError || subrecipesError || subrecipeItemsError || unitsError) {
    const loadError = itemsError ?? ingredientsError ?? subrecipesError ?? subrecipeItemsError ?? unitsError;
    console.error('[cheffing/elaboraciones] Failed to load subrecipe detail data', loadError);
    throw new Error('No se pudieron cargar los datos de la elaboración por incompatibilidad de schema.');
  }

  const ingredientsTyped = (ingredients ?? []).map((raw) =>
    normalizeIngredient(raw as Record<string, unknown>),
  ) as Ingredient[];
  const subrecipesTyped = (subrecipes ?? []).map((raw) =>
    normalizeSubrecipe(raw as Record<string, unknown>),
  ) as Subrecipe[];

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
    const directAllergens = sanitizeAllergens(current?.allergen_codes);
    const directIndicators = sanitizeProductIndicators(current?.indicator_codes);

    if (inProgress.has(subrecipeId)) {
      const fallback = {
        allergens: [...directAllergens],
        indicators: [...directIndicators],
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

    const effectiveAllergens = new Set([...inheritedAllergens, ...directAllergens]);
    const effectiveIndicators = new Set([...inheritedIndicators, ...directIndicators]);

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
    const subrecipeComponent = item.subrecipe_component_id
      ? subrecipeLookup.get(item.subrecipe_component_id)
      : null;
    return {
      ...item,
      ingredient: ingredient ? { id: ingredient.id, name: ingredient.name } : null,
      subrecipe_component: subrecipeComponent ? { id: subrecipeComponent.id, name: subrecipeComponent.name } : null,
    };
  });

  const subrecipeManual = subrecipeLookup.get(params.id);
  const mergedSubrecipe = {
    ...subrecipe,
    ...(subrecipeManual ?? {}),
  };
  const inheritedCurrent = resolveEffective(params.id);
  const directCurrentAllergens = sanitizeAllergens(mergedSubrecipe.allergen_codes);
  const directCurrentIndicators = sanitizeProductIndicators(mergedSubrecipe.indicator_codes);
  const inheritedAllergens = inheritedCurrent.allergens.filter((key) => !directCurrentAllergens.includes(key));
  const inheritedIndicators = inheritedCurrent.indicators.filter((key) => !directCurrentIndicators.includes(key));

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
        inheritedAllergens={inheritedAllergens}
        inheritedIndicators={inheritedIndicators}
        canManageImages={canManageImages}
      />
    </section>
  );
}
