import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import { PROCUREMENT_DOCUMENT_KINDS } from '@/lib/cheffing/procurement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_purchase_documents')
    .select('id, status, document_kind, document_number, document_date, created_at, updated_at, supplier_id, discarded_at, cheffing_suppliers(trade_name), cheffing_purchase_document_lines(id)')
    .order('document_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    const response = NextResponse.json({ error: 'Error loading purchase documents' }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const response = NextResponse.json({ documents: data ?? [] });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}

export async function POST(req: NextRequest) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const body = await req.json().catch(() => null);
  const kind = typeof body?.document_kind === 'string' ? body.document_kind : '';
  const documentDate = typeof body?.document_date === 'string' ? body.document_date : '';

  if (!PROCUREMENT_DOCUMENT_KINDS.includes(kind as (typeof PROCUREMENT_DOCUMENT_KINDS)[number])) {
    const response = NextResponse.json({ error: 'Invalid document_kind' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) {
    const response = NextResponse.json({ error: 'Invalid document_date' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const supplierId = typeof body?.supplier_id === 'string' ? body.supplier_id : null;
  const payload = {
    document_kind: kind,
    document_date: documentDate,
    document_number: typeof body?.document_number === 'string' ? body.document_number.trim() || null : null,
    supplier_id: supplierId,
    status: 'draft' as const,
    validation_notes: typeof body?.validation_notes === 'string' ? body.validation_notes.trim() || null : null,
  };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('cheffing_purchase_documents').insert(payload).select('id').maybeSingle();

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
