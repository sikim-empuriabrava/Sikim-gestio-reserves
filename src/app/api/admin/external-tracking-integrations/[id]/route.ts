import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminRouteAccess } from '@/lib/auth/requireAdminRoute';
import {
  toExternalTrackingIntegration,
  validateExternalTrackingIntegrationPayload,
} from '@/lib/reservations/externalTrackingIntegrations';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();

function validateId(id: string) {
  return idSchema.safeParse(id).success;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAdminRouteAccess();

  if (!access.ok) {
    return access.response;
  }

  if (!validateId(params.id)) {
    const response = NextResponse.json({ error: 'Integracion no valida.' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const body = await req.json().catch(() => null);
  const parsed = validateExternalTrackingIntegrationPayload(body);

  if (!parsed.success) {
    const response = NextResponse.json({ error: parsed.error }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('external_tracking_integrations')
    .update(parsed.data)
    .eq('id', params.id)
    .select(
      'id, provider, name, enabled, consent_category, trigger_event, meta_pixel_id, google_tag_id, google_ads_conversion_id, google_ads_conversion_label, gtm_container_id, notes, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    console.error('[api/admin/external-tracking-integrations/[id]] Failed to update integration', error);
    const response = NextResponse.json(
      { error: 'No se pudo actualizar la integracion de tracking.' },
      { status: 500 },
    );
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (!data) {
    const response = NextResponse.json({ error: 'Integracion no encontrada.' }, { status: 404 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const response = NextResponse.json({ ok: true, row: toExternalTrackingIntegration(data) });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAdminRouteAccess();

  if (!access.ok) {
    return access.response;
  }

  if (!validateId(params.id)) {
    const response = NextResponse.json({ error: 'Integracion no valida.' }, { status: 400 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('external_tracking_integrations')
    .delete()
    .eq('id', params.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[api/admin/external-tracking-integrations/[id]] Failed to delete integration', error);
    const response = NextResponse.json(
      { error: 'No se pudo eliminar la integracion de tracking.' },
      { status: 500 },
    );
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (!data) {
    const response = NextResponse.json({ error: 'Integracion no encontrada.' }, { status: 404 });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const response = NextResponse.json({ ok: true, id: data.id });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
