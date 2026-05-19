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
  event_mode: 'dinner' | 'dinner_private_party' | 'private_party_only' | null;
  party_room_id: string | null;
  party_room_name: string | null;
};

type GroupEventCalendarDetails = {
  name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  total_pax: number | null;
  adults: number | null;
  children: number | null;
  event_mode: 'dinner' | 'dinner_private_party' | 'private_party_only' | null;
  party_room_id: string | null;
  event_date: string;
  entry_time: string | null;
  menu_text: string | null;
  second_course_type: string | null;
  allergens_and_diets: string | null;
  setup_notes: string | null;
  extras: string | null;
  invoice_data: string | null;
  deposit_amount: number | null;
  deposit_status: string | null;
  has_private_dining_room: boolean | null;
  has_private_party: boolean | null;
  status: string | null;
};

type GroupEventOfferingCalendarRow = {
  display_name_snapshot: string | null;
};

const EMPTY_VALUE_MARKERS = new Set(['-', '--', '---', '—', 'null', 'undefined', 'n/a', 'na']);

function getMeaningfulText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  if (!text || EMPTY_VALUE_MARKERS.has(text.toLowerCase())) {
    return null;
  }

  return text;
}

function getMeaningfulLines(value: unknown): string[] {
  const text = getMeaningfulText(value);
  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n/)
    .map((line) => getMeaningfulText(line))
    .filter((line): line is string => Boolean(line));
}

function appendLineIfValue(lines: string[], label: string, value: unknown) {
  const text = getMeaningfulText(value);
  if (text) {
    lines.push(`${label}: ${text}`);
  }
}

function appendSectionIfLines(lines: string[], title: string, sectionLines: string[]) {
  const usefulLines = sectionLines
    .map((line) => getMeaningfulText(line))
    .filter((line): line is string => Boolean(line));

  if (usefulLines.length === 0) {
    return;
  }

  if (lines.length > 0 && lines[lines.length - 1] !== '') {
    lines.push('');
  }

  lines.push(`${title}:`, ...usefulLines);
}

function formatPax(adults: number | null | undefined, children: number | null | undefined, totalPax: number) {
  const paxParts = [];

  if (typeof adults === 'number' && adults > 0) {
    paxParts.push(`${adults} adultos`);
  }

  if (typeof children === 'number' && children > 0) {
    paxParts.push(`${children} niños`);
  }

  return paxParts.length > 0 ? paxParts.join(', ') : String(totalPax);
}

function formatOfferingNames(offerings: GroupEventOfferingCalendarRow[]) {
  const names = offerings
    .map((offering) => getMeaningfulText(offering.display_name_snapshot))
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? names.join(' + ') : null;
}

