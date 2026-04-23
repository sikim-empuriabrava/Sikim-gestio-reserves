import { notFound } from 'next/navigation';
import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { isAdmin } from '@/lib/auth/requireRole';
import type { Ingredient, Subrecipe, Unit } from '@/lib/cheffing/types';
import type { AllergenKey, ProductIndicatorKey } from '@/lib/cheffing/allergensIndicators';
import { sanitizeProductIndicators } from '@/lib/cheffing/allergensHelpers';
import { normalizeIngredient, normalizeSubrecipe } from '@/lib/cheffing/compat';
import { addAllergens, addIndicators, type EffectiveAI } from '@/lib/cheffing/allergensIndicatorsOps';
import { resolveConsumerDishHref } from '@/lib/cheffing/consumers';

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
    console.error('[cheffing/elaboraciones] Failed to load subrecipe header', {
      subrecipeId: params.id,
      error: subrecipeError,
    });
    notFound();
  }

  const { data: items, error: itemsError } = await supabase
    .from('cheffing_subrecipe_items')
    .select(
      'id, subrecipe_id, ingredient_id, subrecipe_component_id, unit_code, quantity, notes, created_at',
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
  const { data: dishItemsBySubrecipe, error: dishItemsBySubrecipeError } = await supabase
    .from('cheffing_dish_items')
    .select('subrecipe_id, dish_id')
    .eq('subrecipe_id', params.id);
  const dishIdsUsingSubrecipe = Array.from(new Set((dishItemsBySubrecipe ?? []).map((item) => item.dish_id)));
  const { data: dishesUsingSubrecipe, error: dishesUsingSubrecipeError } =
    dishIdsUsingSubrecipe.length === 0
      ? { data: [], error: null }
      : await supabase
          .from('cheffing_dishes')
          .select('id, name, cheffing_families(kind)')
          .in('id', dishIdsUsingSubrecipe)
          .order('name', { ascending: true });

  if (itemsError) {
    console.error('[cheffing/elaboraciones] Failed to load subrecipe lines', {
      subrecipeId: params.id,
      error: itemsError,
    });
    throw new Error('No se pudieron cargar las líneas de la elaboración.');
  }

  if (
    ingredientsError ||
    subrecipesError ||
    subrecipeItemsError ||
    unitsError ||
    dishItemsBySubrecipeError ||
    dishesUsingSubrecipeError
  ) {
    const loadError =
      ingredientsError ??
      subrecipesError ??
      subrecipeItemsError ??
      unitsError ??
      dishItemsBySubrecipeError ??
      dishesUsingSubrecipeError;
    console.error('[cheffing/elaboraciones] Failed to enrich subrecipe lines', {
      subrecipeId: params.id,
      error: loadError,
    });
    throw new Error('No se pudieron cargar los datos de la elaboración por incompatibilidad de schema.');
  }

  let ingredientsTyped: Ingredient[] = [];
  let subrecipesTyped: Subrecipe[] = [];
  try {
    ingredientsTyped = (ingredients ?? []).map((raw) =>
      normalizeIngredient(raw as Record<string, unknown>),
    ) as Ingredient[];
    subrecipesTyped = (subrecipes ?? []).map((raw) =>
      normalizeSubrecipe(raw as Record<string, unknown>),
    ) as Subrecipe[];
  } catch (error) {
    console.error('[cheffing/elaboraciones] Failed to enrich subrecipe lines in memory', {
      subrecipeId: params.id,
      error,
    });
    throw new Error('No se pudieron enriquecer las líneas de la elaboración.');
  }

  const subrecipeLookup = new Map<string, Subrecipe>(subrecipesTyped.map((entry) => [entry.id, entry] as const));
  const ingredientLookup = new Map<string, Ingredient>(
    ingredientsTyped.map((entry) => [entry.id, entry] as const),
  );
  const itemsBySubrecipe = new Map<string, { ingredient_id: string | null; subrecipe_component_id: string | null }[]>();

  (subrecipeItems ?? []).forEach((item) => {
    if (!item?.subrecipe_id) return;
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
    const directIndicators = sanitizeProductIndicators(current?.indicator_codes);

    if (inProgress.has(subrecipeId)) {
      const fallback = { allergens: [], indicators: [...directIndicators] };
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

    const resolved = {
      allergens: Array.from(inheritedAllergens),
      indicators: Array.from(new Set([...inheritedIndicators, ...directIndicators])),
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
      waste_pct: 0,
      ingredient: ingredient ? { id: ingredient.id, name: ingredient.name } : null,
      subrecipe_component: subrecipeComponent ? { id: subrecipeComponent.id, name: subrecipeComponent.name } : null,
      line_cost_total: null,
    };
  });

  const subrecipeManual = subrecipeLookup.get(params.id);
  const mergedSubrecipe = {
    ...subrecipe,
    ...(subrecipeManual ? normalizeSubrecipe(subrecipeManual as Record<string, unknown>) : {}),
  };
  const inheritedCurrent = resolveEffective(params.id);
  const inheritedAllergens = inheritedCurrent.allergens;
  const inheritedIndicators = inheritedCurrent.indicators;
  const usedInDishLinks = (dishesUsingSubrecipe ?? []).map((dish) => {
    const family = Array.isArray(dish.cheffing_families) ? dish.cheffing_families[0] : dish.cheffing_families;
    const familyKind = family?.kind === 'drink' ? 'drink' : 'food';
    return {
      id: dish.id,
      name: dish.name,
      href: resolveConsumerDishHref({ id: dish.id, family_kind: familyKind }),
      kindLabel: familyKind === 'drink' ? 'Bebida' : 'Plato',
    } as const;
  });

  return (
    <section className="space-y-6">
      <div className="text-sm text-slate-400">
        <Link href="/cheffing" className="mr-2 underline-offset-2 hover:text-slate-200 hover:underline">
          Cheffing
        </Link>
        /
        <Link
          href="/cheffing/elaboraciones"
          className="mx-2 underline-offset-2 hover:text-slate-200 hover:underline"
        >
          Elaboraciones
        </Link>
        /<span className="ml-2 text-white">{subrecipe.name}</span>
      </div>

      <SubrecipeDetailManager
        subrecipe={mergedSubrecipe as SubrecipeCost}
        items={normalizedItems as SubrecipeItemWithDetails[]}
        ingredients={ingredientsTyped}
        subrecipes={enrichedSubrecipes}
        units={(units ?? []) as Unit[]}
        inheritedAllergens={inheritedAllergens}
        inheritedIndicators={inheritedIndicators}
        usedInDishes={usedInDishLinks}
        canManageImages={canManageImages}
      />
    </section>
  );
}
