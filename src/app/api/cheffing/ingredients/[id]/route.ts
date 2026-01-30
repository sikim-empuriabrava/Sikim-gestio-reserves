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

async function requireCheffingAccess() {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return { response: unauthorized };
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, notAllowed);
    return { response: notAllowed };
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return { response: allowlistError };
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return { response: forbidden };
  }

  if (!isAdmin(allowlistInfo.role) && !allowlistInfo.allowedUser?.can_cheffing) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return { response: forbidden };
  }

  return { supabaseResponse };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingAccess();
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

  if (typeof body?.purchase_unit_code === 'string') {
    const purchaseUnit = body.purchase_unit_code.trim();
    if (!purchaseUnit) {
      const invalid = NextResponse.json({ error: 'Invalid purchase_unit_code' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.purchase_unit_code = purchaseUnit;
  }

  if (body?.purchase_pack_qty !== undefined) {
    if (!isValidNumber(body.purchase_pack_qty) || body.purchase_pack_qty <= 0) {
      const invalid = NextResponse.json({ error: 'Invalid purchase_pack_qty' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.purchase_pack_qty = body.purchase_pack_qty;
  }

  if (body?.purchase_price !== undefined) {
    if (!isValidNumber(body.purchase_price) || body.purchase_price < 0) {
      const invalid = NextResponse.json({ error: 'Invalid purchase_price' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.purchase_price = body.purchase_price;
  }

  if (body?.waste_pct !== undefined) {
    if (!isValidNumber(body.waste_pct) || body.waste_pct < 0 || body.waste_pct >= 1) {
      const invalid = NextResponse.json({ error: 'Invalid waste_pct' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.waste_pct = body.waste_pct;
  }

  if (body?.categories !== undefined) {
    const categories = sanitizeStringArray(body.categories);
    if (!categories) {
      const invalid = NextResponse.json({ error: 'Invalid categories' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.categories = categories;
  }

  if (body?.allergens !== undefined) {
    const allergenCodes = sanitizeAllergenIndicatorArray(body.allergens, ALLERGEN_KEYS);
    if (!allergenCodes) {
      const invalid = NextResponse.json({ error: 'Invalid allergens' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.allergens = allergenCodes;
  }

  if (body?.indicators !== undefined) {
    const indicatorCodes = sanitizeAllergenIndicatorArray(body.indicators, INDICATOR_KEYS);
    if (!indicatorCodes) {
      const invalid = NextResponse.json({ error: 'Invalid indicators' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.indicators = indicatorCodes;
  }

  if (body?.reference !== undefined) {
    if (body.reference !== null && typeof body.reference !== 'string') {
      const invalid = NextResponse.json({ error: 'Invalid reference' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.reference = typeof body.reference === 'string' ? body.reference.trim() || null : null;
  }

  if (body?.stock_unit_code !== undefined) {
    if (body.stock_unit_code !== null && typeof body.stock_unit_code !== 'string') {
      const invalid = NextResponse.json({ error: 'Invalid stock_unit_code' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.stock_unit_code =
      typeof body.stock_unit_code === 'string' ? body.stock_unit_code.trim() || null : null;
  }

  if (body?.stock_qty !== undefined) {
    if (!isValidNumber(body.stock_qty) || body.stock_qty < 0) {
      const invalid = NextResponse.json({ error: 'Invalid stock_qty' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.stock_qty = body.stock_qty;
  }

  if (body?.min_stock_qty !== undefined) {
    if (body.min_stock_qty !== null && (!isValidNumber(body.min_stock_qty) || body.min_stock_qty < 0)) {
      const invalid = NextResponse.json({ error: 'Invalid min_stock_qty' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.min_stock_qty = body.min_stock_qty;
  }

  if (body?.max_stock_qty !== undefined) {
    if (body.max_stock_qty !== null && (!isValidNumber(body.max_stock_qty) || body.max_stock_qty < 0)) {
      const invalid = NextResponse.json({ error: 'Invalid max_stock_qty' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
    updates.max_stock_qty = body.max_stock_qty;
  }

  if (Object.keys(updates).length === 0) {
    const invalid = NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, invalid);
    return invalid;
  }

  const supabase = createSupabaseAdminClient();

  if (updates.min_stock_qty !== undefined || updates.max_stock_qty !== undefined) {
    const updatedMinStockQty = updates.min_stock_qty as number | null | undefined;
    const updatedMaxStockQty = updates.max_stock_qty as number | null | undefined;
    let resolvedMinStockQty: number | null = updatedMinStockQty ?? null;
    let resolvedMaxStockQty: number | null = updatedMaxStockQty ?? null;

    if (updatedMinStockQty === undefined || updatedMaxStockQty === undefined) {
      const { data: current, error: currentError } = await supabase
        .from('cheffing_ingredients')
        .select('min_stock_qty, max_stock_qty')
        .eq('id', params.id)
        .maybeSingle();

      if (currentError || !current) {
        const invalid = NextResponse.json({ error: 'Invalid stock range' }, { status: 400 });
        mergeResponseCookies(access.supabaseResponse, invalid);
        return invalid;
      }

      resolvedMinStockQty = updatedMinStockQty ?? current.min_stock_qty ?? null;
      resolvedMaxStockQty = updatedMaxStockQty ?? current.max_stock_qty ?? null;
    }
    if (resolvedMinStockQty != null && resolvedMaxStockQty != null && resolvedMaxStockQty < resolvedMinStockQty) {
      const invalid = NextResponse.json({ error: 'Invalid stock range' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, invalid);
      return invalid;
    }
  }
  const { error } = await supabase.from('cheffing_ingredients').update(updates).eq('id', params.id);

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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingAccess();
  if (access.response) {
    return access.response;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cheffing_ingredients').delete().eq('id', params.id);

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
