import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import { mapCheffingPostgresError } from '@/lib/cheffing/postgresErrors';
import { PROCUREMENT_DOCUMENT_KINDS, PROCUREMENT_DOCUMENT_STATUSES } from '@/lib/cheffing/procurement';
import { upsertPossibleDocumentDuplicateSignal } from '@/lib/cheffing/procurementDuplicateSignal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeSupplierComparable(field: 'tax_id' | 'email' | 'phone', value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (field === 'tax_id') return trimmed.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (field === 'email') return trimmed.toLowerCase();
  return trimmed.replace(/[^\d+]/g, '');
}

function mergeUniqueSupplierContactValues(field: 'email' | 'phone', existingValue: string, detectedValue: string): string {
  const splitRegex = /[;,|/]+/;
  const values = `${existingValue}${field === 'email' ? ';' : ' / '}${detectedValue}`
    .split(splitRegex)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeSupplierComparable(field, value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(value);
  }

  return unique.join(field === 'email' ? '; ' : ' / ');
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cheffing_purchase_documents')
    .select('id, supplier_id, document_kind, document_number, document_date, effective_at, status, validation_notes, declared_total, applied_at, applied_by, storage_bucket, storage_path, ocr_raw_text, interpreted_payload, created_at, updated_at, cheffing_suppliers(trade_name), cheffing_purchase_document_lines(id, line_number, raw_description, interpreted_description, raw_quantity, raw_unit, interpreted_quantity, interpreted_unit, normalized_unit_code, validated_unit, raw_unit_price, raw_line_total, suggested_ingredient_id, validated_ingredient_id, line_status, warning_notes, user_note, validated_ingredient:cheffing_ingredients!cheffing_purchase_document_lines_validated_ingredient_id_fkey(name))')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) {
    const response = NextResponse.json({ error: 'Document not found' }, { status: 404 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  let sourceFileUrl: string | null = null;
  if (data.storage_bucket && data.storage_path) {
    const { data: signedData, error: signedError } = await supabase.storage.from(data.storage_bucket).createSignedUrl(data.storage_path, 60 * 60);
    if (!signedError) sourceFileUrl = signedData.signedUrl;
  }

  const response = NextResponse.json({ document: data, sourceFileUrl });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const body = await req.json().catch(() => null);
  const updates: Record<string, string | number | null> = {};

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

  if (body?.declared_total !== undefined) {
    if (body.declared_total !== null && (typeof body.declared_total !== 'number' || Number.isNaN(body.declared_total) || body.declared_total < 0)) {
      const response = NextResponse.json({ error: 'Invalid declared_total' }, { status: 400 });
      mergeResponseCookies(access.supabaseResponse, response);
      return response;
    }
    updates.declared_total = body.declared_total;
  }

  if (Object.keys(updates).length === 0) {
    const response = NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const supabase = createSupabaseAdminClient();
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

  const { error } = await supabase.from('cheffing_purchase_documents').update(updates).eq('id', params.id);
  if (error) {
    const mapped = mapCheffingPostgresError(error);
    const response = NextResponse.json({ error: mapped.message }, { status: mapped.status });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const confirmedSupplierId = typeof updates.supplier_id === 'string' ? updates.supplier_id : null;
  if (confirmedSupplierId) {
    const { data: updatedDocument, error: updatedDocumentError } = await supabase
      .from('cheffing_purchase_documents')
      .select('id, interpreted_payload')
      .eq('id', params.id)
      .maybeSingle();

    if (!updatedDocumentError && updatedDocument) {
      const payload =
        updatedDocument.interpreted_payload && typeof updatedDocument.interpreted_payload === 'object'
          ? (updatedDocument.interpreted_payload as Record<string, unknown>)
          : null;
      const detectedSupplier =
        payload?.supplier_detected && typeof payload.supplier_detected === 'object'
          ? (payload.supplier_detected as Record<string, unknown>)
          : null;

      if (detectedSupplier) {
        const detectedTaxId = typeof detectedSupplier.tax_id === 'string' ? detectedSupplier.tax_id.trim() || null : null;
        const detectedEmail = typeof detectedSupplier.email === 'string' ? detectedSupplier.email.trim() || null : null;
        const detectedPhone = typeof detectedSupplier.phone === 'string' ? detectedSupplier.phone.trim() || null : null;

        const { data: supplierRow, error: supplierError } = await supabase
          .from('cheffing_suppliers')
          .select('id, tax_id, email, phone')
          .eq('id', confirmedSupplierId)
          .maybeSingle();

        if (!supplierError && supplierRow) {
          const supplierUpdates: Record<string, string> = {};

          if (detectedTaxId) {
            const existingTaxComparable = normalizeSupplierComparable('tax_id', supplierRow.tax_id);
            const detectedTaxComparable = normalizeSupplierComparable('tax_id', detectedTaxId);
            if (!existingTaxComparable) {
              supplierUpdates.tax_id = detectedTaxId;
            } else if (detectedTaxComparable && existingTaxComparable !== detectedTaxComparable) {
              console.info('[cheffing][procurement] Supplier tax_id conflict detected on header save; no auto-overwrite', {
                documentId: params.id,
                supplierId: confirmedSupplierId,
              });
            }
          }

          if (detectedEmail) {
            const existingEmail = supplierRow.email?.trim() || null;
            if (!existingEmail) {
              supplierUpdates.email = detectedEmail;
            } else {
              const merged = mergeUniqueSupplierContactValues('email', existingEmail, detectedEmail);
              if (merged !== existingEmail) supplierUpdates.email = merged;
            }
          }

          if (detectedPhone) {
            const existingPhone = supplierRow.phone?.trim() || null;
            if (!existingPhone) {
              supplierUpdates.phone = detectedPhone;
            } else {
              const merged = mergeUniqueSupplierContactValues('phone', existingPhone, detectedPhone);
              if (merged !== existingPhone) supplierUpdates.phone = merged;
            }
          }

          if (Object.keys(supplierUpdates).length > 0) {
            const { error: supplierUpdateError } = await supabase
              .from('cheffing_suppliers')
              .update(supplierUpdates)
              .eq('id', confirmedSupplierId);
            if (supplierUpdateError) {
              console.warn('[cheffing][procurement] Supplier enrichment on header save failed', {
                documentId: params.id,
                supplierId: confirmedSupplierId,
                error: supplierUpdateError.message,
              });
            }
          }
        }
      }
    }
  }

  try {
    await upsertPossibleDocumentDuplicateSignal({ supabase, documentId: params.id });
  } catch (signalError) {
    console.warn('[cheffing][procurement] Duplicate signal check failed on document patch', {
      documentId: params.id,
      error: signalError instanceof Error ? signalError.message : 'unknown',
    });
  }

  const response = NextResponse.json({ ok: true });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const supabase = createSupabaseAdminClient();
  const { data: current, error: currentError } = await supabase
    .from('cheffing_purchase_documents')
    .select('status, storage_bucket, storage_path')
    .eq('id', params.id)
    .maybeSingle();

  if (currentError || !current) {
    const response = NextResponse.json({ error: 'Document not found' }, { status: 404 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (current.status === 'applied') {
    const response = NextResponse.json({ error: 'Applied documents cannot be permanently deleted' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (current.storage_bucket && current.storage_path) {
    const { error: storageDeleteError } = await supabase.storage.from(current.storage_bucket).remove([current.storage_path]);
    if (storageDeleteError) {
      if (storageDeleteError.message?.toLowerCase().includes('not found')) {
        console.warn('[cheffing][procurement] Source file already missing in storage before permanent delete', {
          documentId: params.id,
          bucket: current.storage_bucket,
          path: current.storage_path,
        });
      } else {
        console.error('[cheffing][procurement] Failed to remove source file from storage during permanent delete', {
          documentId: params.id,
          bucket: current.storage_bucket,
          path: current.storage_path,
          error: storageDeleteError.message,
        });
        const response = NextResponse.json(
          { error: 'Could not delete source file from storage. Document was not deleted.' },
          { status: 500 },
        );
        mergeResponseCookies(access.supabaseResponse, response);
        return response;
      }
    }
  }

  const { error } = await supabase.from('cheffing_purchase_documents').delete().eq('id', params.id);
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
