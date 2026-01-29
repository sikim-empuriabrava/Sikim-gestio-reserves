import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import {
  subrecipeCreateSchema,
  subrecipeCreateWithItemsSchema,
  type SubrecipeCreateInput,
  type SubrecipeItemCreateInput,
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
    .from('v_cheffing_subrecipe_cost')
    .select(
      'id, name, output_unit_code, output_qty, waste_pct, notes, created_at, updated_at, output_unit_dimension, output_unit_factor, items_cost_total, cost_gross_per_base, cost_net_per_base, waste_factor',
    )
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
  let subrecipeInput: SubrecipeCreateInput;
  let items: SubrecipeItemCreateInput[] = [];

  if (body && typeof body === 'object' && 'subrecipe' in body) {
    const parsed = subrecipeCreateWithItemsSchema.safeParse(body);
    if (!parsed.success) {
      const invalid = NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    subrecipeInput = parsed.data.subrecipe;
    items = parsed.data.items;
  } else {
    const parsed = subrecipeCreateSchema.safeParse(body);
    if (!parsed.success) {
      const invalid = NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    subrecipeInput = parsed.data;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_subrecipes')
    .insert({
      name: subrecipeInput.name,
      output_unit_code: subrecipeInput.output_unit_code,
      output_qty: subrecipeInput.output_qty,
      waste_pct: subrecipeInput.waste_pct,
      notes: subrecipeInput.notes ?? null,
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
    const serverError = NextResponse.json({ error: 'Failed to create subrecipe' }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from('cheffing_subrecipe_items').insert(
      items.map((item) => ({
        subrecipe_id: createdId,
        ingredient_id: item.ingredient_id,
        subrecipe_component_id: item.subrecipe_component_id,
        unit_code: item.unit_code,
        quantity: item.quantity,
        waste_pct: item.waste_pct ?? 0,
        notes: item.notes ?? null,
      })),
    );

    if (itemsError) {
      await supabase.from('cheffing_subrecipes').delete().eq('id', createdId);
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
