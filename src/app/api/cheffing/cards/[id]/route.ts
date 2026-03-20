import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import { cheffingCardUpdateSchema } from '@/lib/cheffing/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const body = await req.json().catch(() => null);
  const parsed = cheffingCardUpdateSchema.safeParse(body);

  if (!parsed.success) {
    const invalid = NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cheffing_cards').update(parsed.data).eq('id', params.id);

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
  if (access.response) return access.response;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cheffing_cards').delete().eq('id', params.id);

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
