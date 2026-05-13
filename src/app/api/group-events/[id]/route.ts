import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';
import { deleteCalendarEvent } from '@/lib/googleCalendar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

type RouteParams = {
  params: {
    id: string;
  };
};

function isNotFoundError(error: unknown) {
  const err = error as { code?: number; response?: { status?: number } };
  return err?.code === 404 || err?.response?.status === 404;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const supabaseResponse = NextResponse.next();

  const respond = (body: Record<string, unknown>, init?: Parameters<typeof NextResponse.json>[1]) => {
    const response = NextResponse.json(body, init);
    mergeResponseCookies(supabaseResponse, response);
    return response;
  };

  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return respond({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    return respond({ error: 'Not allowed' }, { status: 403, headers: noStoreHeaders });
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (allowlistInfo.error) {
    return respond({ error: 'Allowlist check failed' }, { status: 500, headers: noStoreHeaders });
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active || !isAdmin(allowlistInfo.role)) {
    return respond({ error: 'Forbidden' }, { status: 403, headers: noStoreHeaders });
  }

  if (!params.id) {
    return respond({ error: 'Missing group event id' }, { status: 400, headers: noStoreHeaders });
  }

  const supabase = createSupabaseAdminClient();

  const { data: reservation, error: fetchError } = await supabase
    .from('group_events')
    .select('id, calendar_event_id')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) {
    console.error('[API] group-events/delete fetch', { groupEventId: params.id, error: fetchError });
    return respond({ error: fetchError.message }, { status: 500, headers: noStoreHeaders });
  }

  if (!reservation) {
    return respond({ error: 'Reservation not found' }, { status: 404, headers: noStoreHeaders });
  }

  const calendarEventId =
    typeof reservation.calendar_event_id === 'string' && reservation.calendar_event_id.trim()
      ? reservation.calendar_event_id.trim()
      : null;

  if (calendarEventId) {
    try {
      await deleteCalendarEvent(calendarEventId);
    } catch (error) {
      if (!isNotFoundError(error)) {
        console.error('[API] group-events/delete calendar cleanup failed', {
          groupEventId: params.id,
          calendarEventId,
          error,
        });
        return respond(
          {
            error:
              'No se ha podido eliminar el evento de Google Calendar. La reserva no se ha borrado en Sikim.',
          },
          { status: 502, headers: noStoreHeaders },
        );
      }
    }
  }

  const { error: deleteError } = await supabase.from('group_events').delete().eq('id', params.id);

  if (deleteError) {
    console.error('[API] group-events/delete db cleanup failed', { groupEventId: params.id, error: deleteError });
    return respond({ error: deleteError.message }, { status: 500, headers: noStoreHeaders });
  }

  return respond({ success: true, calendarDeleted: Boolean(calendarEventId) }, { headers: noStoreHeaders });
}
