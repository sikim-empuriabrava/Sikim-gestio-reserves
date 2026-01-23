import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const body = await req.json().catch(() => null);
  const updates: Record<string, unknown> = {};

  if (typeof body?.name === 'string') {
    const name = body.name.trim();
    if (!name) {
      const invalid = NextResponse.json({ error: 'Invalid name' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.name = name;
  }

  if (body?.selling_price !== undefined) {
    if (body.selling_price !== null) {
      if (!isValidNumber(body.selling_price) || body.selling_price < 0) {
        const invalid = NextResponse.json({ error: 'Invalid selling_price' }, { status: 400 });
        mergeResponseCookies(access.supabaseResponse, invalid);
        return invalid;
      }
    }
    updates.selling_price = body.selling_price ?? null;
  }

  if (Object.keys(updates).length === 0) {
    const invalid = NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cheffing_dishes').update(updates).eq('id', params.id);

  if (error) {
    const status = error.message.includes('cheffing_dishes_name_ci_unique') ? 409 : 500;
    const serverError = NextResponse.json({ error: error.message }, { status });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ ok: true });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cheffing_dishes').delete().eq('id', params.id);

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ ok: true });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
