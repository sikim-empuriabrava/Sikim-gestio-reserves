import { notFound } from 'next/navigation';
import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { isAdmin } from '@/lib/auth/requireRole';
import type { AllergenKey, ProductIndicatorKey } from '@/lib/cheffing/allergensIndicators';
import { sanitizeAllergens, sanitizeProductIndicators } from '@/lib/cheffing/allergensHelpers';
import type { Ingredient, Subrecipe, Unit } from '@/lib/cheffing/types';
import type { CheffingFamily } from '@/lib/cheffing/families';
import {
  normalizeDishCompatibilityMeta,
  normalizeIngredient,
  normalizeSubrecipe,
} from '@/lib/cheffing/compat';
import {
  addAllergens,
  addIndicators,
  type EffectiveAI,
} from '@/lib/cheffing/allergensIndicatorsOps';

import {
  DishDetailManager,
  type DishCost,
  type DishItemWithDetails,
} from '@/app/(cheffing)/cheffing/platos/[id]/DishDetailManager';

export default async function CheffingBebidaDetailPage({ params }: { params: { id: string } }) {
  const { allowlistInfo } = await requireCheffingAccess();
  const canManageImages =
    isAdmin(allowlistInfo.role) || Boolean(allowlistInfo.allowedUser?.cheffing_images_manage);

  const supabase = createSupabaseServerClient();
  const { data: dish, error: dishError } = await supabase
    .from('v_cheffing_dish_cost')
    .select('id, name, selling_price, servings, notes, created_at, updated_at, items_cost_total, cost_per_serving')
    .eq('id', params.id)
    .maybeSingle();

  if (dishError || !dish) {
    console.error('[cheffing/bebidas] Failed to load drink', dishError);
    notFound();
  }

  const { data: dishMeta, error: dishMetaError } = await supabase
    .from('cheffing_dishes')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (dishMeta?.family_id) {
    const { data: familyData } = await supabase
      .from('cheffing_families')
      .select('kind')
      .eq('id', dishMeta.family_id)
      .maybeSingle();

    if (familyData?.kind !== 'drink') {
      notFound();
    }
  } else {
    notFound();
  }

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
  const { data: families, error: familiesError } = await supabase
    .from('cheffing_families')
    .select('id, name, slug, sort_order, is_active, kind')
    .eq('is_active', true)
    .eq('kind', 'drink')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (dishMetaError || itemsError || ingredientsError || subrecipesError || subrecipeItemsError || unitsError || familiesError) {
    const loadError =
      dishMetaError ?? itemsError ?? ingredientsError ?? subrecipesError ?? subrecipeItemsError ?? unitsError ?? familiesError;
    console.error('[cheffing/bebidas] Failed to load drink detail data', loadError);
    throw new Error('No se pudieron cargar los datos de la bebida por incompatibilidad de schema.');
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
  const inheritedAllergenSet = new Set<AllergenKey>();
  const inheritedIndicatorSet = new Set<ProductIndicatorKey>();
  normalizedItems.forEach((item) => {
    if (item.ingredient_id) {
      const ingredient = ingredientLookup.get(item.ingredient_id);
      addAllergens(inheritedAllergenSet, ingredient?.allergens);
      addIndicators(inheritedIndicatorSet, ingredient?.indicators);
      return;
    }
    if (item.subrecipe_id) {
      const subrecipeEffective = resolveEffective(item.subrecipe_id);
      addAllergens(inheritedAllergenSet, subrecipeEffective.allergens);
      addIndicators(inheritedIndicatorSet, subrecipeEffective.indicators);
    }
  });
  const directDishAllergens = sanitizeAllergens(mergedDish.allergen_codes);
  const directDishIndicators = sanitizeProductIndicators(mergedDish.indicator_codes);
  const inheritedAllergens = [...inheritedAllergenSet].filter((key) => !directDishAllergens.includes(key));
  const inheritedIndicators = [...inheritedIndicatorSet].filter((key) => !directDishIndicators.includes(key));

  return (
    <section className="space-y-6">
      <div className="text-sm text-slate-400">
        <Link href="/cheffing" className="mr-2 underline-offset-2 hover:text-slate-200 hover:underline">
          Cheffing
        </Link>
        /
        <Link href="/cheffing/bebidas" className="mx-2 underline-offset-2 hover:text-slate-200 hover:underline">
          Bebidas
        </Link>
        /<span className="ml-2 text-white">{dish.name}</span>
      </div>

      <DishDetailManager
        dish={mergedDish as DishCost}
        items={(normalizedItems ?? []) as DishItemWithDetails[]}
        ingredients={ingredientsTyped}
        subrecipes={enrichedSubrecipes as Subrecipe[]}
        units={(units ?? []) as Unit[]}
        families={(families ?? []) as CheffingFamily[]}
        inheritedAllergens={inheritedAllergens}
        inheritedIndicators={inheritedIndicators}
        canManageImages={canManageImages}
        basePath="/cheffing/bebidas"
        entityLabelSingular="bebida"
      />
    </section>
  );
}
