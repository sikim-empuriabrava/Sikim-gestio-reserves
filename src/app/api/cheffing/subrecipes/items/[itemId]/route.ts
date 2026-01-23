import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import { subrecipeItemSchema } from '@/lib/cheffing/schemas';
import { wouldCreateSubrecipeCycle } from '@/lib/cheffing/subrecipeCycles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  if (parsed.data.subrecipe_component_id) {
    const { data: existingItem, error: existingError } = await supabase
      .from('cheffing_subrecipe_items')
      .select('subrecipe_id')
      .eq('id', params.itemId)
      .maybeSingle();

    if (existingError) {
      const serverError = NextResponse.json({ error: existingError.message }, { status: 500 });
      mergeResponseCookies(access.supabaseResponse, serverError);
      return serverError;
    }

    if (!existingItem) {
      const notFound = NextResponse.json({ error: 'Not found' }, { status: 404 });
      mergeResponseCookies(access.supabaseResponse, notFound);
      return notFound;
    }

    if (parsed.data.subrecipe_component_id === existingItem.subrecipe_id) {
      const invalid = NextResponse.json({ error: 'Invalid subrecipe component' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }

    const cycleCheck = await wouldCreateSubrecipeCycle(
      supabase,
      existingItem.subrecipe_id,
      parsed.data.subrecipe_component_id,
      params.itemId,
    );
    if ('error' in cycleCheck && cycleCheck.error) {
      const serverError = NextResponse.json({ error: cycleCheck.error.message }, { status: 500 });
      mergeResponseCookies(access.supabaseResponse, serverError);
      return serverError;
    }
    if (cycleCheck.hasCycle) {
      const invalid = NextResponse.json(
        { error: 'Esta relación crea un ciclo entre elaboraciones.' },
        { status: 409 },
      );
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
  }

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
    const mapped = mapCheffingPostgresError(error);
    const serverError = NextResponse.json({ error: mapped.message }, { status: mapped.status });
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
    const mapped = mapCheffingPostgresError(error);
    const serverError = NextResponse.json({ error: mapped.message }, { status: mapped.status });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ ok: true });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
