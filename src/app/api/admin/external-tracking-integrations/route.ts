import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRouteAccess } from '@/lib/auth/requireAdminRoute';
import {
  loadExternalTrackingIntegrations,
  toExternalTrackingIntegration,
  validateExternalTrackingIntegrationPayload,
} from '@/lib/reservations/externalTrackingIntegrations';
import { mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireAdminRouteAccess();

  if (!access.ok) {
    return access.response;
  }

  try {
    const rows = await loadExternalTrackingIntegrations();
    const response = NextResponse.json({ ok: true, rows });
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  } catch (error) {
    console.error('[api/admin/external-tracking-integrations] Failed to load integrations', error);
    const response = NextResponse.json(
      { error: 'No se pudieron cargar las integraciones de tracking.' },
      { status: 500 },
    );
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }
}

export async function POST(req: NextRequest) {
  const access = await requireAdminRouteAccess();

  if (!access.ok) {
    return access.response;
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
    .insert(parsed.data)
    .select(
      'id, provider, name, enabled, consent_category, trigger_event, meta_pixel_id, google_tag_id, google_ads_conversion_id, google_ads_conversion_label, gtm_container_id, notes, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    console.error('[api/admin/external-tracking-integrations] Failed to create integration', error);
    const response = NextResponse.json(
      { error: 'No se pudo crear la integracion de tracking.' },
      { status: 500 },
    );
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  if (!data) {
    const response = NextResponse.json(
      { error: 'No se pudo crear la integracion de tracking.' },
      { status: 500 },
    );
    mergeResponseCookies(access.supabaseResponse, response);
    return response;
  }

  const response = NextResponse.json({ ok: true, row: toExternalTrackingIntegration(data) });
  mergeResponseCookies(access.supabaseResponse, response);
  return response;
}
