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

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_dishes')
    .insert({
      name: dishInput.name,
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
        waste_pct: item.waste_pct ?? 0,
        waste_pct_override: item.waste_pct_override ?? null,
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
