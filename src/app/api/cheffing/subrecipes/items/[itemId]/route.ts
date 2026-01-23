import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const body = await req.json().catch(() => null);
  const updates: Record<string, unknown> = {};

  const hasIngredientKey = body && Object.prototype.hasOwnProperty.call(body, 'ingredient_id');
  const hasSubrecipeKey = body && Object.prototype.hasOwnProperty.call(body, 'subrecipe_component_id');

  if (hasIngredientKey || hasSubrecipeKey) {
    if (!hasIngredientKey || !hasSubrecipeKey) {
      const invalid = NextResponse.json({ error: 'Missing component selection' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }

    const ingredientId = typeof body?.ingredient_id === 'string' ? body.ingredient_id.trim() : null;
    const subrecipeComponentId =
      typeof body?.subrecipe_component_id === 'string' ? body.subrecipe_component_id.trim() : null;

    if ((!ingredientId && !subrecipeComponentId) || (ingredientId && subrecipeComponentId)) {
      const invalid = NextResponse.json({ error: 'Invalid component selection' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }

    updates.ingredient_id = ingredientId;
    updates.subrecipe_component_id = subrecipeComponentId;
  }

  if (body?.unit_code !== undefined) {
    const unitCode = typeof body.unit_code === 'string' ? body.unit_code.trim() : '';
    if (!unitCode) {
      const invalid = NextResponse.json({ error: 'Invalid unit_code' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.unit_code = unitCode;
  }

  if (body?.quantity !== undefined) {
    if (!isValidNumber(body.quantity) || body.quantity <= 0) {
      const invalid = NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.quantity = body.quantity;
  }

  if (body?.notes !== undefined) {
    updates.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
  }

  if (Object.keys(updates).length === 0) {
    const invalid = NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cheffing_subrecipe_items').update(updates).eq('id', params.itemId);

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ ok: true });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}

export async function DELETE(req: NextRequest, { params }: { params: { itemId: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cheffing_subrecipe_items').delete().eq('id', params.itemId);

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ ok: true });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
