import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  InboxStackIcon,
  Squares2X2Icon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getReservationEventModeLabel } from '@/lib/reservations/eventMode';
import { DayNotesPanel } from '../reservas-dia/detalle/DayNotesPanel';
import { ReservationOutcomeCard } from '../reservas-dia/detalle/ReservationOutcomeCard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type SearchParams = {
  view?: string;
  date?: string;
};

type DayStatusRow = {
  event_date: string;
  is_validated?: boolean | null;
  validated?: boolean | null;
  needs_revalidation?: boolean | null;
  notes_general?: string | null;
  notes_kitchen?: string | null;
  notes_maintenance?: string | null;
  last_validated_by?: string | null;
  last_validated_at?: string | null;
};

type GroupEventDailyDetail = {
  event_date: string;
  entry_time: string | null;
  group_event_id: string;
  group_name: string;
  status: string;
  total_pax: number | null;
  event_mode?: 'dinner' | 'dinner_private_party' | 'private_party_only' | null;
  adults?: number | null;
  children?: number | null;
  has_private_dining_room?: boolean | null;
  has_private_party?: boolean | null;
  room_id?: string | null;
  room_name?: string | null;
  party_room_id?: string | null;
  party_room_name?: string | null;
  room_total_pax?: number | null;
  room_override_capacity?: number | null;
  recommended_waiters?: number | null;
  recommended_runners?: number | null;
  recommended_bartenders?: number | null;
  service_outcome?: string | null;
  service_outcome_notes?: string | null;
  second_course_type?: string | null;
  menu_text?: string | null;
  allergens_and_diets?: string | null;
  extras?: string | null;
  setup_notes?: string | null;
  invoice_data?: string | null;
  isExternalReservation: boolean;
  externalSourceLabel?: string | null;
};

type PendingGroupEventRow = {
  id: string;
  name: string | null;
  event_date: string;
  entry_time: string | null;
  status: string;
  total_pax: number | null;
  customer_phone: string | null;
  extras: string | null;
};

type ExternalReservationSubmissionRow = {
  group_event_id: string;
  source_label: string | null;
  preferred_language: string | null;
  submitted_at: string | null;
};

type ExternalPendingReservation = PendingGroupEventRow & {
  source_label: string | null;
  preferred_language: string | null;
  submitted_at: string | null;
};

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(input?: string) {
  if (input && DATE_REGEX.test(input)) {
    return new Date(input);
  }
  return new Date();
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

function addDays(dateString: string, days: number) {
  const d = new Date(dateString);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function getWeekDates(weekStart: string) {
  return Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx));
}

function startOfMonth(date: Date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date: Date) {
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return d;
}

function formatWeekRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'numeric', year: 'numeric' });
  return `Semana del ${formatter.format(new Date(startDate))} al ${formatter.format(new Date(endDate))}`;
}

function formatLongDate(dateString: string) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateString));
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(date);
}

function formatDayHeader(dateString: string) {
  const date = new Date(dateString);
  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date);
  const dayMonth = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(date);
  return {
    label: `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${dayMonth}`,
    iso: new Intl.DateTimeFormat('es-ES').format(date),
  };
}

function formatMonthAgendaDay(dateString: string) {
  const date = new Date(dateString);
  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date);
  const day = new Intl.DateTimeFormat('es-ES', { day: 'numeric' }).format(date);
  const month = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(date);

  return {
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    compact: `${day} ${month}`,
  };
}

