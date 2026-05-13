import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_RANGE_DAYS = 31;

export const DONENESS_LABELS: Record<string, string> = {
  crudo: 'Crudo',
  poco: 'Poco hecho',
  al_punto: 'Al punto',
  hecho: 'Hecho',
  muy_hecho: 'Muy hecho',
};

export const DONENESS_ORDER = ['crudo', 'poco', 'al_punto', 'hecho', 'muy_hecho'];

export type ReservationRow = {
  id: string;
  name: string;
  status: 'confirmed' | 'completed' | string;
  event_date: string;
  entry_time: string | null;
  adults: number | null;
  children: number | null;
  total_pax: number | null;
  has_private_dining_room: boolean | null;
  has_private_party: boolean | null;
  second_course_type: string | null;
  menu_text: string | null;
  allergens_and_diets: string | null;
  extras: string | null;
  setup_notes: string | null;
  invoice_data: string | null;
  service_outcome: string | null;
  service_outcome_notes: string | null;
};

export type RoomAllocationRow = {
  group_event_id: string;
  notes: string | null;
  room: { name: string | null } | { name: string | null }[] | null;
};

export type OfferingRow = {
  id: string;
  group_event_id: string;
  offering_kind: 'cheffing_menu' | 'cheffing_card';
  assigned_pax: number;
  display_name_snapshot: string;
  notes: string | null;
  sort_order: number;
};

export type SelectionRow = {
  id: string;
  group_event_offering_id: string;
  selection_kind: 'menu_second' | 'custom_menu' | 'kids_menu';
  display_name_snapshot: string;
  description_snapshot: string | null;
  quantity: number;
  notes: string | null;
  needs_doneness_points: boolean;
  sort_order: number;
};

export type DonenessRow = {
  selection_id: string;
  point: string;
  quantity: number;
};

export type ReportData = {
  reservations: ReservationRow[];
  roomsByReservation: Map<string, RoomAllocationRow>;
  offeringsByReservation: Map<string, OfferingRow[]>;
  selectionsByOffering: Map<string, SelectionRow[]>;
  donenessBySelection: Map<string, DonenessRow[]>;
};

export type RangeValidation =
  | { valid: true; days: number }
  | { valid: false; message: string };

export function todayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export function parseISODateParts(value: string) {
  if (!DATE_REGEX.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day, utcTime: date.getTime() };
}

export function getRangeValidation(from: string, to: string): RangeValidation {
  const fromParts = parseISODateParts(from);
  const toParts = parseISODateParts(to);
  if (!fromParts || !toParts) {
    return { valid: false, message: 'Selecciona fechas válidas en formato día/mes/año.' };
  }

  const diffDays = Math.floor((toParts.utcTime - fromParts.utcTime) / 86_400_000) + 1;
  if (diffDays < 1) {
    return { valid: false, message: 'La fecha hasta debe ser igual o posterior a la fecha desde.' };
  }
  if (diffDays > MAX_RANGE_DAYS) {
    return {
      valid: false,
      message: `El rango máximo es de ${MAX_RANGE_DAYS} días. Ajusta las fechas para generar el informe.`,
    };
  }

  return { valid: true, days: diffDays };
}

export function formatDate(dateString: string, options: Intl.DateTimeFormatOptions) {
  const parts = parseISODateParts(dateString);
  const date = parts
    ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12))
    : new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', ...options }).format(date);
}

