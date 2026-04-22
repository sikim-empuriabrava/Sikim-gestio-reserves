import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';
import { isValidGroupEventStatus } from '@/lib/groupEvents/status';
import { parseMenuAssignments, syncCheffingMenuAssignments } from '@/lib/groupEvents/menuAssignments';

export const runtime = 'nodejs';

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

  try {
    const body = await req.json();
    const { id, menuAssignments, ...payload } = body ?? {};

    if (!id) {
      const missingId = NextResponse.json({ error: 'Missing id' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, missingId);
      return missingId;
    }

    const updateData: Record<string, unknown> = { ...payload };

    const parsedMenuAssignments = parseMenuAssignments(menuAssignments);

    // Campos que NUNCA debemos actualizar desde la API
    delete updateData.total_pax;
    delete updateData.totalPax;
    delete updateData.created_at;
    delete updateData.updated_at;

    // Mantenemos updated_at siempre coherente
    updateData.updated_at = new Date().toISOString();

    if (updateData.status !== undefined && !isValidGroupEventStatus(updateData.status)) {
      const invalidStatus = NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidStatus);
      return invalidStatus;
    }

    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('group_events')
      .update(updateData)
      .eq('id', id);

    if (error) {
      const serverError = NextResponse.json({ error: error.message }, { status: 500 });
      mergeResponseCookies(supabaseResponse, serverError);
      return serverError;
    }

    if (parsedMenuAssignments !== null) {
      await syncCheffingMenuAssignments({
        supabase,
        groupEventId: id,
        assignments: parsedMenuAssignments,
      });
    }

    const success = NextResponse.json({ success: true });
    mergeResponseCookies(supabaseResponse, success);
    return success;
  } catch (e) {
    console.error(e);
    if (e instanceof Error && e.message.toLowerCase().includes('menuassignments')) {
      const invalidPayload = NextResponse.json({ error: e.message }, { status: 400 });
      mergeResponseCookies(supabaseResponse, invalidPayload);
      return invalidPayload;
    }

    const unexpected = NextResponse.json(
      { error: 'Unexpected error while updating group event' },
      { status: 500 },
    );
    mergeResponseCookies(supabaseResponse, unexpected);
    return unexpected;
  }
}
