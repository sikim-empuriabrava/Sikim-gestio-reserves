import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';
import { getRpcHttpStatus } from '@/lib/api/rpcError';
import { isPartyRoomName } from '@/lib/reservations/roomMode';

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
    const body = (await req.json()) as Record<string, unknown>;

    if (!body?.id) {
      const missingId = NextResponse.json({ error: 'Missing id' }, { status: 400 });
      mergeResponseCookies(supabaseResponse, missingId);
      return missingId;
    }

    const sanitizedBody = { ...body };
    const requestedRoomId =
      typeof sanitizedBody.room_id === 'string' && sanitizedBody.room_id.trim()
        ? sanitizedBody.room_id.trim()
        : null;
    const shouldUpdateRoom = Object.prototype.hasOwnProperty.call(sanitizedBody, 'room_id');
    const requestedRoomNotes =
      typeof sanitizedBody.room_notes === 'string' && sanitizedBody.room_notes.trim()
        ? sanitizedBody.room_notes.trim()
        : null;
    const requestedPartyRoomId =
      typeof sanitizedBody.party_room_id === 'string' && sanitizedBody.party_room_id.trim()
        ? sanitizedBody.party_room_id.trim()
        : null;

    delete sanitizedBody.total_pax;
    delete sanitizedBody.totalPax;
    delete sanitizedBody.created_at;
    delete sanitizedBody.updated_at;
    delete sanitizedBody.room_id;
    delete sanitizedBody.room_notes;

    const supabase = createSupabaseAdminClient();

    if (shouldUpdateRoom && requestedRoomId) {
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('id', requestedRoomId)
        .maybeSingle();

      if (roomError || !room) {
        const message = roomError?.message ?? 'Selected room not found';
        const serverError = NextResponse.json({ error: message }, { status: roomError ? 500 : 400 });
        mergeResponseCookies(supabaseResponse, serverError);
        return serverError;
      }

      if (isPartyRoomName(room.name)) {
        const invalidRoom = NextResponse.json({ error: 'Dinner room must not be Pub or Disco' }, { status: 400 });
        mergeResponseCookies(supabaseResponse, invalidRoom);
        return invalidRoom;
      }
    }

    if (requestedPartyRoomId) {
      const { data: partyRoom, error: partyRoomError } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('id', requestedPartyRoomId)
        .maybeSingle();

      if (partyRoomError || !partyRoom) {
        const message = partyRoomError?.message ?? 'Selected party room not found';
        const serverError = NextResponse.json({ error: message }, { status: partyRoomError ? 500 : 400 });
        mergeResponseCookies(supabaseResponse, serverError);
        return serverError;
      }

      if (!isPartyRoomName(partyRoom.name)) {
        const invalidPartyRoom = NextResponse.json({ error: 'Party room must be Pub or Disco' }, { status: 400 });
        mergeResponseCookies(supabaseResponse, invalidPartyRoom);
        return invalidPartyRoom;
      }
    }

    const { data, error } = await supabase.rpc('update_group_event_with_cheffing_offerings', {
      p_payload: sanitizedBody,
    });

    if (error || !data) {
      const message = error?.message ?? 'Unable to update group event';
      const status = getRpcHttpStatus(error);
      const serverError = NextResponse.json({ error: message }, { status });
      mergeResponseCookies(supabaseResponse, serverError);
      return serverError;
    }

    if (shouldUpdateRoom) {
      const groupEventId = String(body.id);

      if (!requestedRoomId) {
        const { error: deleteRoomError } = await supabase
          .from('group_room_allocations')
          .delete()
          .eq('group_event_id', groupEventId);

        if (deleteRoomError) {
          const serverError = NextResponse.json({ error: deleteRoomError.message }, { status: 500 });
          mergeResponseCookies(supabaseResponse, serverError);
          return serverError;
        }
      } else {
        const { data: updatedEvent, error: eventError } = await supabase
          .from('group_events')
          .select('adults, children')
          .eq('id', groupEventId)
          .single();

        if (eventError || !updatedEvent) {
          const message = eventError?.message ?? 'Unable to fetch updated group event';
          const serverError = NextResponse.json({ error: message }, { status: 500 });
          mergeResponseCookies(supabaseResponse, serverError);
          return serverError;
        }

        const { data: existingAllocation, error: allocationError } = await supabase
          .from('group_room_allocations')
          .select('id')
          .eq('group_event_id', groupEventId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (allocationError) {
          const serverError = NextResponse.json({ error: allocationError.message }, { status: 500 });
          mergeResponseCookies(supabaseResponse, serverError);
          return serverError;
        }

        const allocationPayload = {
          room_id: requestedRoomId,
          adults: updatedEvent.adults ?? 0,
          children: updatedEvent.children ?? 0,
          override_capacity: false,
          notes: requestedRoomNotes,
        };

        const { error: writeRoomError } = existingAllocation
          ? await supabase
              .from('group_room_allocations')
              .update(allocationPayload)
              .eq('id', existingAllocation.id)
          : await supabase.from('group_room_allocations').insert({
              group_event_id: groupEventId,
              ...allocationPayload,
            });

        if (writeRoomError) {
          const serverError = NextResponse.json({ error: writeRoomError.message }, { status: 500 });
          mergeResponseCookies(supabaseResponse, serverError);
          return serverError;
        }
      }
    }

    const success = NextResponse.json({ success: true });
    mergeResponseCookies(supabaseResponse, success);
    return success;
  } catch (e) {
    console.error(e);
    const unexpected = NextResponse.json(
      { error: 'Unexpected error while updating group event' },
      { status: 500 },
    );
    mergeResponseCookies(supabaseResponse, unexpected);
    return unexpected;
  }
}
