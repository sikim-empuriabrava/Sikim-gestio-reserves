import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  Squares2X2Icon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
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
  adults?: number | null;
  children?: number | null;
  has_private_dining_room?: boolean | null;
  has_private_party?: boolean | null;
  room_id?: string | null;
  room_name?: string | null;
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

function formatMetricDate(dateString: string) {
  const label = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(new Date(dateString));
  return label.charAt(0).toUpperCase() + label.slice(1);
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
        label: 'Pendiente',
        className: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
      };
    case 'completed':
      return {
        label: 'Completada',
        className: 'border-emerald-500/25 bg-emerald-900/30 text-emerald-100',
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

function getReservationMeta(event: GroupEventDailyDetail) {
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
    <div className="inline-flex items-center rounded-xl border border-[#4a3f32]/80 bg-[#151412]/90 p-1 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      {views.map((view) => {
        const active = currentView === view.value;
        return (
          <Link
            key={view.value}
            href={`/reservas?view=${view.value}&date=${dateParam}`}
            className={`rounded-lg px-4 py-2 font-semibold transition-colors ${
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
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Link
        href={`/reservas?view=${view}&date=${prevDate}`}
        className="rounded-xl border border-[#4a3f32]/75 bg-[#151412]/90 px-4 py-2 font-medium text-[#efe8dc] transition-colors hover:border-[#8b6a43]/70 hover:bg-[#211f1b] active:translate-y-px"
      >
        Anterior
      </Link>
      <Link
        href={`/reservas?view=${view}&date=${todayForView}`}
        className="rounded-xl border border-[#4a3f32]/75 bg-[#151412]/90 px-4 py-2 font-medium text-[#efe8dc] transition-colors hover:border-[#8b6a43]/70 hover:bg-[#211f1b] active:translate-y-px"
      >
        Hoy
      </Link>
      <Link
        href={`/reservas?view=${view}&date=${nextDate}`}
        className="rounded-xl border border-[#4a3f32]/75 bg-[#151412]/90 px-4 py-2 font-medium text-[#efe8dc] transition-colors hover:border-[#8b6a43]/70 hover:bg-[#211f1b] active:translate-y-px"
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
      <div className="flex flex-wrap items-center gap-3">
        <DateNavigator view={view} dateParam={dateParam} />
        <ViewSelector currentView={view} dateParam={dateParam} />
      </div>
    </div>
  );
}

// FIX: unify day/week/month data source using v_group_events_daily_detail
async function getWeekData(weekStart: string) {
  const weekDates = getWeekDates(weekStart);
  const weekEnd = weekDates[6];
  const supabase = createSupabaseAdminClient();

  const [{ data: statusesData }, { data: eventsData }] = await Promise.all([
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
  ]);

  const statusesMap = new Map<string, DayStatusRow>();
  (statusesData ?? []).forEach((row) => {
    statusesMap.set(row.event_date, row as DayStatusRow);
  });

  const eventsByDate = new Map<string, GroupEventDailyDetail[]>();
  for (const event of eventsData ?? []) {
    const key = event.event_date;
    if (!key) continue;
    const list = eventsByDate.get(key) ?? [];
    list.push(event as GroupEventDailyDetail);
    eventsByDate.set(key, list);
  }

  return { weekEnd, statusesMap, eventsByDate };
}

async function getDayData(selectedDate: string) {
  const supabase = createSupabaseAdminClient();
  const [{ data: dayStatusData }, { data: eventsData }] = await Promise.all([
    supabase.from('v_day_status').select('*').eq('event_date', selectedDate).maybeSingle(),
    supabase
      .from('v_group_events_daily_detail')
      .select('*')
      .eq('event_date', selectedDate)
      .order('entry_time', { ascending: true })
      .order('group_name', { ascending: true }),
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

  const reservations: GroupEventDailyDetail[] = eventsData ?? [];
  return { dayStatus, reservations };
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
  const { data } = await supabase
    .from('v_group_events_daily_detail')
    .select('*')
    .in('event_date', days)
    .order('event_date', { ascending: true })
    .order('entry_time', { ascending: true });

  const eventsByDate = new Map<string, GroupEventDailyDetail[]>();
  for (const event of data ?? []) {
    const key = event.event_date;
    if (!key) continue;
    const list = eventsByDate.get(key) ?? [];
    list.push(event as GroupEventDailyDetail);
    eventsByDate.set(key, list);
  }

  return { calendarStart: days[0], calendarEnd: days[days.length - 1], eventsByDate };
}

function WeekView({
  weekStart,
  statusesMap,
  eventsByDate,
}: {
  weekStart: string;
  statusesMap: Map<string, DayStatusRow>;
  eventsByDate: Map<string, GroupEventDailyDetail[]>;
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
                        className="group rounded-xl border border-[#4a3f32]/60 bg-[#24221f]/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#8b6a43]/70 hover:bg-[#2a2722]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium tabular-nums text-[#c99a61]">
                              {evt.entry_time ? evt.entry_time.slice(0, 5) : 'Sin hora'}
                            </p>
                            <h3 className="mt-1 truncate text-[0.95rem] font-semibold leading-tight text-[#f5eee4]">
                              {evt.group_name}
                            </h3>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[0.66rem] font-semibold leading-none ${status.className}`}>
                            {status.label}
                          </span>
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
        busiestDay={metrics.busiestDay}
        busiestCount={metrics.busiestCount}
        busiestPax={metrics.busiestPax}
      />
    </div>
  );
}

function MetricStrip({
  reservations,
  totalPax,
  confirmed,
  busiestDay,
  busiestCount,
  busiestPax,
}: {
  reservations: number;
  totalPax: number;
  confirmed: number;
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
      detail: 'Estado confirmed',
      icon: CheckCircleIcon,
    },
  ];

  return (
    <section className="grid overflow-hidden rounded-2xl border border-[#4a3f32]/70 bg-[#181715]/95 shadow-[0_18px_70px_-58px_rgba(0,0,0,0.95)] sm:grid-cols-2 xl:grid-cols-4">
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
function DayView({
  selectedDate,
  dayStatus,
  reservations,
}: {
  selectedDate: string;
  dayStatus: DayStatusRow;
  reservations: GroupEventDailyDetail[];
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
        busiestDay={metrics.busiestDay}
        busiestCount={metrics.busiestCount}
        busiestPax={metrics.busiestPax}
      />

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
                adults={reservation.adults}
                childrenCount={reservation.children}
                roomName={reservation.room_name ?? null}
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
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MonthView({
  calendarStart,
  calendarEnd,
  eventsByDate,
  referenceMonth,
}: {
  calendarStart: string;
  calendarEnd: string;
  eventsByDate: Map<string, GroupEventDailyDetail[]>;
  referenceMonth: Date;
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
      <section className="overflow-hidden rounded-2xl border border-[#4a3f32]/70 bg-[#181715]/95 shadow-[0_24px_80px_-56px_rgba(0,0,0,0.95)]">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 border-b border-[#3c342a]/70 bg-[#1b1916] text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#bda37f]">
              {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((d) => (
                <span key={d} className="px-3 py-4">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 bg-[#3c342a]/70 [grid-auto-rows:minmax(8.5rem,1fr)] gap-px">
              {days.map((day) => {
                const dateObj = new Date(day);
                const isCurrentMonth = dateObj.getMonth() === refMonth;
                const dayEvents = eventsByDate.get(day) ?? [];
                const extraCount = dayEvents.length > 2 ? dayEvents.length - 2 : 0;

                return (
                  <div
                    key={day}
                    className={`group/cell relative min-h-[8.5rem] p-3 text-left transition-colors ${
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
                          className="block rounded-md border border-[#4a3f32]/60 bg-[#24221f]/70 px-2 py-1.5 text-xs leading-tight text-[#d8cfc2] transition duration-200 hover:-translate-y-0.5 hover:border-[#8b6a43]/70 hover:bg-[#2c2822] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99555]/45"
                        >
                          <p className="truncate font-medium">{evt.group_name}</p>
                          <p className="mt-0.5 truncate text-[0.68rem] text-[#9d9285]">
                            {evt.entry_time ? evt.entry_time.slice(0, 5) : 'Sin hora'} · {evt.total_pax ?? '-'} pax
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
        busiestDay={metrics.busiestDay}
        busiestCount={metrics.busiestCount}
        busiestPax={metrics.busiestPax}
      />
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
    const { weekEnd, statusesMap, eventsByDate } = await getWeekData(weekStart);
    return (
      <div className="reservas-calendar-pilot min-h-[calc(100dvh-4.5rem)] space-y-6 bg-[#12110f] px-4 py-5 text-[#efe8dc] md:px-6 lg:px-8">
        <ReservasPilotChromeStyles />
        <HeaderBar view={view} dateParam={weekStart} rangeLabel={formatWeekRange(weekStart, weekEnd)} />
        <WeekView weekStart={weekStart} statusesMap={statusesMap} eventsByDate={eventsByDate} />
      </div>
    );
  }

  if (view === 'day') {
    const selectedDate = dateParam;
    const { dayStatus, reservations } = await getDayData(selectedDate);
    return (
      <div className="reservas-calendar-pilot min-h-[calc(100dvh-4.5rem)] space-y-6 bg-[#12110f] px-4 py-5 text-[#efe8dc] md:px-6 lg:px-8">
        <ReservasPilotChromeStyles />
        <HeaderBar view={view} dateParam={selectedDate} rangeLabel={formatLongDate(selectedDate)} />
        <DayView selectedDate={selectedDate} dayStatus={dayStatus} reservations={reservations} />
      </div>
    );
  }

  const { calendarStart, calendarEnd, eventsByDate } = await getMonthData(baseDate);
  return (
    <div className="reservas-calendar-pilot min-h-[calc(100dvh-4.5rem)] space-y-6 bg-[#12110f] px-4 py-5 text-[#efe8dc] md:px-6 lg:px-8">
      <ReservasPilotChromeStyles />
      <HeaderBar view={view} dateParam={dateParam} rangeLabel={formatMonthLabel(baseDate)} />
      <MonthView calendarStart={calendarStart} calendarEnd={calendarEnd} eventsByDate={eventsByDate} referenceMonth={baseDate} />
    </div>
  );
}
