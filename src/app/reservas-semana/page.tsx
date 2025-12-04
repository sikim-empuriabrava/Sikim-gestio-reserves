import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabaseClient';

type DayStatus = {
  event_date: string;
  is_validated?: boolean | null;
  day_notes?: string | null;
  groups_count?: number | null;
  group_count?: number | null;
  total_pax?: number | null;
  pax_total?: number | null;
};

type ReservationDetail = {
  event_date: string;
  entry_time: string | null;
  group_name: string;
  total_pax: number | null;
};

function startOfWeekMonday(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // convert Sunday (0) to 6, Monday (1) to 0
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function formatShortDate(dateString: string) {
  const formatter = new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return formatter.format(new Date(dateString)).replace('.', '');
}

function toISODate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);
}

export default async function ReservasSemanaPage() {
  const today = new Date();
  const weekStart = startOfWeekMonday(today);
  const startDate = toISODate(weekStart);

  const endDateObj = new Date(weekStart);
  endDateObj.setUTCDate(weekStart.getUTCDate() + 13);
  const endDate = toISODate(endDateObj);

  const supabase = createSupabaseServerClient();

  const [{ data: dayStatusData, error: dayStatusError }, { data: reservationsData, error: reservationsError }] =
    await Promise.all([
      supabase
        .from('v_day_status')
        .select('*')
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .order('event_date', { ascending: true }),
      supabase
        .from('v_group_events_daily_detail')
        .select('event_date, entry_time, group_name, total_pax')
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .order('event_date', { ascending: true })
        .order('entry_time', { ascending: true }),
    ]);

  if (dayStatusError) {
    console.error('[Supabase error v_day_status]', dayStatusError.message);
  }
  if (reservationsError) {
    console.error('[Supabase error v_group_events_daily_detail]', reservationsError.message);
  }

  const dayStatusByDate = new Map<string, DayStatus>();
  dayStatusData?.forEach((item) => {
    dayStatusByDate.set(item.event_date, item as DayStatus);
  });

  const reservasByDate = new Map<string, ReservationDetail[]>();
  reservationsData?.forEach((item) => {
    const list = reservasByDate.get(item.event_date) ?? [];
    list.push(item as ReservationDetail);
    reservasByDate.set(item.event_date, list);
  });

  const days: {
    eventDate: string;
    groupsCount: number;
    totalPax: number;
    isValidated: boolean;
    reservations: ReservationDetail[];
  }[] = [];

  for (let i = 0; i < 14; i++) {
    const currentDate = new Date(weekStart);
    currentDate.setUTCDate(weekStart.getUTCDate() + i);
    const eventDate = toISODate(currentDate);
    const status = dayStatusByDate.get(eventDate);
    const reservations = reservasByDate.get(eventDate) ?? [];

    const groupsCountFromStatus = status?.groups_count ?? status?.group_count ?? null;
    const totalPaxFromStatus = status?.total_pax ?? status?.pax_total ?? null;

    const groupsCount = groupsCountFromStatus ?? reservations.length;
    const totalPax =
      totalPaxFromStatus ??
      reservations.reduce((acc, curr) => acc + (typeof curr.total_pax === 'number' ? curr.total_pax : 0), 0);

    days.push({
      eventDate,
      groupsCount,
      totalPax,
      isValidated: Boolean(status?.is_validated),
      reservations,
    });
  }

  const currentWeek = days.slice(0, 7);
  const nextWeek = days.slice(7);

  const WeekSection = ({ title, items }: { title: string; items: typeof days }) => (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((day) => {
          const previewReservations = day.reservations.slice(0, 3);
          const remaining = day.reservations.length - previewReservations.length;

          return (
            <div
              key={day.eventDate}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-2 shadow-inner shadow-black/30"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{formatShortDate(day.eventDate)}</p>
                  <p className="text-xs text-slate-400">{day.eventDate}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    day.isValidated
                      ? 'bg-emerald-500/20 text-emerald-100'
                      : 'bg-slate-700/60 text-slate-200'
                  }`}
                >
                  {day.isValidated ? 'Validado' : 'No validado'}
                </span>
              </div>

              <div className="text-sm text-slate-200">
                {day.groupsCount} grupos · {day.totalPax} pax
              </div>

              <div className="space-y-1 text-sm text-slate-300">
                {previewReservations.length === 0 && <p className="text-slate-500">Sin reservas</p>}
                {previewReservations.map((res, idx) => (
                  <p key={`${res.group_name}-${idx}`} className="flex justify-between gap-2 text-slate-200">
                    <span className="font-mono text-xs text-slate-300">{res.entry_time ? res.entry_time.slice(0, 5) : '—'}</span>
                    <span className="flex-1 truncate px-2 text-slate-100">{res.group_name}</span>
                    <span className="text-right text-slate-200">{res.total_pax ?? '—'} pax</span>
                  </p>
                ))}
                {remaining > 0 && (
                  <p className="text-xs text-slate-400">+{remaining} reservas más…</p>
                )}
              </div>

              <Link
                href={`/reservas-dia?date=${day.eventDate}`}
                className="mt-2 text-xs font-medium text-emerald-300 hover:underline"
              >
                Ver detalle del día
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Resumen semanal de reservas</h1>
      <WeekSection title="Semana actual" items={currentWeek} />
      <WeekSection title="Semana siguiente" items={nextWeek} />
    </div>
  );
}