export function formatLongDate(dateString: string) {
  const value = formatDate(dateString, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatShortDate(dateString: string) {
  return formatDate(dateString, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatTime(time?: string | null) {
  return time ? time.slice(0, 5) : 'Sin hora';
}

export function cleanText(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

export function roomName(room: RoomAllocationRow['room']) {
  if (Array.isArray(room)) return room[0]?.name ?? null;
  return room?.name ?? null;
}

export function groupByDate(reservations: ReservationRow[]) {
  return reservations.reduce<Map<string, ReservationRow[]>>((acc, reservation) => {
    const list = acc.get(reservation.event_date) ?? [];
    list.push(reservation);
    acc.set(reservation.event_date, list);
    return acc;
  }, new Map());
}

export function getReportTotals(reportData: ReportData) {
  return {
    totalReservations: reportData.reservations.length,
    totalPax: reportData.reservations.reduce((sum, reservation) => sum + (reservation.total_pax ?? 0), 0),
  };
}

export function buildPdfFileName(from: string, to: string) {
  return from === to ? `Rest - ${from}.pdf` : `Rest - ${from} - ${to}.pdf`;
}

export async function getReportData(from: string, to: string): Promise<ReportData> {
  const supabase = createSupabaseAdminClient();

  const { data: reservationsData, error } = await supabase
    .from('group_events')
    .select(
      'id, name, status, event_date, entry_time, adults, children, total_pax, has_private_dining_room, has_private_party, second_course_type, menu_text, allergens_and_diets, extras, setup_notes, invoice_data, service_outcome, service_outcome_notes',
    )
    .in('status', ['confirmed', 'completed'])
    .gte('event_date', from)
    .lte('event_date', to)
    .order('event_date', { ascending: true })
    .order('entry_time', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const reservations = (reservationsData ?? []) as ReservationRow[];
  const reservationIds = reservations.map((reservation) => reservation.id);

  if (reservationIds.length === 0) {
    return {
      reservations,
      roomsByReservation: new Map(),
      offeringsByReservation: new Map(),
      selectionsByOffering: new Map(),
      donenessBySelection: new Map(),
    };
  }

  const [{ data: roomsData, error: roomsError }, { data: offeringsData, error: offeringsError }] = await Promise.all([
    supabase
      .from('group_room_allocations')
      .select('group_event_id, notes, room:rooms(name)')
      .in('group_event_id', reservationIds)
      .order('created_at', { ascending: true }),
    supabase
      .from('group_event_offerings')
      .select('id, group_event_id, offering_kind, assigned_pax, display_name_snapshot, notes, sort_order')
      .in('group_event_id', reservationIds)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  if (roomsError) {
    throw new Error(roomsError.message);
  }

  if (offeringsError) {
    throw new Error(offeringsError.message);
  }

  const roomsByReservation = new Map<string, RoomAllocationRow>();
  ((roomsData ?? []) as RoomAllocationRow[]).forEach((room) => {
    if (!roomsByReservation.has(room.group_event_id)) {
      roomsByReservation.set(room.group_event_id, room);
    }
  });

  const offerings = (offeringsData ?? []) as OfferingRow[];
  const offeringsByReservation = offerings.reduce<Map<string, OfferingRow[]>>((acc, offering) => {
    const list = acc.get(offering.group_event_id) ?? [];
    list.push(offering);
    acc.set(offering.group_event_id, list);
    return acc;
  }, new Map());

  const offeringIds = offerings.map((offering) => offering.id);
  if (offeringIds.length === 0) {
    return { reservations, roomsByReservation, offeringsByReservation, selectionsByOffering: new Map(), donenessBySelection: new Map() };
  }

  const { data: selectionsData, error: selectionsError } = await supabase
    .from('group_event_offering_selections')
    .select(
      'id, group_event_offering_id, selection_kind, display_name_snapshot, description_snapshot, quantity, notes, needs_doneness_points, sort_order',
    )
    .in('group_event_offering_id', offeringIds)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (selectionsError) {
    throw new Error(selectionsError.message);
  }

  const selections = (selectionsData ?? []) as SelectionRow[];
  const selectionsByOffering = selections.reduce<Map<string, SelectionRow[]>>((acc, selection) => {
    const list = acc.get(selection.group_event_offering_id) ?? [];
    list.push(selection);
    acc.set(selection.group_event_offering_id, list);
    return acc;
  }, new Map());

  const selectionIds = selections.map((selection) => selection.id);
  if (selectionIds.length === 0) {
    return { reservations, roomsByReservation, offeringsByReservation, selectionsByOffering, donenessBySelection: new Map() };
  }

  const { data: donenessData, error: donenessError } = await supabase
    .from('group_event_offering_selection_doneness')
    .select('selection_id, point, quantity')
    .in('selection_id', selectionIds);

  if (donenessError) {
    throw new Error(donenessError.message);
  }

  const donenessBySelection = ((donenessData ?? []) as DonenessRow[]).reduce<Map<string, DonenessRow[]>>(
    (acc, point) => {
      const list = acc.get(point.selection_id) ?? [];
      list.push(point);
      acc.set(point.selection_id, list);
      return acc;
    },
    new Map(),
  );

  return { reservations, roomsByReservation, offeringsByReservation, selectionsByOffering, donenessBySelection };
}
