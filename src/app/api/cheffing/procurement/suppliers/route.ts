import { NextRequest, NextResponse } from 'next/server';

import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import { normalizeProcurementText } from '@/lib/cheffing/procurement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_suppliers')
    .select('id, trade_name, legal_name, tax_id, phone, email, is_active, created_at, updated_at')
    .order('trade_name', { ascending: true });

  if (error) {
    const response = NextResponse.json({ error: 'Error loading suppliers' }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const response = NextResponse.json({ suppliers: data ?? [] });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}

export async function POST(req: NextRequest) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const body = await req.json().catch(() => null);
  const tradeName = typeof body?.trade_name === 'string' ? body.trade_name.trim() : '';
  if (!tradeName) {
    const response = NextResponse.json({ error: 'trade_name is required' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const payload = {
    trade_name: tradeName,
    legal_name: typeof body?.legal_name === 'string' ? body.legal_name.trim() || null : null,
    tax_id: typeof body?.tax_id === 'string' ? body.tax_id.trim() || null : null,
    normalized_tax_id:
      typeof body?.tax_id === 'string' ? normalizeProcurementText(body.tax_id.replace(/[^a-zA-Z0-9]/g, '')) : null,
    normalized_name: normalizeProcurementText(tradeName),
    phone: typeof body?.phone === 'string' ? body.phone.trim() || null : null,
    email: typeof body?.email === 'string' ? body.email.trim() || null : null,
    is_active: typeof body?.is_active === 'boolean' ? body.is_active : true,
  };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_suppliers')
    .insert(payload)
    .select('id')
    .maybeSingle();

  if (error) {
    const mapped = mapCheffingPostgresError(error);
    const response = NextResponse.json({ error: mapped.message }, { status: mapped.status });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const response = NextResponse.json({ ok: true, id: data?.id ?? null });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
