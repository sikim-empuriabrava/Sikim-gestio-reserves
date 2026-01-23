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
  const outputUnit = typeof body?.output_unit_code === 'string' ? body.output_unit_code.trim() : '';
  const outputQty = body?.output_qty;
  const wastePct = body?.waste_pct;

  if (!name || !outputUnit) {
    const missing = NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, missing);
    return missing;
  }

  if (!isValidNumber(outputQty) || outputQty <= 0) {
    const invalid = NextResponse.json({ error: 'Invalid output_qty' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  if (!isValidNumber(wastePct) || wastePct < 0 || wastePct >= 1) {
    const invalid = NextResponse.json({ error: 'Invalid waste_pct' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_subrecipes')
    .insert({
      name,
      output_unit_code: outputUnit,
      output_qty: outputQty,
      waste_pct: wastePct,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    const status = error.message.includes('cheffing_subrecipes_name_ci_unique') ? 409 : 500;
    const serverError = NextResponse.json({ error: error.message }, { status });
    mergeResponseCookies(access.supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ ok: true, id: data?.id ?? null });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