function formatMetricDate(dateString: string) {
  const label = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(new Date(dateString));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatExternalPendingDate(dateString: string) {
  const date = new Date(dateString);
  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace('.', '');
  const dayMonth = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' }).format(date);
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${dayMonth}`;
}

function cleanText(input?: string | null) {
  const text = input?.trim();
  return text ? text : null;
}

function getExternalPendingCountLabel(count: number) {
  return count === 1 ? '1 solicitud pendiente' : `${count} solicitudes pendientes`;
}

function statusBadge(status: string) {
  switch (status) {
    case 'confirmed':
      return {
        label: 'Confirmada',
        className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
      };
    case 'draft':
      return {
        label: 'Borrador',
        className: 'border-[#e2b19b]/90 bg-[#f7e1d7] text-[#8a5c49]',
      };
    case 'completed':
      return {
        label: 'Completada',
        className: 'border-emerald-500/25 bg-emerald-900/30 text-emerald-100',
      };
    case 'pending':
      return {
        label: 'Pendiente',
        className: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
      };
    case 'no_show':
      return {
        label: 'No-show',
        className: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
      };
    case 'incident':
      return {
        label: 'Incidencia',
        className: 'border-red-500/30 bg-red-500/10 text-red-200',
      };
    case 'cancelled':
      return {
        label: 'Cancelada',
        className: 'border-stone-600/60 bg-stone-900/70 text-stone-300',
      };
    default:
      return {
        label: status,
        className: 'border-stone-600/70 bg-stone-900/70 text-stone-200',
      };
  }
}

function reservationCardClassName(status: string) {
  if (status === 'draft') {
    return 'border-[#e2b19b]/90 bg-[#f3ddd2] hover:border-[#d99d84]/90 hover:bg-[#efd6ca] [&_h3]:text-[#5f4033] [&_p]:text-[#8a5c49]';
  }

  return 'border-[#4a3f32]/60 bg-[#24221f]/80 hover:border-[#8b6a43]/70 hover:bg-[#2a2722]';
}

function monthReservationClassName(status: string) {
  if (status === 'draft') {
    return 'border-[#e2b19b]/90 bg-[#f3ddd2] text-[#6f4b3c] hover:border-[#d99d84]/90 hover:bg-[#efd6ca] [&>p]:text-[#8a5c49]';
  }

  return 'border-[#4a3f32]/60 bg-[#24221f]/70 text-[#d8cfc2] hover:border-[#8b6a43]/70 hover:bg-[#2c2822]';
}

function validationBadge(statusRow?: DayStatusRow) {
  const validated = statusRow?.validated ?? statusRow?.is_validated;
  const needsRevalidation = statusRow?.needs_revalidation;

  if (validated && needsRevalidation) {
    return { label: 'Cambios', className: 'border-amber-500/30 bg-amber-500/10 text-amber-200' };
  }
  if (validated) {
    return { label: 'Validado', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' };
  }
  return { label: 'No validado', className: 'border-[#4a3f32]/80 bg-[#151412]/85 text-[#cfc4b5]' };
}

const validationBadgeClass =
  'inline-flex w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold leading-none';

const externalReservationBadgeClass =
  'inline-flex w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-[#d6a76e]/70 bg-[#fff1d6] px-2 py-1 text-[0.64rem] font-semibold leading-none text-[#7b4b12]';

function ExternalReservationBadge({ sourceLabel }: { sourceLabel?: string | null }) {
  const cleanSourceLabel = cleanText(sourceLabel);
  const title = cleanSourceLabel ? `Externa - ${cleanSourceLabel}` : 'Externa';

  return (
    <span className={externalReservationBadgeClass} title={title}>
      Externa
    </span>
  );
}

function getReservationMeta(event: GroupEventDailyDetail) {
  if (event.event_mode === 'private_party_only') {
    return [
      getReservationEventModeLabel(event.event_mode),
      event.party_room_name ? `Zona fiesta: ${event.party_room_name}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  if (event.event_mode === 'dinner_private_party') {
    const menu = event.second_course_type ?? event.menu_text;
    const parts = [
      event.room_name,
      getReservationEventModeLabel(event.event_mode),
      event.party_room_name ? `Zona fiesta: ${event.party_room_name}` : null,
      menu,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'Sin sala asignada';
  }

  const menu = event.second_course_type ?? event.menu_text;
  const parts = [event.room_name, menu].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Sin sala asignada';
}

function getPeriodMetrics(eventsByDate: Map<string, GroupEventDailyDetail[]>) {
  const entries = Array.from(eventsByDate.entries());
  const allEvents = entries.flatMap(([, events]) => events);
  const totalPax = allEvents.reduce((sum, event) => sum + (event.total_pax ?? 0), 0);
  const confirmed = allEvents.filter((event) => event.status === 'confirmed').length;
  const busiest = entries
    .filter(([, events]) => events.length > 0)
    .sort((a, b) => {
      const reservationDelta = b[1].length - a[1].length;
      if (reservationDelta !== 0) return reservationDelta;
      const paxA = a[1].reduce((sum, event) => sum + (event.total_pax ?? 0), 0);
      const paxB = b[1].reduce((sum, event) => sum + (event.total_pax ?? 0), 0);
      return paxB - paxA;
    })[0];

  return {
    reservations: allEvents.length,
    totalPax,
    confirmed,
    busiestDay: busiest?.[0] ?? null,
    busiestCount: busiest?.[1].length ?? 0,
    busiestPax: busiest?.[1].reduce((sum, event) => sum + (event.total_pax ?? 0), 0) ?? 0,
  };
}

function ReservasPilotChromeStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          body:has(.reservas-calendar-pilot) {
            background: #11100e;
          }

          .aforo-standalone-shell:has(.reservas-calendar-pilot) {
            max-width: none;
            gap: 0;
            padding: 0;
            background:
              radial-gradient(circle at 18% 0%, rgba(156, 117, 70, 0.10), transparent 26rem),
              linear-gradient(135deg, #171614 0%, #11100e 52%, #0f0e0d 100%);
          }

          .aforo-standalone-shell:has(.reservas-calendar-pilot) > aside {
            width: 18.5rem;
            border-right: 1px solid rgba(120, 103, 82, 0.30);
            background: linear-gradient(180deg, rgba(29, 28, 25, 0.98), rgba(20, 19, 17, 0.98));
          }

          .aforo-standalone-shell:has(.reservas-calendar-pilot) > aside > div {
            top: 0;
            min-height: 100dvh;
            padding: 1rem;
          }

          .aforo-standalone-shell:has(.reservas-calendar-pilot) > div {
            min-width: 0;
            gap: 0;
          }

          .aforo-standalone-shell:has(.reservas-calendar-pilot) > div > header {
            border-radius: 0;
            border-width: 0 0 1px 0;
            border-color: rgba(120, 103, 82, 0.28);
            background: rgba(18, 17, 15, 0.88);
            box-shadow: none;
          }

          .aforo-standalone-shell:has(.reservas-calendar-pilot) > div > header > div > div:first-child {
            display: none;
          }

          .aforo-standalone-shell:has(.reservas-calendar-pilot) > div > header > div {
            justify-content: flex-end;
          }

          .aforo-standalone-shell:has(.reservas-calendar-pilot) footer {
            display: none;
          }

          .aforo-standalone-shell:has(.reservas-calendar-pilot) aside nav > div {
            border-color: rgba(120, 103, 82, 0.22);
            background: transparent;
            box-shadow: none;
          }

          .aforo-standalone-shell:has(.reservas-calendar-pilot) aside nav button {
            background: rgba(28, 27, 24, 0.62);
            color: #efe8dc;
          }

          .aforo-standalone-shell:has(.reservas-calendar-pilot) aside nav a[aria-current="page"] {
            background: rgba(150, 112, 66, 0.22);
            color: #f1c98f;
            box-shadow: inset 0 0 0 1px rgba(194, 144, 82, 0.20);
          }

          .aforo-standalone-shell:has(.reservas-calendar-pilot) a {
            color: inherit;
          }

          @media (max-width: 1023px) {
            .aforo-standalone-shell:has(.reservas-calendar-pilot) {
              min-height: 100dvh;
            }
          }
        `,
      }}
    />
  );
}

function ViewSelector({
  currentView,
  dateParam,
}: {
  currentView: 'month' | 'week' | 'day';
  dateParam: string;
}) {
  const views: { value: 'month' | 'week' | 'day'; label: string }[] = [
    { value: 'month', label: 'Mes' },
    { value: 'week', label: 'Semana' },
    { value: 'day', label: 'Día' },
  ];

  return (
    <div className="inline-flex w-full items-center rounded-xl border border-[#4a3f32]/80 bg-[#151412]/90 p-1 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:w-auto">
      {views.map((view) => {
        const active = currentView === view.value;
        return (
          <Link
            key={view.value}
            href={`/reservas?view=${view.value}&date=${dateParam}`}
            className={`flex-1 rounded-lg px-3 py-2 text-center font-semibold transition-colors sm:flex-none sm:px-4 ${
              active
                ? 'bg-[#7d5932]/70 text-[#ffe2b6] shadow-[inset_0_0_0_1px_rgba(231,181,118,0.34)]'
                : 'text-[#b9aea1] hover:bg-[#24211d] hover:text-[#f2eadf]'
            }`}
          >
            {view.label}
          </Link>
        );
      })}
    </div>
  );
}

function DateNavigator({
  view,
  dateParam,
}: {
  view: 'month' | 'week' | 'day';
  dateParam: string;
}) {
  const currentDate = new Date(dateParam);

  const baseForView = (date: Date) => {
    if (view === 'month') return startOfMonth(date);
    if (view === 'week') return startOfWeek(date);
    return date;
  };

  const getShiftedDate = (increment: number) => {
    const baseDate = baseForView(currentDate);
    if (view === 'month') {
      baseDate.setMonth(baseDate.getMonth() + increment);
      return toISODate(baseDate);
    }
    if (view === 'week') {
      baseDate.setDate(baseDate.getDate() + increment * 7);
      return toISODate(baseDate);
    }
    baseDate.setDate(baseDate.getDate() + increment);
    return toISODate(baseDate);
  };

  const prevDate = getShiftedDate(-1);
  const nextDate = getShiftedDate(1);
  const todayForView = toISODate(baseForView(new Date()));

  return (
    <div className="grid w-full grid-cols-3 gap-2 text-sm sm:flex sm:w-auto sm:flex-wrap sm:items-center">
      <Link
        href={`/reservas?view=${view}&date=${prevDate}`}
        className="inline-flex items-center justify-center rounded-xl border border-[#4a3f32]/75 bg-[#151412]/90 px-3 py-2 font-medium text-[#efe8dc] transition-colors hover:border-[#8b6a43]/70 hover:bg-[#211f1b] active:translate-y-px sm:px-4"
      >
        Anterior
      </Link>
      <Link
        href={`/reservas?view=${view}&date=${todayForView}`}
        className="inline-flex items-center justify-center rounded-xl border border-[#4a3f32]/75 bg-[#151412]/90 px-3 py-2 font-medium text-[#efe8dc] transition-colors hover:border-[#8b6a43]/70 hover:bg-[#211f1b] active:translate-y-px sm:px-4"
      >
        Hoy
      </Link>
      <Link
        href={`/reservas?view=${view}&date=${nextDate}`}
        className="inline-flex items-center justify-center rounded-xl border border-[#4a3f32]/75 bg-[#151412]/90 px-3 py-2 font-medium text-[#efe8dc] transition-colors hover:border-[#8b6a43]/70 hover:bg-[#211f1b] active:translate-y-px sm:px-4"
      >
        Siguiente
      </Link>
    </div>
  );
}

function HeaderBar({
  view,
  dateParam,
  rangeLabel,
}: {
  view: 'month' | 'week' | 'day';
  dateParam: string;
  rangeLabel: string;
}) {
  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h1 className="text-[2rem] font-semibold leading-tight tracking-normal text-[#f6f0e8]">Calendario</h1>
        <p className="mt-1 text-base text-[#b9aea1]">{rangeLabel}</p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
        <DateNavigator view={view} dateParam={dateParam} />
        <ViewSelector currentView={view} dateParam={dateParam} />
      </div>
    </div>
  );
}

async function getExternalPendingReservations(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  startDate: string,
  endDate: string,
) {
  const { data: groupEventsData } = await supabase
    .from('group_events')
    .select('id, name, event_date, entry_time, status, total_pax, customer_phone, extras')
    .eq('status', 'pending')
    .gte('event_date', startDate)
    .lte('event_date', endDate)
    .order('event_date', { ascending: true })
    .order('entry_time', { ascending: true })
    .order('name', { ascending: true });

  const pendingGroupEvents = (groupEventsData ?? []) as PendingGroupEventRow[];
  const groupEventIds = pendingGroupEvents.map((event) => event.id);

  if (groupEventIds.length === 0) {
    return [];
  }

  const { data: submissionsData } = await supabase
    .from('external_reservation_submissions')
    .select('group_event_id, source_label, preferred_language, submitted_at')
    .in('group_event_id', groupEventIds);

  const submissionsByEventId = new Map<string, ExternalReservationSubmissionRow>();
  ((submissionsData ?? []) as ExternalReservationSubmissionRow[]).forEach((submission) => {
    submissionsByEventId.set(submission.group_event_id, submission);
  });

  return pendingGroupEvents.flatMap((event) => {
    const submission = submissionsByEventId.get(event.id);
    if (!submission) return [];
    return [
      {
        ...event,
        source_label: submission.source_label,
        preferred_language: submission.preferred_language,
        submitted_at: submission.submitted_at,
      },
    ];
  });
}

async function enrichExternalReservations(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  events: GroupEventDailyDetail[],
) {
  const eventIds = Array.from(new Set(events.map((event) => event.group_event_id).filter(Boolean)));

  if (eventIds.length === 0) {
    return events.map((event) => ({
      ...event,
      isExternalReservation: false,
      externalSourceLabel: null,
    }));
  }

  const { data: submissionsData } = await supabase
    .from('external_reservation_submissions')
    .select('group_event_id, source_label')
    .in('group_event_id', eventIds);

  const submissionsByEventId = new Map<string, string | null>();
  ((submissionsData ?? []) as Pick<ExternalReservationSubmissionRow, 'group_event_id' | 'source_label'>[]).forEach(
    (submission) => {
      submissionsByEventId.set(submission.group_event_id, submission.source_label);
    },
  );

  return events.map((event) => {
    const hasExternalSubmission = submissionsByEventId.has(event.group_event_id);
    return {
      ...event,
      isExternalReservation: hasExternalSubmission,
      externalSourceLabel: hasExternalSubmission ? submissionsByEventId.get(event.group_event_id) ?? null : null,
    };
  });
}

// FIX: unify day/week/month data source using v_group_events_daily_detail
async function getWeekData(weekStart: string) {
  const weekDates = getWeekDates(weekStart);
  const weekEnd = weekDates[6];
  const supabase = createSupabaseAdminClient();

  const [{ data: statusesData }, { data: eventsData }, externalPendingReservations] = await Promise.all([
    supabase
      .from('v_day_status')
      .select('*')
      .in('event_date', weekDates)
      .order('event_date', { ascending: true }),
    supabase
      .from('v_group_events_daily_detail')
      .select('*')
      .in('event_date', weekDates)
      .order('event_date', { ascending: true })
      .order('entry_time', { ascending: true }),
    getExternalPendingReservations(supabase, weekStart, weekEnd),
  ]);

  const statusesMap = new Map<string, DayStatusRow>();
  (statusesData ?? []).forEach((row) => {
    statusesMap.set(row.event_date, row as DayStatusRow);
  });

  const eventsByDate = new Map<string, GroupEventDailyDetail[]>();
  const enrichedEvents = await enrichExternalReservations(supabase, (eventsData ?? []) as GroupEventDailyDetail[]);
  for (const event of enrichedEvents) {
    const key = event.event_date;
    if (!key) continue;
    const list = eventsByDate.get(key) ?? [];
    list.push(event);
    eventsByDate.set(key, list);
  }

  return { weekEnd, statusesMap, eventsByDate, externalPendingReservations };
}

async function getDayData(selectedDate: string) {
  const supabase = createSupabaseAdminClient();
  const [{ data: dayStatusData }, { data: eventsData }, externalPendingReservations] = await Promise.all([
    supabase.from('v_day_status').select('*').eq('event_date', selectedDate).maybeSingle(),
    supabase
      .from('v_group_events_daily_detail')
      .select('*')
      .eq('event_date', selectedDate)
      .order('entry_time', { ascending: true })
      .order('group_name', { ascending: true }),
    getExternalPendingReservations(supabase, selectedDate, selectedDate),
  ]);

  const dayStatus: DayStatusRow =
    dayStatusData ?? {
      event_date: selectedDate,
      validated: false,
      is_validated: false,
      needs_revalidation: false,
      notes_general: '',
      notes_kitchen: '',
      notes_maintenance: '',
    };

  const reservations = await enrichExternalReservations(supabase, (eventsData ?? []) as GroupEventDailyDetail[]);
  return { dayStatus, reservations, externalPendingReservations };
}

async function getMonthData(monthDate: Date) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = startOfWeek(monthEnd);
  calendarEnd.setDate(calendarEnd.getDate() + 6);

  const days: string[] = [];
  const cursor = new Date(calendarStart);
  while (cursor <= calendarEnd) {
    days.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const supabase = createSupabaseAdminClient();
  const [{ data }, externalPendingReservations] = await Promise.all([
    supabase
      .from('v_group_events_daily_detail')
      .select('*')
      .in('event_date', days)
      .order('event_date', { ascending: true })
      .order('entry_time', { ascending: true }),
    getExternalPendingReservations(supabase, days[0], days[days.length - 1]),
  ]);

  const eventsByDate = new Map<string, GroupEventDailyDetail[]>();
  const enrichedEvents = await enrichExternalReservations(supabase, (data ?? []) as GroupEventDailyDetail[]);
  for (const event of enrichedEvents) {
    const key = event.event_date;
    if (!key) continue;
    const list = eventsByDate.get(key) ?? [];
    list.push(event);
    eventsByDate.set(key, list);
  }

  return { calendarStart: days[0], calendarEnd: days[days.length - 1], eventsByDate, externalPendingReservations };
}

function WeekView({
  weekStart,
  statusesMap,
  eventsByDate,
  externalPendingReservations,
}: {
  weekStart: string;
  statusesMap: Map<string, DayStatusRow>;
  eventsByDate: Map<string, GroupEventDailyDetail[]>;
  externalPendingReservations: ExternalPendingReservation[];
}) {
  const weekDays = Array.from({ length: 7 }).map((_, idx) => addDays(weekStart, idx));
  const metrics = getPeriodMetrics(eventsByDate);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-[#4a3f32]/70 bg-[#181715]/95 shadow-[0_24px_80px_-56px_rgba(0,0,0,0.95)]">
        <div className="grid grid-cols-1 divide-y divide-[#3c342a]/70 lg:grid-cols-7 lg:divide-x lg:divide-y-0">
        {weekDays.map((day) => {
          const dayEvents = eventsByDate.get(day) ?? [];
          const statusRow = statusesMap.get(day);
          const badge = validationBadge(statusRow);
          const dayLabel = formatDayHeader(day);

          return (
            <div key={day} className="group/day flex min-h-[28rem] flex-col bg-[#181715] transition-colors hover:bg-[#1c1a17]">
              <Link
                href={`/reservas?view=day&date=${day}`}
                className="flex flex-col items-start gap-3 border-b border-[#3c342a]/70 px-4 py-4 2xl:flex-row 2xl:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-[0.95rem] font-semibold leading-tight text-[#f3eadf]">{dayLabel.label}</p>
                  <p className="mt-1 text-sm text-[#9d9285]">{dayLabel.iso}</p>
                </div>
                <span
                  className={`${validationBadgeClass} ${badge.className}`}
                >
                  {badge.label}
                </span>
              </Link>

              <div className="flex flex-1 flex-col gap-3 px-3 py-3">
                {dayEvents.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[#776f65]">
                    <CalendarDaysIcon className="h-9 w-9 stroke-[1.25]" aria-hidden="true" />
                    <p className="text-sm">Sin reservas</p>
                  </div>
                ) : (
                  dayEvents.map((evt) => {
                    const status = statusBadge(evt.status);
                    return (
                      <Link
                        key={evt.group_event_id}
                        href={`/reservas/grupo/${evt.group_event_id}?date=${evt.event_date}`}
                        className={`group rounded-xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 hover:-translate-y-0.5 ${reservationCardClassName(evt.status)}`}
                      >
                        <div className="flex flex-wrap items-start gap-2">
                          <div className="min-w-0 flex-1 basis-32">
                            <p className="text-xs font-medium tabular-nums text-[#c99a61]">
                              {evt.entry_time ? evt.entry_time.slice(0, 5) : 'Sin hora'}
                            </p>
                            <h3 className="mt-1 min-w-0 break-words text-[0.95rem] font-semibold leading-tight text-[#f5eee4]">
                              {evt.group_name}
                            </h3>
                          </div>
                          <div className="flex shrink-0 flex-wrap justify-end gap-1">
                            {evt.isExternalReservation ? <ExternalReservationBadge sourceLabel={evt.externalSourceLabel} /> : null}
                            <span className={`w-fit shrink-0 rounded-full border px-2 py-1 text-[0.66rem] font-semibold leading-none ${status.className}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-[#b9aea1]">{evt.total_pax ?? '-'} personas</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#8f8578]">{getReservationMeta(evt)}</p>
                      </Link>
                    );
                  })
                )}
              </div>

              <div className="border-t border-[#3c342a]/70 px-4 py-3 text-center text-sm text-[#8f8578]">
                {dayEvents.length}{' '}
                {dayEvents.length === 1 ? 'reserva' : 'reservas'}
              </div>
            </div>
          );
        })}
        </div>
      </section>

      <MetricStrip
        reservations={metrics.reservations}
        totalPax={metrics.totalPax}
        confirmed={metrics.confirmed}
        externalPendingCount={externalPendingReservations.length}
        busiestDay={metrics.busiestDay}
        busiestCount={metrics.busiestCount}
        busiestPax={metrics.busiestPax}
      />
      <ExternalPendingList reservations={externalPendingReservations} />
    </div>
  );
}

