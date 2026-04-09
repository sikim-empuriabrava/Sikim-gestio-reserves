import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';
import {
  mergeUniqueSupplierContactValues,
  normalizeSupplierComparable,
  readDraftSupplierContactReview,
} from '@/lib/cheffing/procurementDraftInvariant';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapApplyError(error: { message: string; code?: string }) {
  if (error.code === 'PGRST116') return { status: 404, message: 'Documento no encontrado' };

  const normalized = error.message.toLowerCase();

  if (normalized.includes('not found')) return { status: 404, message: 'Documento no encontrado' };
  if (normalized.includes('only draft documents can be applied')) {
    return { status: 400, message: 'Solo se pueden aplicar documentos en borrador' };
  }
  if (normalized.includes('document requires supplier before apply')) {
    return { status: 400, message: 'No se puede aplicar: falta proveedor' };
  }
  if (normalized.includes('cannot be applied without lines')) {
    return { status: 400, message: 'No se puede aplicar un documento sin líneas' };
  }
  if (normalized.includes('unresolved lines exist')) {
    return { status: 400, message: 'No se puede aplicar: hay líneas sin resolver' };
  }
  if (normalized.includes('require validated ingredient')) {
    return { status: 400, message: 'No se puede aplicar: todas las líneas deben tener ingrediente validado' };
  }
  if (normalized.includes('require raw_unit_price')) {
    return { status: 400, message: 'No se puede aplicar: hay líneas sin coste manual (raw_unit_price)' };
  }

  return { status: 500, message: error.message || 'No se pudo aplicar el documento' };
}

async function applySupplierContactReviewOnApply(params: { supabase: ReturnType<typeof createSupabaseAdminClient>; documentId: string }) {
  const { data: documentRow, error: documentError } = await params.supabase
    .from('cheffing_purchase_documents')
    .select('id, supplier_id, interpreted_payload')
    .eq('id', params.documentId)
    .maybeSingle();

  if (documentError || !documentRow?.supplier_id) return;

  const draftReview = readDraftSupplierContactReview(documentRow.interpreted_payload);
  if (!draftReview) return;

  const { data: supplierRow, error: supplierError } = await params.supabase
    .from('cheffing_suppliers')
    .select('id, tax_id, email, phone')
    .eq('id', documentRow.supplier_id)
    .maybeSingle();

  if (supplierError || !supplierRow) return;

  const supplierUpdates: Record<string, string> = {};

  const finalTaxId = draftReview.tax_id ?? null;
  if (finalTaxId) {
    const existingTaxComparable = normalizeSupplierComparable('tax_id', supplierRow.tax_id);
    const detectedTaxComparable = normalizeSupplierComparable('tax_id', finalTaxId);
    if (!existingTaxComparable) {
      supplierUpdates.tax_id = finalTaxId;
    } else if (detectedTaxComparable && existingTaxComparable !== detectedTaxComparable) {
      console.info('[cheffing][procurement] Supplier tax_id conflict detected on apply; no auto-overwrite', {
        documentId: params.documentId,
        supplierId: documentRow.supplier_id,
      });
    }
  }

  const finalEmail = draftReview.email ?? null;
  if (finalEmail) {
    const existingEmail = supplierRow.email?.trim() || null;
    if (!existingEmail) {
      supplierUpdates.email = finalEmail;
    } else {
      const merged = mergeUniqueSupplierContactValues('email', existingEmail, finalEmail);
      if (merged !== existingEmail) supplierUpdates.email = merged;
    }
  }

  const finalPhone = draftReview.phone ?? null;
  if (finalPhone) {
    const existingPhone = supplierRow.phone?.trim() || null;
    if (!existingPhone) {
      supplierUpdates.phone = finalPhone;
    } else {
      const merged = mergeUniqueSupplierContactValues('phone', existingPhone, finalPhone);
      if (merged !== existingPhone) supplierUpdates.phone = merged;
    }
  }

  if (Object.keys(supplierUpdates).length === 0) return;

  const { error: supplierUpdateError } = await params.supabase
    .from('cheffing_suppliers')
    .update(supplierUpdates)
    .eq('id', documentRow.supplier_id);

  if (supplierUpdateError) {
    console.warn('[cheffing][procurement] Supplier enrichment on apply failed', {
      documentId: params.documentId,
      supplierId: documentRow.supplier_id,
      error: supplierUpdateError.message,
    });
  }
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireCheffingRouteAccess();
  if (access.response) return access.response;

  const authClient = createSupabaseRouteHandlerClient(access.supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const appliedBy = user?.email?.trim().toLowerCase() ?? null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('cheffing_apply_purchase_document', {
    p_document_id: params.id,
    p_applied_by: appliedBy,
  });

  if (error) {
    const mapped = mapApplyError(error);
    const response = NextResponse.json({ error: mapped.message }, { status: mapped.status });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  await applySupplierContactReviewOnApply({ supabase, documentId: params.id });

  const summary = Array.isArray(data) ? data[0] : null;
  const response = NextResponse.json({
    ok: true,
    applied_lines: summary?.applied_lines ?? 0,
    updated_ingredients: summary?.updated_ingredients ?? 0,
  });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
