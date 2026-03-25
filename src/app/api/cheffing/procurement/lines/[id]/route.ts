import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return Number.NaN;
  return value;
}

async function ensureDraftDocument(lineId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_purchase_document_lines')
    .select('document_id')
    .eq('id', lineId)
    .maybeSingle();

  if (error || !data?.document_id) return { ok: false as const, code: 404 };

  const { data: document, error: documentError } = await supabase
    .from('cheffing_purchase_documents')
    .select('status')
    .eq('id', data.document_id)
    .maybeSingle();

  if (documentError || !document) return { ok: false as const, code: 404 };
  if (document.status !== 'draft') return { ok: false as const, code: 400 };

  return { ok: true as const, supabase };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const draftCheck = await ensureDraftDocument(params.id);
  if (!draftCheck.ok) {
    const response = NextResponse.json(
      { error: draftCheck.code === 404 ? 'Line not found' : 'Only draft documents can update lines' },
      { status: draftCheck.code },
    );
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const body = await req.json().catch(() => null);
  const updates: Record<string, string | number | null> = {};

  if (body?.raw_description !== undefined) {
    if (typeof body.raw_description !== 'string' || !body.raw_description.trim()) {
      const response = NextResponse.json({ error: 'Invalid raw_description' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    updates.raw_description = body.raw_description.trim();
  }

  if (body?.raw_quantity !== undefined) {
    const parsed = parseNullableNumber(body.raw_quantity);
    if (Number.isNaN(parsed)) {
      const response = NextResponse.json({ error: 'Invalid raw_quantity' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    updates.raw_quantity = parsed;
  }

  if (body?.raw_unit !== undefined) {
    updates.raw_unit = typeof body.raw_unit === 'string' ? body.raw_unit.trim() || null : null;
  }
  if (body?.raw_unit_price !== undefined) {
    const parsed = parseNullableNumber(body.raw_unit_price);
    if (Number.isNaN(parsed)) {
      const response = NextResponse.json({ error: 'Invalid raw_unit_price' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    updates.raw_unit_price = parsed;
  }
  if (body?.raw_line_total !== undefined) {
    const parsed = parseNullableNumber(body.raw_line_total);
    if (Number.isNaN(parsed)) {
      const response = NextResponse.json({ error: 'Invalid raw_line_total' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    updates.raw_line_total = parsed;
  }

  if (body?.validated_ingredient_id !== undefined) {
    if (body.validated_ingredient_id !== null && typeof body.validated_ingredient_id !== 'string') {
      const response = NextResponse.json({ error: 'Invalid validated_ingredient_id' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    updates.validated_ingredient_id = body.validated_ingredient_id;
  }

  if (body?.warning_notes !== undefined) {
    updates.warning_notes = typeof body.warning_notes === 'string' ? body.warning_notes.trim() || null : null;
  }

  if (body?.line_status !== undefined) {
    if (body.line_status !== 'unresolved' && body.line_status !== 'resolved') {
      const response = NextResponse.json({ error: 'Invalid line_status' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    updates.line_status = body.line_status;
  }

  if (
    (updates.line_status === 'resolved' || body?.line_status === 'resolved') &&
    updates.validated_ingredient_id === null
  ) {
    const response = NextResponse.json({ error: 'Resolved lines require validated ingredient' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (Object.keys(updates).length === 0) {
    const response = NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const { error } = await draftCheck.supabase.from('cheffing_purchase_document_lines').update(updates).eq('id', params.id);

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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const draftCheck = await ensureDraftDocument(params.id);
  if (!draftCheck.ok) {
    const response = NextResponse.json(
      { error: draftCheck.code === 404 ? 'Line not found' : 'Only draft documents can delete lines' },
      { status: draftCheck.code },
    );
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const { error } = await draftCheck.supabase.from('cheffing_purchase_document_lines').delete().eq('id', params.id);
  if (error) {
    const response = NextResponse.json({ error: 'Could not delete line' }, { status: 500 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
