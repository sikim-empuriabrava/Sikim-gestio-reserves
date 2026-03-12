import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import { dishItemSchema } from '@/lib/cheffing/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resolveDishItemWasteOverride = (payload: { waste_pct_override?: number | null; waste_pct?: number }) => {
  return payload.waste_pct_override ?? payload.waste_pct ?? null;
};

const formatPctLabel = (value: number) => {
  const normalized = Number((value * 100).toFixed(2));
  return `${normalized}%`;
};

async function validateDishItemWasteFloor(params: {
  ingredientId: string | null;
  subrecipeId: string | null;
  finalWasteOverride: number | null;
}) {
  const { ingredientId, subrecipeId, finalWasteOverride } = params;
  if (finalWasteOverride === null) return null;

  const supabase = createSupabaseAdminClient();

  if (ingredientId) {
    const { data, error } = await supabase
      .from('cheffing_ingredients')
      .select('waste_pct')
      .eq('id', ingredientId)
      .maybeSingle();

    if (error) {
      return { status: 500, error: error.message };
    }

    const baseWaste = data?.waste_pct ?? 0;
    if (finalWasteOverride < baseWaste) {
      return {
        status: 400,
        error: `La merma de la línea no puede ser inferior a la merma base del ingrediente (${formatPctLabel(baseWaste)}).`,
      };
    }
  }

  if (subrecipeId) {
    const { data, error } = await supabase
      .from('cheffing_subrecipes')
      .select('waste_pct')
      .eq('id', subrecipeId)
      .maybeSingle();

    if (error) {
      return { status: 500, error: error.message };
    }

    const baseWaste = data?.waste_pct ?? 0;
    if (finalWasteOverride < baseWaste) {
      return {
        status: 400,
        error: `La merma de la línea no puede ser inferior a la merma base de la elaboración (${formatPctLabel(baseWaste)}).`,
      };
    }
  }

  return null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('v_cheffing_dish_items_cost')
    .select(
      'id, dish_id, ingredient_id, subrecipe_id, unit_code, quantity, waste_pct, waste_pct_override, notes, line_cost_total',
    )
    .eq('dish_id', params.id)
    .order('created_at', { ascending: true });

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ data: data ?? [] });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const body = await req.json().catch(() => null);
  const parsed = dishItemSchema.safeParse(body);

  if (!parsed.success) {
    const invalid = NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const finalWasteOverride = resolveDishItemWasteOverride(parsed.data);
  const validationError = await validateDishItemWasteFloor({
    ingredientId: parsed.data.ingredient_id,
    subrecipeId: parsed.data.subrecipe_id,
    finalWasteOverride,
  });

  if (validationError) {
    const errorResponse = NextResponse.json({ error: validationError.error }, { status: validationError.status });
    mergeResponseCookies(access.supabaseResponse, errorResponse);
    return errorResponse;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_dish_items')
    .insert({
      dish_id: params.id,
      ingredient_id: parsed.data.ingredient_id,
      subrecipe_id: parsed.data.subrecipe_id,
      unit_code: parsed.data.unit_code,
      quantity: parsed.data.quantity,
      // `cheffing_dish_items` persists only the optional per-line override.
      waste_pct_override: finalWasteOverride,
      notes: parsed.data.notes ?? null,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    const mapped = mapCheffingPostgresError(error);
    const serverError = NextResponse.json({ error: mapped.message }, { status: mapped.status });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ ok: true, id: data?.id ?? null });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
