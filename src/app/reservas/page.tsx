import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabaseClient';
import { DayNotesPanel } from '../reservas-dia/detalle/DayNotesPanel';
import { ReservationOutcomeCard } from '../reservas-dia/detalle/ReservationOutcomeCard';

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

function formatDayLabel(dateString: string) {
  const formatter = new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return formatter.format(new Date(dateString));
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

function statusClass(status: string) {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/50';
    case 'draft':
      return 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/50';
    case 'completed':
      return 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/50';
    case 'no_show':
      return 'bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/50';
    case 'incident':
      return 'bg-red-500/25 text-red-100 ring-1 ring-red-400/50';
    case 'cancelled':
      return 'bg-slate-800/70 text-slate-200 ring-1 ring-slate-600/50';
    default:
      return 'bg-slate-800/80 text-slate-100 ring-1 ring-slate-700/70';
  }
}

function validationBadge(statusRow?: DayStatusRow) {
  const validated = statusRow?.validated ?? statusRow?.is_validated;
  const needsRevalidation = statusRow?.needs_revalidation;

  if (validated && needsRevalidation) {
    return { label: 'Cambios desde validación', className: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40' };
  }
  if (validated) {
    return { label: 'Validado', className: 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/40' };
  }
  return { label: 'No validado', className: 'bg-slate-700/60 text-slate-200 ring-1 ring-slate-500/40' };
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
    <div className="inline-flex items-center rounded-lg border border-slate-800 bg-slate-900/70 p-1 text-sm">
      {views.map((view) => {
        const active = currentView === view.value;
        return (
          <Link
            key={view.value}
            href={`/reservas?view=${view.value}&date=${dateParam}`}
            className={`rounded-md px-3 py-1 font-semibold transition ${
              active ? 'bg-primary-600/80 text-white shadow shadow-primary-900/30' : 'text-slate-200 hover:bg-slate-800'
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
    <div className="flex items-center gap-2 text-sm">
      <Link
        href={`/reservas?view=${view}&date=${prevDate}`}
        className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 font-medium text-slate-100 hover:bg-slate-800"
      >
        Anterior
      </Link>
      <Link
        href={`/reservas?view=${view}&date=${todayForView}`}
        className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 font-medium text-slate-100 hover:bg-slate-800"
      >
        Hoy
      </Link>
      <Link
        href={`/reservas?view=${view}&date=${nextDate}`}
        className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 font-medium text-slate-100 hover:bg-slate-800"
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Reservas</h1>
        <p className="text-sm text-slate-400">{rangeLabel}</p>
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
  const supabase = createSupabaseServerClient();

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
  const supabase = createSupabaseServerClient();
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

  const supabase = createSupabaseServerClient();
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {weekDays.map((day) => {
          const dayEvents = eventsByDate.get(day) ?? [];
          const statusRow = statusesMap.get(day);
          const badge = validationBadge(statusRow);

          return (
            <div key={day} className="flex h-full flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{day}</p>
                  <p className="text-lg font-semibold text-slate-100">{formatDayLabel(day)}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap text-center leading-tight ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {dayEvents.length === 0 && <p className="text-sm text-slate-400">Sin reservas</p>}
                {dayEvents.map((evt) => (
                  <Link
                    key={evt.group_event_id}
                    href={`/reservas/grupo/${evt.group_event_id}?date=${evt.event_date}`}
                    className="group rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 transition hover:border-slate-700 hover:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {evt.entry_time ? `${evt.entry_time.slice(0, 5)}h` : '—'} – {evt.group_name}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(evt.status)}`}>
                        {evt.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{evt.total_pax ?? '—'} pax</p>
                  </Link>
                ))}
              </div>

              <Link
                href={`/reservas?view=day&date=${day}`}
                className="mt-auto inline-flex text-xs font-medium text-emerald-300 hover:underline"
              >
                Ver detalle del día
              </Link>
            </div>
          );
        })}
      </div>
    </div>
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
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Detalle del día</h2>
          <p className="text-slate-400">{formatLongDate(selectedDate)}</p>
          <Link href={`/reservas?view=week&date=${selectedDate}`} className="text-sm font-medium text-emerald-300 hover:underline">
            ← Volver a la vista semanal
          </Link>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${badge.className}`}>
          {badge.label}
        </span>
      </div>

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
          <h2 className="text-lg font-semibold text-slate-100">Reservas del día</h2>
          <Link href={`/reservas?view=week&date=${selectedDate}`} className="text-xs font-medium text-emerald-300 hover:underline">
            Ver semana
          </Link>
        </div>
        {reservations.length === 0 ? (
          <p className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200">No hay grupos para esta fecha.</p>
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

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <div className="col-span-full rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dateObj = new Date(day);
            const isCurrentMonth = dateObj.getMonth() === refMonth;
            const dayEvents = eventsByDate.get(day) ?? [];
            const extraCount = dayEvents.length > 3 ? dayEvents.length - 3 : 0;

            return (
              <Link
                key={day}
                href={`/reservas?view=day&date=${day}`}
                className={`rounded-lg border px-2 py-2 text-left text-xs transition ${
                  isCurrentMonth
                    ? 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900'
                    : 'border-slate-900 bg-slate-950/40 text-slate-500 hover:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
                  <span>{dateObj.getDate()}</span>
                  {dayEvents.length > 0 && <span className="rounded-full bg-primary-600/30 px-2 py-0.5 text-[10px] text-primary-50">{dayEvents.length}</span>}
                </div>
                <div className="mt-2 space-y-1 text-[11px] leading-tight text-slate-200">
                  {dayEvents.slice(0, 3).map((evt) => (
                    <p key={evt.group_event_id} className="truncate">
                      {evt.group_name} ({evt.total_pax ?? '—'})
                    </p>
                  ))}
                  {extraCount > 0 && <p className="text-primary-200">+{extraCount} más</p>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default async function ReservasPage({ searchParams }: { searchParams?: SearchParams }) {
  const viewParam = searchParams?.view;
  const view: 'month' | 'week' | 'day' = viewParam === 'month' || viewParam === 'day' ? viewParam : 'week';
  const baseDate = parseDate(searchParams?.date);
  const dateParam = toISODate(baseDate);

  if (view === 'week') {
    const weekStart = toISODate(startOfWeek(baseDate));
    const { weekEnd, statusesMap, eventsByDate } = await getWeekData(weekStart);
    return (
      <div className="p-6 space-y-6">
        <HeaderBar view={view} dateParam={weekStart} rangeLabel={formatWeekRange(weekStart, weekEnd)} />
        <WeekView weekStart={weekStart} statusesMap={statusesMap} eventsByDate={eventsByDate} />
      </div>
    );
  }

  if (view === 'day') {
    const selectedDate = dateParam;
    const { dayStatus, reservations } = await getDayData(selectedDate);
    return (
      <div className="p-6 space-y-6">
        <HeaderBar view={view} dateParam={selectedDate} rangeLabel={formatLongDate(selectedDate)} />
        <DayView selectedDate={selectedDate} dayStatus={dayStatus} reservations={reservations} />
      </div>
    );
  }

  const { calendarStart, calendarEnd, eventsByDate } = await getMonthData(baseDate);
  return (
    <div className="p-6 space-y-6">
      <HeaderBar view={view} dateParam={dateParam} rangeLabel={formatMonthLabel(baseDate)} />
      <MonthView calendarStart={calendarStart} calendarEnd={calendarEnd} eventsByDate={eventsByDate} referenceMonth={baseDate} />
    </div>
  );
}
