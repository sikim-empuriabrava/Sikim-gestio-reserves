import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import { subrecipeItemSchema } from '@/lib/cheffing/schemas';
import { wouldCreateSubrecipeCycle } from '@/lib/cheffing/subrecipeCycles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('v_cheffing_subrecipe_items_cost')
    .select(
      'id, subrecipe_id, ingredient_id, subrecipe_component_id, unit_code, quantity, waste_pct, notes, line_cost_total, created_at, updated_at',
    )
    .eq('subrecipe_id', params.id)
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
  const parsed = subrecipeItemSchema.safeParse(body);

  if (!parsed.success) {
    const invalid = NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  if (parsed.data.subrecipe_component_id && parsed.data.subrecipe_component_id === params.id) {
    const invalid = NextResponse.json({ error: 'Invalid subrecipe component' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const supabase = createSupabaseAdminClient();
  if (parsed.data.subrecipe_component_id) {
    const cycleCheck = await wouldCreateSubrecipeCycle(
      supabase,
      params.id,
      parsed.data.subrecipe_component_id,
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

  const { data, error } = await supabase
    .from('cheffing_subrecipe_items')
    .insert({
      subrecipe_id: params.id,
      ingredient_id: parsed.data.ingredient_id,
      subrecipe_component_id: parsed.data.subrecipe_component_id,
      unit_code: parsed.data.unit_code,
      quantity: parsed.data.quantity,
      waste_pct: parsed.data.waste_pct,
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
