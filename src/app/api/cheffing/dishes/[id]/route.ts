import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import { dishUpdateSchema } from '@/lib/cheffing/schemas';
import {
  ALLERGEN_KEYS,
  INDICATOR_KEYS,
  sanitizeAllergenIndicatorArray,
} from '@/lib/cheffing/allergensIndicators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('v_cheffing_dish_cost')
    .select('id, name, selling_price, servings, notes, created_at, updated_at, items_cost_total, cost_per_serving')
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  if (!data) {
    const notFound = NextResponse.json({ error: 'Not found' }, { status: 404 });
    mergeResponseCookies(access.supabaseResponse, notFound);
    return notFound;
  }

  const response = NextResponse.json({ data });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const body = await req.json().catch(() => null);
  const sanitizedBody = { ...(typeof body === 'object' && body !== null ? body : {}) } as Record<
    string,
    unknown
  >;

  if (body?.allergens_manual_add !== undefined) {
    const value = sanitizeAllergenIndicatorArray(body.allergens_manual_add, ALLERGEN_KEYS);
    if (!value) {
      const invalid = NextResponse.json({ error: 'Invalid allergens_manual_add' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    sanitizedBody.allergens_manual_add = value;
  }

  if (body?.allergens_manual_exclude !== undefined) {
    const value = sanitizeAllergenIndicatorArray(body.allergens_manual_exclude, ALLERGEN_KEYS);
    if (!value) {
      const invalid = NextResponse.json({ error: 'Invalid allergens_manual_exclude' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    sanitizedBody.allergens_manual_exclude = value;
  }

  if (body?.indicators_manual_add !== undefined) {
    const value = sanitizeAllergenIndicatorArray(body.indicators_manual_add, INDICATOR_KEYS);
    if (!value) {
      const invalid = NextResponse.json({ error: 'Invalid indicators_manual_add' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    sanitizedBody.indicators_manual_add = value;
  }

  if (body?.indicators_manual_exclude !== undefined) {
    const value = sanitizeAllergenIndicatorArray(body.indicators_manual_exclude, INDICATOR_KEYS);
    if (!value) {
      const invalid = NextResponse.json({ error: 'Invalid indicators_manual_exclude' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    sanitizedBody.indicators_manual_exclude = value;
  }

  const parsed = dishUpdateSchema.safeParse(sanitizedBody);

  if (!parsed.success) {
    const invalid = NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cheffing_dishes').update(parsed.data).eq('id', params.id);

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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cheffing_dishes').delete().eq('id', params.id);

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
