import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { subrecipeItemSchema } from '@/lib/cheffing/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isUniqueViolation(error: { code?: string; message: string }) {
  return error.code === '23505';
}

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const body = await req.json().catch(() => null);
  const parsed = subrecipeItemSchema.safeParse(body);

  if (!parsed.success) {
    const invalid = NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cheffing_subrecipe_items')
    .update({
      ingredient_id: parsed.data.ingredient_id,
      subrecipe_component_id: parsed.data.subrecipe_component_id,
      unit_code: parsed.data.unit_code,
      quantity: parsed.data.quantity,
      waste_pct: parsed.data.waste_pct,
      notes: parsed.data.notes ?? null,
    })
    .eq('id', params.itemId);

  if (error) {
    const status = isUniqueViolation(error) ? 409 : 500;
    const serverError = NextResponse.json({ error: error.message }, { status });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ ok: true });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}

export async function DELETE(_req: NextRequest, { params }: { params: { itemId: string } }) {
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
