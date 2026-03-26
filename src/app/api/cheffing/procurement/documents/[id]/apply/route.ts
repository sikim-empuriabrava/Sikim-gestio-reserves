import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { requireCheffingRouteAccess } from '@/lib/cheffing/requireCheffingRoute';

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

  const summary = Array.isArray(data) ? data[0] : null;
  const response = NextResponse.json({
    ok: true,
    applied_lines: summary?.applied_lines ?? 0,
    updated_ingredients: summary?.updated_ingredients ?? 0,
  });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
