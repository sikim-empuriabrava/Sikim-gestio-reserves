import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import { PROCUREMENT_DOCUMENT_KINDS, PROCUREMENT_DOCUMENT_STATUSES } from '@/lib/cheffing/procurement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_purchase_documents')
    .select('id, supplier_id, document_kind, document_number, document_date, effective_at, status, validation_notes, applied_at, applied_by, created_at, updated_at, cheffing_suppliers(trade_name), cheffing_purchase_document_lines(id, line_number, raw_description, raw_quantity, raw_unit, raw_unit_price, raw_line_total, validated_ingredient_id, line_status, warning_notes, cheffing_ingredients(name))')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) {
    const response = NextResponse.json({ error: 'Document not found' }, { status: 404 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const response = NextResponse.json({ document: data });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const body = await req.json().catch(() => null);
  const updates: Record<string, string | null> = {};

  if (body?.document_kind !== undefined) {
    if (
      typeof body.document_kind !== 'string' ||
      !PROCUREMENT_DOCUMENT_KINDS.includes(body.document_kind as (typeof PROCUREMENT_DOCUMENT_KINDS)[number])
    ) {
      const response = NextResponse.json({ error: 'Invalid document_kind' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    updates.document_kind = body.document_kind;
  }

  if (body?.status !== undefined) {
    if (
      typeof body.status !== 'string' ||
      !PROCUREMENT_DOCUMENT_STATUSES.includes(body.status as (typeof PROCUREMENT_DOCUMENT_STATUSES)[number])
    ) {
      const response = NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    if (body.status === 'applied') {
      const response = NextResponse.json({ error: 'Use apply action to set document as applied' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    updates.status = body.status;
  }

  if (body?.document_number !== undefined) {
    updates.document_number = typeof body.document_number === 'string' ? body.document_number.trim() || null : null;
  }

  if (body?.document_date !== undefined) {
    if (typeof body.document_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.document_date)) {
      const response = NextResponse.json({ error: 'Invalid document_date' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    updates.document_date = body.document_date;
  }

  if (body?.supplier_id !== undefined) {
    if (body.supplier_id !== null && typeof body.supplier_id !== 'string') {
      const response = NextResponse.json({ error: 'Invalid supplier_id' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    updates.supplier_id = body.supplier_id;
  }

  if (body?.validation_notes !== undefined) {
    updates.validation_notes = typeof body.validation_notes === 'string' ? body.validation_notes.trim() || null : null;
  }

  if (Object.keys(updates).length === 0) {
    const response = NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const supabase = createSupabaseAdminClient();

  if (updates.status && updates.status !== 'draft') {
    const { data: current, error: currentError } = await supabase
      .from('cheffing_purchase_documents')
      .select('status')
      .eq('id', params.id)
      .maybeSingle();
    if (currentError || !current) {
      const response = NextResponse.json({ error: 'Document not found' }, { status: 404 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    if (current.status !== 'draft') {
      const response = NextResponse.json({ error: 'Only draft documents can be changed' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
  }

  const { error } = await supabase.from('cheffing_purchase_documents').update(updates).eq('id', params.id);
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