function formatReservationCalendarTitle({
  groupName,
  pax,
  hhmm,
  offeringNames,
}: {
  groupName: string;
  pax: number;
  hhmm: string;
  offeringNames: string | null;
}) {
  return [groupName, `${pax} pax`, hhmm, offeringNames]
    .map((part) => getMeaningfulText(part))
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

function formatDeposit(depositAmount: number | null | undefined, depositStatus: string | null | undefined) {
  const parts = [];

  if (typeof depositAmount === 'number' && depositAmount > 0) {
    parts.push(`${depositAmount} €`);
  }

  const status = getMeaningfulText(depositStatus);
  if (status) {
    parts.push(status);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

function formatReservationCalendarDescription({
  groupEvent,
  row,
  groupName,
  pax,
  hhmm,
  salaZona,
  partyRoomName,
  offeringNames,
}: {
  groupEvent: GroupEventCalendarDetails | null | undefined;
  row: CalendarSyncRow;
  groupName: string;
  pax: number;
  hhmm: string;
  salaZona: string | null;
  partyRoomName: string | null;
  offeringNames: string | null;
}) {
  const status = groupEvent?.status ?? row.status;
  const isPrivatePartyOnly = groupEvent?.event_mode === 'private_party_only';
  const isDinnerPrivateParty = groupEvent?.event_mode === 'dinner_private_party';
  const lines: string[] = [
    `Grupo: ${groupName}`,
    `Pax: ${formatPax(groupEvent?.adults, groupEvent?.children, pax)}`,
    `Entrada: ${hhmm}`,
  ];

  appendLineIfValue(lines, 'Cliente/contacto', groupEvent?.customer_name);
  appendLineIfValue(lines, 'Telefono', groupEvent?.customer_phone);
  appendLineIfValue(lines, 'Email', groupEvent?.customer_email);

  appendLineIfValue(lines, 'Sala cena', salaZona);
  if (isPrivatePartyOnly) {
    appendLineIfValue(lines, 'Modalidad', 'Solo fiesta privada');
  }
  if (isDinnerPrivateParty) {
    appendLineIfValue(lines, 'Modalidad', 'Cena + fiesta privada');
  }
  appendLineIfValue(lines, 'Zona fiesta', partyRoomName);

  if (!isPrivatePartyOnly) {
    appendLineIfValue(lines, 'Oferta', offeringNames);
  }

  if (!isPrivatePartyOnly) {
    appendSectionIfLines(lines, 'Menú / carta', getMeaningfulLines(groupEvent?.menu_text));
    appendLineIfValue(lines, 'Segundo plato', groupEvent?.second_course_type);
    appendSectionIfLines(lines, 'Alérgenos / intolerancias', getMeaningfulLines(groupEvent?.allergens_and_diets));
    appendSectionIfLines(lines, 'Notas cocina', getMeaningfulLines(groupEvent?.extras));
  }
  appendSectionIfLines(lines, 'Montaje', getMeaningfulLines(groupEvent?.setup_notes));
  appendSectionIfLines(lines, 'Facturación', getMeaningfulLines(groupEvent?.invoice_data));
  appendLineIfValue(lines, 'Depósito', formatDeposit(groupEvent?.deposit_amount, groupEvent?.deposit_status));

  const privateLines = [
    groupEvent?.has_private_dining_room ? 'Sala privada' : null,
    groupEvent?.has_private_party ? 'Fiesta privada' : null,
  ].filter((line): line is string => Boolean(line));
  appendSectionIfLines(lines, 'Privado', privateLines);

  appendLineIfValue(lines, 'Estado', status.toUpperCase());
  lines.push(`Group ID: ${row.group_event_id}`);
  lines.push('');
  lines.push('Este evento está sincronizado con Sikim Gestió Reserves.');

  return lines.join('\n');
}

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
        'name, customer_name, customer_phone, customer_email, total_pax, adults, children, event_mode, party_room_id, event_date, entry_time, menu_text, second_course_type, allergens_and_diets, setup_notes, extras, invoice_data, deposit_amount, deposit_status, has_private_dining_room, has_private_party, status'
      )
      .eq('id', row.group_event_id)
      .single();

    if (groupEventError) {
      console.error('[CalendarSync] Error fetching group event details', {
        groupEventId,
        error: groupEventError,
      });
    }

    const { data: offeringsData, error: offeringsError } = await supabase
      .from('group_event_offerings')
      .select('display_name_snapshot')
      .eq('group_event_id', row.group_event_id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (offeringsError) {
      console.error('[CalendarSync] Error fetching group event offerings', {
        groupEventId,
        error: offeringsError,
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

    const typedGroupEvent = groupEvent as GroupEventCalendarDetails | null;
    const groupName = typedGroupEvent?.name ?? row.group_name;
    const pax = typedGroupEvent?.total_pax ?? row.total_pax ?? 0;
    const baseTime = typedGroupEvent?.entry_time ?? row.entry_time ?? '20:00:00';
    const hhmm = baseTime.slice(0, 5);
    const offeringNames = formatOfferingNames((offeringsData ?? []) as GroupEventOfferingCalendarRow[]);
    const titleSuffix =
      typedGroupEvent?.event_mode === 'private_party_only'
        ? 'Solo fiesta privada'
        : typedGroupEvent?.event_mode === 'dinner_private_party'
          ? 'Cena + fiesta privada'
          : offeringNames;

    const typedAllocations = (roomAllocations ?? []) as {
      room?: { name?: string };
      notes?: string;
    }[];

    const salaZona = typedAllocations.length > 0
      ? typedAllocations
          .map((ra) => {
            const roomName = getMeaningfulText(ra.room?.name) ?? '';
            const notes = getMeaningfulText(ra.notes);
            return `${roomName}${notes ? ` (${notes})` : ''}`.trim();
          })
          .filter(Boolean)
          .join(', ')
      : null;

    const summary = formatReservationCalendarTitle({ groupName, pax, hhmm, offeringNames: titleSuffix });
    const description = formatReservationCalendarDescription({
      groupEvent: typedGroupEvent,
      row,
      groupName,
      pax,
      hhmm,
      salaZona: getMeaningfulText(salaZona),
      partyRoomName: getMeaningfulText(row.party_room_name),
      offeringNames,
    });

    const payload = {
      summary,
      description,
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
