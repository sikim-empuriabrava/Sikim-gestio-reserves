import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import { cheffingConsumerItemSchema } from '@/lib/cheffing/schemas';
import { parsePortionMultiplier } from '@/lib/cheffing/portionMultiplier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_menu_items')
    .select('id, menu_id, dish_id, multiplier, sort_order, notes, created_at, updated_at')
    .eq('menu_id', params.id)
    .order('sort_order', { ascending: true })
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
  if (access.response) return access.response;

  const body = await req.json().catch(() => null);
  const parsed = cheffingConsumerItemSchema.safeParse(body);

  if (!parsed.success) {
    const invalid = NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const multiplier = parsePortionMultiplier(parsed.data.multiplier);
  if (multiplier === null) {
    const invalid = NextResponse.json({ error: 'El multiplicador debe ser mayor que 0.' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_menu_items')
    .insert({
      menu_id: params.id,
      dish_id: parsed.data.dish_id,
      multiplier,
      sort_order: parsed.data.sort_order ?? 0,
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
