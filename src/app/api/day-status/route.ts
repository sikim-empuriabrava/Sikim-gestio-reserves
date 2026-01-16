import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStoreHeaders = { 'Cache-Control': 'no-store' };

const dayStatusSelect =
  'event_date, validated, is_validated, needs_revalidation, notes_general, notes_kitchen, notes_maintenance, day_notes, last_validated_at, last_validated_by, events_last_reviewed_at, last_edited_at';

export async function GET(req: NextRequest) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, notAllowed);
    return notAllowed;
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  const date = req.nextUrl.searchParams.get('date');

  if (!date) {
    const missingDate = NextResponse.json({ error: 'Missing date param' }, { status: 400 });
    mergeResponseCookies(supabaseResponse, missingDate);
    return missingDate;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('v_day_status')
    .select(dayStatusSelect)
    .eq('event_date', date)
    .maybeSingle();

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json(data ?? null, { headers: noStoreHeaders });
  mergeResponseCookies(supabaseResponse, response);
  return response;
}

export async function POST(req: NextRequest) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, notAllowed);
    return notAllowed;
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500 });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active || !isAdmin(allowlistInfo.role)) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
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
  const kitchenNotes = body?.notes_kitchen ?? body?.notesKitchen;
  const maintenanceNotes = body?.notes_maintenance ?? body?.notesMaintenance;
  const hasOnlyDayNotes =
    action === undefined &&
    body?.day_notes !== undefined &&
    body?.notes_general === undefined &&
    body?.notesGeneral === undefined &&
    body?.notes_kitchen === undefined &&
    body?.notesKitchen === undefined &&
    body?.notes_maintenance === undefined &&
    body?.notesMaintenance === undefined;
  const resolvedAction: 'save' | 'validate' = action ?? (hasOnlyDayNotes ? 'validate' : 'save');

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    event_date: date,
    last_edited_at: now,
  };

  if (kitchenNotes !== undefined) {
    payload.notes_kitchen = kitchenNotes ?? '';
  }

  if (maintenanceNotes !== undefined) {
    payload.notes_maintenance = maintenanceNotes ?? '';
  }

  if (generalNotes !== undefined) {
    payload.notes_general = generalNotes ?? '';
  }

  if (resolvedAction === 'validate') {
    payload.validated = true;
    payload.is_validated = true;
    payload.last_validated_at = now;
    payload.last_validated_by = requesterEmail;
    payload.events_last_reviewed_at = now;
  }

  const { error: upsertError } = await supabase.from('day_status').upsert(payload, {
    onConflict: 'event_date',
  });

  if (upsertError) {
    const serverError = NextResponse.json({ error: upsertError.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const { data, error } = await supabase
    .from('v_day_status')
    .select(dayStatusSelect)
    .eq('event_date', date)
    .maybeSingle();

  if (error) {
    const serverError = NextResponse.json({ error: error.message }, { status: 500 });
    mergeResponseCookies(supabaseResponse, serverError);
    return serverError;
  }

  const response = NextResponse.json(data ?? null, { headers: noStoreHeaders });
  mergeResponseCookies(supabaseResponse, response);
  return response;
}
