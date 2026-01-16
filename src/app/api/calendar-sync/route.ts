import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseRouteHandlerClient, mergeResponseCookies } from '@/lib/supabase/route';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from '@/lib/googleCalendar';
import { getAllowlistRoleForUserEmail, isAdmin } from '@/lib/auth/requireRole';

export const runtime = 'nodejs';

type CalendarSyncRow = {
  group_event_id: string;
  event_date: string;
  entry_time: string | null;
  group_name: string;
  total_pax: number | null;
  status: string;
  calendar_event_id: string | null;
  desired_calendar_action: 'create' | 'update' | 'delete' | 'noop';
  needs_calendar_sync: boolean;
  calendar_deleted_externally: boolean;
};

function isNotFoundError(error: unknown) {
  const err = error as { code?: number; response?: { status?: number } };
  return err?.code === 404 || err?.response?.status === 404;
}

export async function POST(req: NextRequest) {
  const supabaseResponse = NextResponse.next();
  const authClient = createSupabaseRouteHandlerClient(supabaseResponse);
  const {
    data: { user },
  } = await authClient.auth.getUser();

  const respond = (
    body: Record<string, unknown>,
    init?: Parameters<typeof NextResponse.json>[1],
  ) => {
    const response = NextResponse.json(body, init);
    mergeResponseCookies(supabaseResponse, response);
    return response;
  };

  if (!user) {
    return respond({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const requesterEmail = user.email?.trim().toLowerCase();

  if (!requesterEmail) {
    return respond({ error: 'Not allowed' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const allowlistInfo = await getAllowlistRoleForUserEmail(requesterEmail);
  if (allowlistInfo.error) {
    return respond({ error: 'Allowlist check failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  if (!allowlistInfo.allowlisted || !allowlistInfo.allowedUser?.is_active || !isAdmin(allowlistInfo.role)) {
    return respond({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const body = await req.json();
    const groupEventId: string | undefined = body.groupEventId;

    if (!groupEventId) {
      return respond({ error: 'Missing groupEventId in body' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('v_group_events_calendar_sync')
      .select('*')
      .eq('group_event_id', groupEventId)
      .maybeSingle();

    if (error) {
      console.error('[CalendarSync] Error fetching sync row', { groupEventId, error });
      return respond(
        { error: 'Error fetching calendar sync row' },
        { status: 500 }
      );
    }

    if (!data) {
      return respond(
        { error: 'Group event not found in calendar sync view' },
        { status: 404 }
      );
    }

    const row = data as CalendarSyncRow;

    if (!row.needs_calendar_sync || row.desired_calendar_action === 'noop') {
      return respond({
        status: 'noop',
        reason: 'No sync needed according to v_group_events_calendar_sync',
      });
    }

    const eventDate = row.event_date;

    const startDateObj = new Date(`${eventDate}T00:00:00`);
    startDateObj.setDate(startDateObj.getDate() + 1);
    const nextDateIso = startDateObj.toISOString().slice(0, 10);

    const startDate = eventDate;
    const endDate = nextDateIso;

    const { data: groupEvent, error: groupEventError } = await supabase
      .from('group_events')
      .select(
        'name, total_pax, event_date, entry_time, menu_text, allergens_and_diets, setup_notes, extras, status'
      )
      .eq('id', row.group_event_id)
      .single();

    if (groupEventError) {
      console.error('[CalendarSync] Error fetching group event details', {
        groupEventId,
        error: groupEventError,
      });
    }

    const { data: roomAllocations, error: roomError } = await supabase
      .from('group_room_allocations')
      .select('room:rooms(name), notes')
      .eq('group_event_id', row.group_event_id);

    if (roomError) {
      console.error('[CalendarSync] Error fetching room allocations', {
        groupEventId,
        error: roomError,
      });
    }

    const groupName = groupEvent?.name ?? row.group_name;
    const pax = groupEvent?.total_pax ?? row.total_pax ?? 0;
    const baseTime = groupEvent?.entry_time ?? row.entry_time ?? '20:00:00';
    const hhmm = baseTime.slice(0, 5);

    const typedAllocations = (roomAllocations ?? []) as {
      room?: { name?: string };
      notes?: string;
    }[];

    const salaZona = typedAllocations.length > 0
      ? typedAllocations
          .map((ra) => {
            const roomName = ra.room?.name ?? '';
            const notes = ra.notes ? ` (${ra.notes})` : '';
            return `${roomName}${notes}`;
          })
          .join(', ')
      : '—';

    const descriptionLines = [
      `Reserva: ${groupName}`,
      `Pax: ${pax}`,
      `Hora: ${hhmm}`,
      `Sala / zona: ${salaZona}`,
      '',
      'Menú:',
      groupEvent?.menu_text ?? '—',
      '',
      'Intolerancias / alergias:',
      groupEvent?.allergens_and_diets ?? '—',
      '',
      'Notas sala:',
      groupEvent?.setup_notes ?? '—',
      '',
      'Notas cocina:',
      groupEvent?.extras ?? '—',
      '',
      `Estado: ${(groupEvent?.status ?? row.status).toUpperCase()}`,
      `Group ID: ${row.group_event_id}`,
      '',
      'Este evento está sincronizado con Sikim Gestió Reserves.',
    ];

    const summary = `${groupName} ${pax}px ${hhmm}`;

    const payload = {
      summary,
      description: descriptionLines.join('\n'),
      allDay: true,
      startDate,
      endDate,
    };

    switch (row.desired_calendar_action) {
      case 'create': {
        try {
          const eventId = await createCalendarEvent(payload);

          const { error: updateError } = await supabase
            .from('group_events')
            .update({
              calendar_event_id: eventId,
              calendar_deleted_externally: false,
            })
            .eq('id', row.group_event_id);

          if (updateError) {
            console.error('[CalendarSync] Error saving calendar_event_id', {
              groupEventId,
              error: updateError,
            });
            return respond(
              { error: 'Event created in Calendar but failed to save calendar_event_id' },
              { status: 500 }
            );
          }

          return respond({ status: 'created', calendar_event_id: eventId });
        } catch (err: unknown) {
          console.error('[CalendarSync] Error creating event', { groupEventId, error: err });
          return respond(
            { error: 'Error creating event in Calendar' },
            { status: 500 }
          );
        }
      }
      case 'update': {
        if (!row.calendar_event_id) {
          console.error('[CalendarSync] Update requested without calendar_event_id', {
            groupEventId,
          });
          return respond(
            { error: 'Missing calendar_event_id for update action' },
            { status: 409 }
          );
        }

        try {
          await updateCalendarEvent(row.calendar_event_id, payload);

          const { error: clearFlagError } = await supabase
            .from('group_events')
            .update({ calendar_deleted_externally: false })
            .eq('id', row.group_event_id);

          if (clearFlagError) {
            console.error('[CalendarSync] Error clearing calendar_deleted_externally', {
              groupEventId,
              error: clearFlagError,
            });
          }

          return respond({ status: 'updated' });
        } catch (err: unknown) {
          console.error('[CalendarSync] Error updating event', { groupEventId, error: err });

          if (isNotFoundError(err)) {
            const { error: flagError } = await supabase
              .from('group_events')
              .update({ calendar_deleted_externally: true })
              .eq('id', row.group_event_id);

            if (flagError) {
              console.error('[CalendarSync] Error setting calendar_deleted_externally', {
                groupEventId,
                error: flagError,
              });
            }

            return respond(
              {
                status: 'calendar_event_missing',
                message:
                  'El evento ya no existe en Google Calendar. Se ha marcado calendar_deleted_externally = true.',
              },
              { status: 409 }
            );
          }

          return respond(
            { error: 'Error updating event in Calendar' },
            { status: 500 }
          );
        }
      }
      case 'delete': {
        if (!row.calendar_event_id) {
          const { error: clearError } = await supabase
            .from('group_events')
            .update({
              calendar_event_id: null,
              calendar_deleted_externally: false,
            })
            .eq('id', row.group_event_id);

          if (clearError) {
            console.error('[CalendarSync] Error clearing calendar_event_id without id', {
              groupEventId,
              error: clearError,
            });
          }

          return respond({ status: 'already_deleted' });
        }

        try {
          await deleteCalendarEvent(row.calendar_event_id);

          const { error: updateError } = await supabase
            .from('group_events')
            .update({
              calendar_event_id: null,
              calendar_deleted_externally: false,
            })
            .eq('id', row.group_event_id);

          if (updateError) {
            console.error('[CalendarSync] Error clearing calendar_event_id', {
              groupEventId,
              error: updateError,
            });
          }

          return respond({ status: 'deleted' });
        } catch (err: unknown) {
          console.error('[CalendarSync] Error deleting event', { groupEventId, error: err });

          if (isNotFoundError(err)) {
            const { error: clearError } = await supabase
              .from('group_events')
              .update({
                calendar_event_id: null,
                calendar_deleted_externally: false,
              })
              .eq('id', row.group_event_id);

            if (clearError) {
              console.error('[CalendarSync] Error clearing calendar_event_id after 404', {
                groupEventId,
                error: clearError,
              });
            }

            return respond(
              {
                status: 'already_deleted',
                message:
                  'El evento no existía en Google Calendar, se ha limpiado calendar_event_id igualmente.',
              },
              { status: 200 }
            );
          }

          return respond(
            { error: 'Error deleting event in Calendar' },
            { status: 500 }
          );
        }
      }
      default:
        return respond(
          { status: 'unsupported_action', action: row.desired_calendar_action },
          { status: 400 }
        );
    }
  } catch (e: unknown) {
    console.error('[CalendarSync] Unhandled error', e);
    return respond(
      { error: 'Unhandled error in /api/calendar-sync' },
      { status: 500 }
    );
  }
}