function MetricStrip({
  reservations,
  totalPax,
  confirmed,
  externalPendingCount,
  busiestDay,
  busiestCount,
  busiestPax,
}: {
  reservations: number;
  totalPax: number;
  confirmed: number;
  externalPendingCount: number;
  busiestDay: string | null;
  busiestCount: number;
  busiestPax: number;
}) {
  const metrics = [
    {
      label: 'Reservas del periodo',
      value: reservations,
      detail: reservations === 1 ? '1 grupo cargado' : `${reservations} grupos cargados`,
      icon: CalendarDaysIcon,
    },
    {
      label: 'Comensales totales',
      value: totalPax,
      detail: 'Suma de pax en reservas',
      icon: UsersIcon,
    },
    {
      label: 'Día con más reservas',
      value: busiestDay ? formatMetricDate(busiestDay) : 'Sin datos',
      detail: busiestDay ? `${busiestCount} reservas · ${busiestPax} pax` : 'No hay reservas en el periodo',
      icon: Squares2X2Icon,
    },
    {
      label: 'Confirmadas',
      value: confirmed,
      detail: 'Solo reservas confirmadas',
      icon: CheckCircleIcon,
    },
    {
      label: 'Externas pendientes',
      value: externalPendingCount,
      detail: 'Solicitudes del periodo',
      icon: InboxStackIcon,
    },
  ];

  return (
    <section className="grid overflow-hidden rounded-2xl border border-[#4a3f32]/70 bg-[#181715]/95 shadow-[0_18px_70px_-58px_rgba(0,0,0,0.95)] sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <article key={metric.label} className="flex items-center gap-4 border-b border-[#3c342a]/70 px-5 py-4 last:border-b-0 sm:[&:nth-child(2n+1)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#6f5434]/60 bg-[#3a2d20]/70 text-[#e0b77b]">
              <Icon className="h-5 w-5 stroke-[1.7]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-[#a99d90]">{metric.label}</p>
              <p className="mt-1 truncate text-2xl font-semibold leading-none text-[#f6f0e8] tabular-nums">{metric.value}</p>
              <p className="mt-1 truncate text-xs text-[#7f766b]">{metric.detail}</p>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ExternalPendingList({ reservations }: { reservations: ExternalPendingReservation[] }) {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-[#4a3f32]/70 bg-[#181715]/95 shadow-[0_18px_70px_-58px_rgba(0,0,0,0.95)]"
      aria-labelledby="external-pending-heading"
    >
      <div className="flex flex-col gap-1 border-b border-[#3c342a]/70 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="external-pending-heading" className="text-lg font-semibold text-[#f6f0e8]">
            Solicitudes externas pendientes
          </h2>
          <p className="mt-1 text-sm text-[#a99d90]">{getExternalPendingCountLabel(reservations.length)}</p>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#bda37f]">Periodo visible</p>
      </div>

      {reservations.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-5 text-sm text-[#b9aea1]">
          <InboxStackIcon className="h-5 w-5 shrink-0 text-[#8f8578]" aria-hidden="true" />
          No hay solicitudes externas pendientes en este periodo.
        </div>
      ) : (
        <div className="divide-y divide-[#3c342a]/70">
          {reservations.map((reservation) => {
            const sourceLabel = cleanText(reservation.source_label);
            const phone = cleanText(reservation.customer_phone);
            const comment = cleanText(reservation.extras);
            return (
              <Link
                key={reservation.id}
                href={`/reservas/grupo/${reservation.id}?date=${reservation.event_date}`}
                className="grid gap-3 px-5 py-4 transition-colors hover:bg-[#211f1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c99555]/45 md:grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.7fr)_auto] md:items-center"
              >
                <div className="shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-[#ffe2b6]">
                    {formatExternalPendingDate(reservation.event_date)}
                  </p>
                  <p className="mt-1 text-sm tabular-nums text-[#c99a61]">
                    {reservation.entry_time ? reservation.entry_time.slice(0, 5) : 'Sin hora'}
                  </p>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="min-w-0 break-words text-[0.95rem] font-semibold leading-tight text-[#f6f0e8]">
                      {reservation.name ?? 'Solicitud sin nombre'}
                    </p>
                    <span className="shrink-0 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[0.66rem] font-semibold leading-none text-sky-200">
                      Pendiente
                    </span>
                  </div>
                  <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm text-[#b9aea1]">
                    <span>{reservation.total_pax ?? '-'} pax</span>
                    {phone ? <span>Tel. {phone}</span> : null}
                    {sourceLabel ? <span>{sourceLabel}</span> : null}
                  </p>
                  {comment ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#8f8578]">{comment}</p> : null}
                </div>

                <span className="inline-flex w-fit items-center justify-center rounded-xl border border-[#6f5434]/70 bg-[#3a2d20]/70 px-3 py-2 text-sm font-semibold text-[#ffe2b6] md:justify-self-end">
                  Ver solicitud
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DayView({
  selectedDate,
  dayStatus,
  reservations,
  externalPendingReservations,
}: {
  selectedDate: string;
  dayStatus: DayStatusRow;
  reservations: GroupEventDailyDetail[];
  externalPendingReservations: ExternalPendingReservation[];
}) {
  const badge = validationBadge(dayStatus);
  const metrics = getPeriodMetrics(new Map([[selectedDate, reservations]]));
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-[#4a3f32]/70 bg-[#181715]/95 p-5 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-[#f6f0e8]">Detalle del día</h2>
          <p className="text-[#b9aea1]">{formatLongDate(selectedDate)}</p>
          <Link href={`/reservas?view=week&date=${selectedDate}`} className="inline-flex text-sm font-medium text-[#d6a76e] hover:text-[#f0c58b]">
            Volver a la vista semanal
          </Link>
        </div>
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <MetricStrip
        reservations={metrics.reservations}
        totalPax={metrics.totalPax}
        confirmed={metrics.confirmed}
        externalPendingCount={externalPendingReservations.length}
        busiestDay={metrics.busiestDay}
        busiestCount={metrics.busiestCount}
        busiestPax={metrics.busiestPax}
      />

      <ExternalPendingList reservations={externalPendingReservations} />

      <DayNotesPanel
        eventDate={selectedDate}
        initialNotesGeneral={dayStatus.notes_general ?? ''}
        initialNotesKitchen={dayStatus.notes_kitchen ?? ''}
        initialNotesMaintenance={dayStatus.notes_maintenance ?? ''}
        initialValidated={Boolean(dayStatus.validated ?? dayStatus.is_validated)}
        initialNeedsRevalidation={Boolean(dayStatus.needs_revalidation)}
        initialValidatedBy={dayStatus.last_validated_by}
        initialValidatedAt={dayStatus.last_validated_at}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#f6f0e8]">Reservas del día</h2>
          <Link href={`/reservas?view=week&date=${selectedDate}`} className="text-xs font-medium text-[#d6a76e] hover:text-[#f0c58b]">
            Ver semana
          </Link>
        </div>
        {reservations.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-[#4a3f32]/70 bg-[#181715]/95 p-5 text-sm text-[#b9aea1]">
            <ClockIcon className="h-5 w-5 text-[#8f8578]" aria-hidden="true" />
            No hay grupos para esta fecha.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {reservations.map((reservation) => (
              <ReservationOutcomeCard
                key={reservation.group_event_id}
                groupEventId={reservation.group_event_id}
                groupName={reservation.group_name}
                entryTime={reservation.entry_time}
                totalPax={reservation.total_pax}
                eventMode={reservation.event_mode}
                adults={reservation.adults}
                childrenCount={reservation.children}
                roomName={reservation.room_name ?? null}
                partyRoomName={reservation.party_room_name ?? null}
                status={reservation.status}
                hasPrivateDiningRoom={reservation.has_private_dining_room}
                hasPrivateParty={reservation.has_private_party}
                serviceOutcome={reservation.service_outcome}
                serviceOutcomeNotes={reservation.service_outcome_notes}
                eventDate={reservation.event_date}
                secondCourseType={reservation.second_course_type}
                menuText={reservation.menu_text}
                allergensAndDiets={reservation.allergens_and_diets}
                extras={reservation.extras}
                setupNotes={reservation.setup_notes}
                invoiceData={reservation.invoice_data}
                isExternalReservation={reservation.isExternalReservation}
                externalSourceLabel={reservation.externalSourceLabel}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MobileMonthAgenda({
  days,
  eventsByDate,
  referenceMonth,
}: {
  days: string[];
  eventsByDate: Map<string, GroupEventDailyDetail[]>;
  referenceMonth: Date;
}) {
  const referenceMonthKey = `${referenceMonth.getFullYear()}-${referenceMonth.getMonth()}`;
  const agendaDays = days
    .map((day) => {
      const dateObj = new Date(day);
      const events = eventsByDate.get(day) ?? [];
      const totalPax = events.reduce((sum, event) => sum + (event.total_pax ?? 0), 0);
      const isCurrentMonth = `${dateObj.getFullYear()}-${dateObj.getMonth()}` === referenceMonthKey;
      return { day, events, totalPax, isCurrentMonth };
    })
    .filter(({ events, isCurrentMonth }) => isCurrentMonth || events.length > 0);

  if (agendaDays.length === 0) {
    return (
      <section className="rounded-2xl border border-[#4a3f32]/70 bg-[#181715]/95 p-5 text-sm text-[#b9aea1] shadow-[0_24px_80px_-56px_rgba(0,0,0,0.95)] md:hidden">
        <div className="flex items-center gap-3">
          <CalendarDaysIcon className="h-5 w-5 text-[#8f8578]" aria-hidden="true" />
          No hay días disponibles para este mes.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 md:hidden" aria-label="Agenda mensual">
      {agendaDays.map(({ day, events, totalPax, isCurrentMonth }) => {
        const label = formatMonthAgendaDay(day);

        if (events.length === 0) {
          return (
            <Link
              key={day}
              href={`/reservas?view=day&date=${day}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#3f362c]/70 bg-[#171512]/90 px-4 py-3 text-sm shadow-[0_16px_48px_-42px_rgba(0,0,0,0.95)] transition-colors hover:bg-[#211f1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99555]/45"
            >
              <div className="min-w-0">
                <p className="text-[0.95rem] font-semibold leading-tight text-[#efe8dc]">{label.weekday}</p>
                <p className="mt-0.5 text-xs text-[#8f8578]">{label.compact}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8f8578]">Sin reservas</p>
                <p className="mt-1 text-sm font-semibold text-[#d6a76e]">Abrir día</p>
              </div>
            </Link>
          );
        }

        return (
          <article
            key={day}
            className={`overflow-hidden rounded-2xl border shadow-[0_24px_80px_-56px_rgba(0,0,0,0.95)] ${
              isCurrentMonth ? 'border-[#4a3f32]/70 bg-[#181715]/95' : 'border-[#3f362c]/70 bg-[#151411]/95'
            }`}
          >
            <Link
              href={`/reservas?view=day&date=${day}`}
              className="flex items-start justify-between gap-3 border-b border-[#3c342a]/70 px-4 py-3 transition-colors hover:bg-[#211f1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99555]/45"
            >
              <div className="min-w-0">
                <p className={`text-[0.95rem] font-semibold leading-tight ${isCurrentMonth ? 'text-[#f6f0e8]' : 'text-[#b9aea1]'}`}>
                  {label.weekday}
                </p>
                <p className={`mt-0.5 text-sm ${isCurrentMonth ? 'text-[#b9aea1]' : 'text-[#7f766b]'}`}>{label.compact}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-[#ffe2b6]">
                  {events.length} {events.length === 1 ? 'reserva' : 'reservas'}
                </p>
                <p className="mt-0.5 text-xs text-[#9d9285]">{totalPax} pax</p>
              </div>
            </Link>

            <div className="space-y-2.5 p-3">
              {events.map((event) => {
                const status = statusBadge(event.status);
                return (
                  <Link
                    key={event.group_event_id}
                    href={`/reservas/grupo/${event.group_event_id}?date=${event.event_date}`}
                    className={`block rounded-xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99555]/45 ${reservationCardClassName(event.status)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 shrink-0 rounded-lg border border-[#5b4934]/70 bg-[#151412]/80 px-2 py-1.5 text-center text-xs font-semibold tabular-nums text-[#d6a76e]">
                        {event.entry_time ? event.entry_time.slice(0, 5) : '--:--'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <h3 className="min-w-0 flex-1 break-words text-[0.95rem] font-semibold leading-tight text-[#f5eee4]">
                            {event.group_name}
                          </h3>
                          <div className="flex shrink-0 flex-wrap justify-end gap-1">
                            {event.isExternalReservation ? <ExternalReservationBadge sourceLabel={event.externalSourceLabel} /> : null}
                            <span className={`w-fit shrink-0 rounded-full border px-2 py-1 text-[0.66rem] font-semibold leading-none ${status.className}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-[#b9aea1]">{event.total_pax ?? '-'} pax</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#8f8578]">
                          {getReservationMeta(event)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function MonthView({
  calendarStart,
  calendarEnd,
  eventsByDate,
  referenceMonth,
  externalPendingReservations,
}: {
  calendarStart: string;
  calendarEnd: string;
  eventsByDate: Map<string, GroupEventDailyDetail[]>;
  referenceMonth: Date;
  externalPendingReservations: ExternalPendingReservation[];
}) {
  const days: string[] = [];
  const cursor = new Date(calendarStart);
  const endDate = new Date(calendarEnd);
  while (cursor <= endDate) {
    days.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const refMonth = referenceMonth.getMonth();
  const metrics = getPeriodMetrics(eventsByDate);

  return (
    <div className="space-y-5">
      <MobileMonthAgenda days={days} eventsByDate={eventsByDate} referenceMonth={referenceMonth} />

      <section className="hidden overflow-hidden rounded-2xl border border-[#4a3f32]/70 bg-[#181715]/95 shadow-[0_24px_80px_-56px_rgba(0,0,0,0.95)] md:block">
        <div className="overflow-x-auto md:overflow-x-visible">
          <div className="min-w-[760px] md:min-w-0">
            <div className="grid grid-cols-7 border-b border-[#3c342a]/70 bg-[#1b1916] text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#bda37f]">
              {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((d) => (
                <span key={d} className="px-3 py-4">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 border-l border-t border-[#3c342a]/70 bg-[#181715] [grid-auto-rows:minmax(8.5rem,1fr)]">
              {days.map((day) => {
                const dateObj = new Date(day);
                const isCurrentMonth = dateObj.getMonth() === refMonth;
                const dayEvents = eventsByDate.get(day) ?? [];
                const extraCount = dayEvents.length > 2 ? dayEvents.length - 2 : 0;

                return (
                  <div
                    key={day}
                    className={`group/cell relative min-h-[8.5rem] border-b border-r border-[#3c342a]/70 p-3 text-left transition-colors ${
                      isCurrentMonth
                        ? 'bg-[#181715] hover:bg-[#211f1b]'
                        : 'bg-[#141311] text-[#6f675d] hover:bg-[#1a1815]'
                    }`}
                  >
                    <Link
                      href={`/reservas?view=day&date=${day}`}
                      className="absolute inset-0 z-0"
                      aria-label={`Ver detalle del dia ${day}`}
                    />
                    <div className="relative z-10 flex items-start justify-between gap-2">
                      <span className={`text-base font-semibold tabular-nums ${isCurrentMonth ? 'text-[#efe8dc]' : 'text-[#756c61]'}`}>
                        {dateObj.getDate()}
                      </span>
                      {dayEvents.length > 0 ? (
                        <span className="rounded-full border border-[#8b6a43]/50 bg-[#7d5932]/50 px-2 py-0.5 text-[0.68rem] font-semibold leading-none text-[#ffe2b6]">
                          {dayEvents.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="relative z-10 mt-3 space-y-1.5">
                      {dayEvents.slice(0, 2).map((evt) => (
                        <Link
                          key={evt.group_event_id}
                          href={`/reservas/grupo/${evt.group_event_id}?date=${evt.event_date}`}
                          className={`block rounded-md border px-2 py-1.5 text-xs leading-tight transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99555]/45 ${monthReservationClassName(evt.status)}`}
                        >
                          <div className="flex items-start gap-1.5">
                            <p className="min-w-0 flex-1 truncate font-medium">{evt.group_name}</p>
                            <div className="flex shrink-0 flex-wrap justify-end gap-1">
                              {evt.isExternalReservation ? <ExternalReservationBadge sourceLabel={evt.externalSourceLabel} /> : null}
                              <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[0.58rem] font-semibold leading-none ${statusBadge(evt.status).className}`}>
                                {statusBadge(evt.status).label}
                              </span>
                            </div>
                          </div>
                          <p className="mt-0.5 truncate text-[0.68rem] text-[#9d9285]">
                            {evt.entry_time ? evt.entry_time.slice(0, 5) : 'Sin hora'} · {evt.total_pax ?? '-'} pax
                            {evt.event_mode === 'private_party_only' ? ' · Solo fiesta privada' : ''}
                            {evt.event_mode === 'dinner_private_party' ? ' · Cena + fiesta privada' : ''}
                          </p>
                        </Link>
                      ))}
                      {extraCount > 0 ? (
                        <Link
                          href={`/reservas?view=day&date=${day}`}
                          className="inline-flex px-1 text-xs font-semibold text-[#d6a76e] hover:text-[#f0c58d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99555]/45"
                        >
                          +{extraCount} más
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <MetricStrip
        reservations={metrics.reservations}
        totalPax={metrics.totalPax}
        confirmed={metrics.confirmed}
        externalPendingCount={externalPendingReservations.length}
        busiestDay={metrics.busiestDay}
        busiestCount={metrics.busiestCount}
        busiestPax={metrics.busiestPax}
      />
      <ExternalPendingList reservations={externalPendingReservations} />
    </div>
  );
}

export default async function ReservasPage({ searchParams }: { searchParams?: SearchParams }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/reservas?view=week')}`);
  }

  noStore();
  const viewParam = searchParams?.view;
  const view: 'month' | 'week' | 'day' = viewParam === 'month' || viewParam === 'day' ? viewParam : 'week';
  const baseDate = parseDate(searchParams?.date);
  const dateParam = toISODate(baseDate);

  if (view === 'week') {
    const weekStart = toISODate(startOfWeek(baseDate));
    const { weekEnd, statusesMap, eventsByDate, externalPendingReservations } = await getWeekData(weekStart);
    return (
      <div className="reservas-calendar-pilot min-h-[calc(100dvh-4.5rem)] space-y-6 bg-[#12110f] px-4 py-5 text-[#efe8dc] md:px-6 lg:px-8">
        <ReservasPilotChromeStyles />
        <HeaderBar view={view} dateParam={weekStart} rangeLabel={formatWeekRange(weekStart, weekEnd)} />
        <WeekView
          weekStart={weekStart}
          statusesMap={statusesMap}
          eventsByDate={eventsByDate}
          externalPendingReservations={externalPendingReservations}
        />
      </div>
    );
  }

  if (view === 'day') {
    const selectedDate = dateParam;
    const { dayStatus, reservations, externalPendingReservations } = await getDayData(selectedDate);
    return (
      <div className="reservas-calendar-pilot min-h-[calc(100dvh-4.5rem)] space-y-6 bg-[#12110f] px-4 py-5 text-[#efe8dc] md:px-6 lg:px-8">
        <ReservasPilotChromeStyles />
        <HeaderBar view={view} dateParam={selectedDate} rangeLabel={formatLongDate(selectedDate)} />
        <DayView
          selectedDate={selectedDate}
          dayStatus={dayStatus}
          reservations={reservations}
          externalPendingReservations={externalPendingReservations}
        />
      </div>
    );
  }

  const { calendarStart, calendarEnd, eventsByDate, externalPendingReservations } = await getMonthData(baseDate);
  return (
    <div className="reservas-calendar-pilot min-h-[calc(100dvh-4.5rem)] space-y-6 bg-[#12110f] px-4 py-5 text-[#efe8dc] md:px-6 lg:px-8">
      <ReservasPilotChromeStyles />
      <HeaderBar view={view} dateParam={dateParam} rangeLabel={formatMonthLabel(baseDate)} />
      <MonthView
        calendarStart={calendarStart}
        calendarEnd={calendarEnd}
        eventsByDate={eventsByDate}
        referenceMonth={baseDate}
        externalPendingReservations={externalPendingReservations}
      />
    </div>
  );
}
