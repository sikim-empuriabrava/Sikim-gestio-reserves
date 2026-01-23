import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function POST(req: NextRequest) {
  const access = await requireCheffingRouteAccess();
  if (access.response) {
    return access.response;
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const sellingPrice = body?.selling_price;

  if (!name) {
    const missing = NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, missing);
    return missing;
  }

  if (sellingPrice !== undefined && sellingPrice !== null) {
    if (!isValidNumber(sellingPrice) || sellingPrice < 0) {
      const invalid = NextResponse.json({ error: 'Invalid selling_price' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_dishes')
    .insert({
      name,
      selling_price: sellingPrice ?? null,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    const status = error.message.includes('cheffing_dishes_name_ci_unique') ? 409 : 500;
    const serverError = NextResponse.json({ error: error.message }, { status });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ ok: true, id: data?.id ?? null });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
