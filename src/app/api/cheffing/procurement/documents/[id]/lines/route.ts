import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import { normalizeProcurementCanonicalUnit } from '@/lib/cheffing/procurement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return Number.NaN;
  return value;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const body = await req.json().catch(() => null);
  const rawDescription = typeof body?.raw_description === 'string' ? body.raw_description.trim() : '';

  if (!rawDescription) {
    const response = NextResponse.json({ error: 'raw_description is required' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const supabase = createSupabaseAdminClient();
  const { data: doc, error: docError } = await supabase
    .from('cheffing_purchase_documents')
    .select('status')
    .eq('id', params.id)
    .maybeSingle();

  if (docError || !doc) {
    const response = NextResponse.json({ error: 'Document not found' }, { status: 404 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (doc.status !== 'draft') {
    const response = NextResponse.json({ error: 'Lines can only be added in draft documents' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const { data: lastLine } = await supabase
    .from('cheffing_purchase_document_lines')
    .select('line_number')
    .eq('document_id', params.id)
    .order('line_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const quantity = parseNullableNumber(body?.raw_quantity);
  const unitPrice = parseNullableNumber(body?.raw_unit_price);
  const lineTotal = parseNullableNumber(body?.raw_line_total);
  const validatedUnit = normalizeProcurementCanonicalUnit(body?.validated_unit);

  if (Number.isNaN(quantity) || Number.isNaN(unitPrice) || Number.isNaN(lineTotal) || Number.isNaN(validatedUnit)) {
    const response = NextResponse.json({ error: 'Invalid line payload values' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const payload = {
    document_id: params.id,
    line_number: (lastLine?.line_number ?? 0) + 1,
    raw_description: rawDescription,
    raw_quantity: quantity,
    raw_unit: typeof body?.raw_unit === 'string' ? body.raw_unit.trim() || null : null,
    validated_unit: validatedUnit,
    raw_unit_price: unitPrice,
    raw_line_total: lineTotal,
    validated_ingredient_id: typeof body?.validated_ingredient_id === 'string' ? body.validated_ingredient_id : null,
    line_status: body?.line_status === 'resolved' ? 'resolved' : 'unresolved',
    warning_notes: typeof body?.warning_notes === 'string' ? body.warning_notes.trim() || null : null,
    user_note: typeof body?.user_note === 'string' ? body.user_note.trim() || null : null,
  };

  const { data, error } = await supabase.from('cheffing_purchase_document_lines').insert(payload).select('id').maybeSingle();

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
