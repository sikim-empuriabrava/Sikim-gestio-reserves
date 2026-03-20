import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import { dishUpdateSchema } from '@/lib/cheffing/schemas';
import {
  DISH_INDICATOR_KEYS,
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
  const parsed = dishUpdateSchema.safeParse(
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {},
  );

  if (!parsed.success) {
    const invalid = NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const updates: Record<string, unknown> = { ...parsed.data };

  if ('indicator_codes' in updates) {
    const sanitized = sanitizeAllergenIndicatorArray(updates.indicator_codes, DISH_INDICATOR_KEYS);
    if (!sanitized) {
      const invalid = NextResponse.json({ error: 'Invalid indicator_codes' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.indicator_codes = sanitized;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cheffing_dishes').update(updates).eq('id', params.id);

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
