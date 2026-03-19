import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import {
  dishCreateSchema,
  dishCreateWithItemsSchema,
  type DishCreateInput,
  type DishItemCreateInput,
} from '@/lib/cheffing/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resolveDishItemWasteOverride = (payload: { waste_pct_override?: number | null; waste_pct?: number }) => {
  return payload.waste_pct_override ?? payload.waste_pct ?? null;
};

const formatPctLabel = (value: number) => {
  const normalized = Number((value * 100).toFixed(2));
  return `${normalized}%`;
};

async function validateDishItemsWasteFloor(items: DishItemCreateInput[]) {
  const itemsWithWaste = items
    .map((item) => ({ item, finalWasteOverride: resolveDishItemWasteOverride(item) }))
    .filter((entry) => entry.finalWasteOverride !== null);

  if (itemsWithWaste.length === 0) {
    return null;
  }

  const supabase = createSupabaseAdminClient();

  const ingredientIds = Array.from(
    new Set(itemsWithWaste.map(({ item }) => item.ingredient_id).filter((value): value is string => Boolean(value))),
  );
  const subrecipeIds = Array.from(
    new Set(itemsWithWaste.map(({ item }) => item.subrecipe_id).filter((value): value is string => Boolean(value))),
  );

  const ingredientWaste = new Map<string, number>();
  const subrecipeWaste = new Map<string, number>();

  if (ingredientIds.length > 0) {
    const { data, error } = await supabase
      .from('cheffing_ingredients')
      .select('id, waste_pct')
      .in('id', ingredientIds);

    if (error) {
      return { status: 500, error: error.message };
    }

    (data ?? []).forEach((row) => {
      ingredientWaste.set(row.id, row.waste_pct ?? 0);
    });
  }

  if (subrecipeIds.length > 0) {
    const { data, error } = await supabase
      .from('cheffing_subrecipes')
      .select('id, waste_pct')
      .in('id', subrecipeIds);

    if (error) {
      return { status: 500, error: error.message };
    }

    (data ?? []).forEach((row) => {
      subrecipeWaste.set(row.id, row.waste_pct ?? 0);
    });
  }

  for (const { item, finalWasteOverride } of itemsWithWaste) {
    const finalWaste = finalWasteOverride as number;

    if (item.ingredient_id) {
      const baseWaste = ingredientWaste.get(item.ingredient_id) ?? 0;
      if (finalWaste < baseWaste) {
        return {
          status: 400,
          error: `La merma de la línea no puede ser inferior a la merma base del ingrediente (${formatPctLabel(baseWaste)}).`,
        };
      }
    }

    if (item.subrecipe_id) {
      const baseWaste = subrecipeWaste.get(item.subrecipe_id) ?? 0;
      if (finalWaste < baseWaste) {
        return {
          status: 400,
          error: `La merma de la línea no puede ser inferior a la merma base de la elaboración (${formatPctLabel(baseWaste)}).`,
        };
      }
    }
  }

  return null;
}

export async function GET() {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('v_cheffing_dish_cost')
    .select('id, name, selling_price, servings, notes, created_at, updated_at, items_cost_total, cost_per_serving')
    .order('name', { ascending: true });

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ data: data ?? [] });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}

export async function POST(req: NextRequest) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const body = await req.json().catch(() => null);
  let dishInput: DishCreateInput;
  let items: DishItemCreateInput[] = [];

  if (body && typeof body === 'object' && 'dish' in body) {
    const parsed = dishCreateWithItemsSchema.safeParse(body);
    if (!parsed.success) {
      const invalid = NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    dishInput = parsed.data.dish;
    items = parsed.data.items;
  } else {
    const parsed = dishCreateSchema.safeParse(body);
    if (!parsed.success) {
      const invalid = NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    dishInput = parsed.data;
  }

  const itemsWasteValidation = await validateDishItemsWasteFloor(items);
  if (itemsWasteValidation) {
    const errorResponse = NextResponse.json({ error: itemsWasteValidation.error }, { status: itemsWasteValidation.status });
    mergeResponseCookies(access.supabaseResponse, errorResponse);
    return errorResponse;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_dishes')
    .insert({
      name: dishInput.name,
      family_id: dishInput.family_id ?? null,
      selling_price: dishInput.selling_price ?? null,
      servings: dishInput.servings,
      notes: dishInput.notes ?? null,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    const mapped = mapCheffingPostgresError(error);
    const serverError = NextResponse.json({ error: mapped.message }, { status: mapped.status });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const createdId = data?.id ?? null;

  if (!createdId) {
    const serverError = NextResponse.json({ error: 'Failed to create dish' }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from('cheffing_dish_items').insert(
      items.map((item) => ({
        dish_id: createdId,
        ingredient_id: item.ingredient_id,
        subrecipe_id: item.subrecipe_id,
        unit_code: item.unit_code,
        quantity: item.quantity,
        // `cheffing_dish_items` persists only the optional per-line override.
        waste_pct_override: resolveDishItemWasteOverride(item),
        notes: item.notes ?? null,
      })),
    );

    if (itemsError) {
      await supabase.from('cheffing_dishes').delete().eq('id', createdId);
      const mapped = mapCheffingPostgresError(itemsError);
      const serverError = NextResponse.json({ error: mapped.message }, { status: mapped.status });
      mergeResponseCookies(access.supabaseResponse, serverError);
      return serverError;
    }
  }

  const response = NextResponse.json({ ok: true, id: createdId });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
