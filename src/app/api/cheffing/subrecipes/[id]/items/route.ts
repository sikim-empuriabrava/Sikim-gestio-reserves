import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const body = await req.json().catch(() => null);
  const ingredientId = typeof body?.ingredient_id === 'string' ? body.ingredient_id.trim() : null;
  const subrecipeComponentId =
    typeof body?.subrecipe_component_id === 'string' ? body.subrecipe_component_id.trim() : null;
  const unitCode = typeof body?.unit_code === 'string' ? body.unit_code.trim() : '';
  const quantity = body?.quantity;
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : null;

  if ((!ingredientId && !subrecipeComponentId) || (ingredientId && subrecipeComponentId)) {
    const invalid = NextResponse.json({ error: 'Invalid component selection' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  if (subrecipeComponentId && subrecipeComponentId === params.id) {
    const invalid = NextResponse.json({ error: 'Invalid subrecipe component' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  if (!unitCode) {
    const invalid = NextResponse.json({ error: 'Invalid unit_code' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  if (!isValidNumber(quantity) || quantity <= 0) {
    const invalid = NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_subrecipe_items')
    .insert({
      subrecipe_id: params.id,
      ingredient_id: ingredientId,
      subrecipe_component_id: subrecipeComponentId,
      unit_code: unitCode,
      quantity,
      notes,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ ok: true, id: data?.id ?? null });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
