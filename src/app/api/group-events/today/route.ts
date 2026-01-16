import { NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleForUserEmail } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
    mergeResponseCookies(supabaseResponse, unauthorized);
    return unauthorized;
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    const notAllowed = NextResponse.json({ error: 'Not allowed' }, { status: 403, headers: noStoreHeaders });
    mergeResponseCookies(supabaseResponse, notAllowed);
    return notAllowed;
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (allowlistInfo.error) {
    const allowlistError = NextResponse.json({ error: 'Allowlist check failed' }, { status: 500, headers: noStoreHeaders });
    mergeResponseCookies(supabaseResponse, allowlistError);
    return allowlistError;
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active) {
    const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: noStoreHeaders });
    mergeResponseCookies(supabaseResponse, forbidden);
    return forbidden;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const today = todayIsoDate();

    const { data, error } = await supabase
      .from('group_events')
      .select(
        `id, name, event_date, entry_time, adults, children, total_pax, status, menu_text, second_course_type, seconds_confirmed, allergens_and_diets, extras, setup_notes, has_private_dining_room, has_private_party`
      )
      .eq('event_date', today)
      .order('entry_time', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      const serverError = NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders });
      mergeResponseCookies(supabaseResponse, serverError);
      return serverError;
    }

    const response = NextResponse.json({ data }, { headers: noStoreHeaders });
    mergeResponseCookies(supabaseResponse, response);
    return response;
  } catch (e) {
    console.error('[API] group-events/today', e);
    const unexpected = NextResponse.json(
      { error: "Unexpected error while fetching today's group events" },
      { status: 500, headers: noStoreHeaders },
    );
    mergeResponseCookies(supabaseResponse, unexpected);
    return unexpected;
  }
}
