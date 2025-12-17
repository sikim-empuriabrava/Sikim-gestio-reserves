import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { session },
  } = await authClient.auth.getSession();

  if (!session) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const date = req.nextUrl.searchParams.get('date');

  if (!date) {
    const missingDate = NextResponse.json({ error: 'Missing date param' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, missingDate);
    return missingDate;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('day_status')
    .select(
      'event_date, validated, is_validated, needs_revalidation, notes_general, notes_kitchen, notes_maintenance, day_notes, cocina_notes, mantenimiento_notes, last_validated_at, last_validated_by, events_last_reviewed_at, last_edited_at'
    )
    .eq('event_date', date)
    .maybeSingle();

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json(data ?? null);
  mergeResponseCookies(supabaseResponse, response);
  return response;
}

export async function POST(req: NextRequest) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { session },
  } = await authClient.auth.getSession();

  if (!session) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const body = await req.json().catch(() => null);
  const date = body?.date ?? body?.eventDate;

  if (!date) {
    const missingEventDate = NextResponse.json({ error: 'Missing date' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, missingEventDate);
    return missingEventDate;
  }

  const action = body?.action as 'save' | 'validate' | undefined;
  const generalNotes = body?.notes_general ?? body?.notesGeneral ?? body?.day_notes;
  const kitchenNotes = body?.notes_kitchen ?? body?.notesKitchen ?? '';
  const maintenanceNotes = body?.notes_maintenance ?? body?.notesMaintenance ?? '';

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    event_date: date,
    notes_kitchen: kitchenNotes,
    notes_maintenance: maintenanceNotes,
    cocina_notes: kitchenNotes,
    mantenimiento_notes: maintenanceNotes,
    last_edited_at: now,
  };

  if (generalNotes !== undefined) {
    payload.notes_general = generalNotes ?? '';
    payload.day_notes = generalNotes ?? '';
  }

  if (action === 'validate') {
    payload.validated = true;
    payload.is_validated = true;
    payload.last_validated_at = now;
    payload.last_validated_by = 'Carla';
    payload.events_last_reviewed_at = now;
  } else {
    payload.validated = false;
    payload.is_validated = false;
  }

  const { data, error } = await supabase
    .from('day_status')
    .upsert(payload, { onConflict: 'event_date' })
    .select()
    .maybeSingle();

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json(data);
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
