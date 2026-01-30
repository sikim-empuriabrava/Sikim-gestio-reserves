import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import {
  ALLERGEN_KEYS,
  INDICATOR_KEYS,
  sanitizeAllergenIndicatorArray,
} from '@/lib/cheffing/allergensIndicators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const cleaned = value
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter(Boolean);
  return Array.from(new Set(cleaned));
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
  const categoriesInput = body?.categories;
  const referenceInput = body?.reference;
  const stockUnitInput = body?.stock_unit_code;
  const stockQty = body?.stock_qty;
  const minStockQty = body?.min_stock_qty;
  const maxStockQty = body?.max_stock_qty;
  const allergenInput = body?.allergens;
  const indicatorInput = body?.indicators;

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

  if (!isValidNumber(wastePct) || wastePct < 0 || wastePct >= 1) {
    const invalid = NextResponse.json({ error: 'Invalid waste_pct' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalid);
    return invalid;
  }

  const categories = categoriesInput === undefined ? [] : sanitizeStringArray(categoriesInput);
  if (categories === null) {
    const invalid = NextResponse.json({ error: 'Invalid categories' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalid);
    return invalid;
  }

  const allergenCodes =
    allergenInput === undefined ? [] : sanitizeAllergenIndicatorArray(allergenInput, ALLERGEN_KEYS);
  if (allergenCodes === null) {
    const invalid = NextResponse.json({ error: 'Invalid allergens' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalid);
    return invalid;
  }

  const indicatorCodes =
    indicatorInput === undefined ? [] : sanitizeAllergenIndicatorArray(indicatorInput, INDICATOR_KEYS);
  if (indicatorCodes === null) {
    const invalid = NextResponse.json({ error: 'Invalid indicators' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalid);
    return invalid;
  }

  const reference = typeof referenceInput === 'string' ? referenceInput.trim() : '';
  const stockUnitCode = typeof stockUnitInput === 'string' ? stockUnitInput.trim() : '';

  const resolvedStockQty = stockQty === undefined ? 0 : stockQty;
  if (!isValidNumber(resolvedStockQty) || resolvedStockQty < 0) {
    const invalid = NextResponse.json({ error: 'Invalid stock_qty' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalid);
    return invalid;
  }

  const resolvedMinStockQty = minStockQty === undefined || minStockQty === null ? null : minStockQty;
  if (resolvedMinStockQty !== null && (!isValidNumber(resolvedMinStockQty) || resolvedMinStockQty < 0)) {
    const invalid = NextResponse.json({ error: 'Invalid min_stock_qty' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalid);
    return invalid;
  }

  const resolvedMaxStockQty = maxStockQty === undefined || maxStockQty === null ? null : maxStockQty;
  if (resolvedMaxStockQty !== null && (!isValidNumber(resolvedMaxStockQty) || resolvedMaxStockQty < 0)) {
    const invalid = NextResponse.json({ error: 'Invalid max_stock_qty' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, invalid);
    return invalid;
  }

  if (
    resolvedMinStockQty !== null &&
    resolvedMaxStockQty !== null &&
    resolvedMaxStockQty < resolvedMinStockQty
  ) {
    const invalid = NextResponse.json({ error: 'Invalid stock range' }, { status: 400 });
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
      categories,
      reference: reference || null,
      stock_unit_code: stockUnitCode || null,
      stock_qty: resolvedStockQty,
      min_stock_qty: resolvedMinStockQty,
      max_stock_qty: resolvedMaxStockQty,
      allergens: allergenCodes,
      indicators: indicatorCodes,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    const mapped = mapCheffingPostgresError(error);
    const serverError = NextResponse.json({ error: mapped.message }, { status: mapped.status });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json({ ok: true, id: data?.id ?? null });
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
