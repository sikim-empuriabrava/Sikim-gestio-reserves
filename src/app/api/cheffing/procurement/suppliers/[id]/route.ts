import { NextRequest, NextResponse } from 'next/server';

import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import { normalizeProcurementText } from '@/lib/cheffing/procurement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const body = await req.json().catch(() => null);
  const updates: Record<string, string | boolean | null> = {};

  if (typeof body?.trade_name === 'string') {
    const tradeName = body.trade_name.trim();
    if (!tradeName) {
      const response = NextResponse.json({ error: 'Invalid trade_name' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    updates.trade_name = tradeName;
    updates.normalized_name = normalizeProcurementText(tradeName);
  }

  if (body?.legal_name !== undefined) updates.legal_name = typeof body.legal_name === 'string' ? body.legal_name.trim() || null : null;
  if (body?.tax_id !== undefined) {
    if (body.tax_id !== null && typeof body.tax_id !== 'string') {
      const response = NextResponse.json({ error: 'Invalid tax_id' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    updates.tax_id = typeof body.tax_id === 'string' ? body.tax_id.trim() || null : null;
    updates.normalized_tax_id = typeof body.tax_id === 'string' ? normalizeProcurementText(body.tax_id.replace(/[^a-zA-Z0-9]/g, '')) : null;
  }
  if (body?.phone !== undefined) updates.phone = typeof body.phone === 'string' ? body.phone.trim() || null : null;
  if (body?.email !== undefined) updates.email = typeof body.email === 'string' ? body.email.trim() || null : null;
  if (body?.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') {
      const response = NextResponse.json({ error: 'Invalid is_active' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0) {
    const response = NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cheffing_suppliers').update(updates).eq('id', params.id);

  if (error) {
    const mapped = mapCheffingPostgresError(error);
    const response = NextResponse.json({ error: mapped.message }, { status: mapped.status });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
