import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function POST(req: NextRequest) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, notAllowed);
    return notAllowed;
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  if (!isAdmin(allowlistInfo.role) && !allowlistInfo.allowedUser?.can_cheffing) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const purchaseUnit = typeof body?.purchase_unit_code === 'string' ? body.purchase_unit_code.trim() : '';
  const packQty = body?.purchase_pack_qty;
  const price = body?.purchase_price;
  const wastePct = body?.waste_pct;

  if (!name || !purchaseUnit) {
    const missing = NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, missing);
    return missing;
  }

  if (!isValidNumber(packQty) || packQty <= 0) {
    const invalid = NextResponse.json({ error: 'Invalid purchase_pack_qty' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalid);
    return invalid;
  }

  if (!isValidNumber(price) || price < 0) {
    const invalid = NextResponse.json({ error: 'Invalid purchase_price' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalid);
    return invalid;
  }

  if (!isValidNumber(wastePct) || wastePct < 0 || wastePct > 1) {
    const invalid = NextResponse.json({ error: 'Invalid waste_pct' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalid);
    return invalid;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_ingredients')
    .insert({
      name,
      purchase_unit_code: purchaseUnit,
      purchase_pack_qty: packQty,
      purchase_price: price,
      waste_pct: wastePct,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ ok: true, id: data?.id ?? null });
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
