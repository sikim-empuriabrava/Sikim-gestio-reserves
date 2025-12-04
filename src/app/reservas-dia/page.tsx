import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabaseClient';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function getMonday(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

function formatDayLabel(dateString: string) {
  const formatter = new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return formatter.format(new Date(dateString));
}

function formatWeekRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'numeric', year: 'numeric' });
  return `${formatter.format(new Date(startDate))} al ${formatter.format(new Date(endDate))}`;
}

function addDays(dateString: string, days: number) {
  const d = new Date(dateString);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type DayStatusRow = {
  event_date: string;
  is_validated?: boolean | null;
  validated?: boolean | null;
  needs_revalidation?: boolean | null;
};

type GroupEventDailyDetail = {
  event_date: string;
  entry_time: string | null;
  group_event_id: string;
  group_name: string;
  status: string;
  total_pax: number | null;
};

type ReservasSemanaPageProps = {
  searchParams?: { weekStart?: string };
};

export default async function ReservasDiaPage({ searchParams }: ReservasSemanaPageProps) {
  const today = new Date();
  const providedWeekStart = searchParams?.weekStart;
  const baseDate = providedWeekStart && DATE_REGEX.test(providedWeekStart)
    ? new Date(providedWeekStart)
    : getMonday(today);
  const weekStart = getMonday(baseDate).toISOString().slice(0, 10);
  const weekEnd = addDays(weekStart, 6);

  const supabase = createSupabaseServerClient();

  const [{ data: statusesData, error: statusesError }, { data: eventsData, error: eventsError }] =
    await Promise.all([
      supabase
        .from('v_day_status')
        .select('*')
        .gte('event_date', weekStart)
        .lte('event_date', weekEnd)
        .order('event_date', { ascending: true }),
      supabase
        .from('v_group_events_daily_detail')
        .select('*')
        .gte('event_date', weekStart)
        .lte('event_date', weekEnd)
        .order('event_date', { ascending: true })
        .order('entry_time', { ascending: true }),
    ]);

  if (statusesError || eventsError) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Reservas – vista semanal</h1>
            <p className="text-slate-400 text-sm">Semana del {formatWeekRange(weekStart, weekEnd)}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/reservas-dia?weekStart=${addDays(weekStart, -7)}`}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
            >
              Semana anterior
            </Link>
            <Link
              href={`/reservas-dia?weekStart=${addDays(weekStart, 7)}`}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
            >
              Semana siguiente
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-red-900/60 bg-red-950/70 p-4 text-sm text-red-100">
          <p className="font-semibold">No se pudo cargar la información de Supabase.</p>
          <p className="text-red-200">{statusesError?.message || eventsError?.message}</p>
        </div>
      </div>
    );
  }

  const statusesMap = new Map<string, DayStatusRow>();
  (statusesData ?? []).forEach((row) => {
    statusesMap.set(row.event_date, row as DayStatusRow);
  });

  const eventsByDate = new Map<string, GroupEventDailyDetail[]>();
  (eventsData ?? []).forEach((event) => {
    const existing = eventsByDate.get(event.event_date) ?? [];
    existing.push(event as GroupEventDailyDetail);
    eventsByDate.set(event.event_date, existing);
  });

  const weekDays = Array.from({ length: 7 }).map((_, idx) => addDays(weekStart, idx));

  const badgeForDay = (statusRow?: DayStatusRow) => {
    const validated = statusRow?.validated ?? statusRow?.is_validated;
    const needsRevalidation = statusRow?.needs_revalidation;

    if (validated && needsRevalidation) {
      return { label: 'Cambios desde validación', className: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40' };
    }
    if (validated) {
      return { label: 'Validado', className: 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/40' };
    }
    return { label: 'No validado', className: 'bg-slate-700/60 text-slate-200 ring-1 ring-slate-500/40' };
  };

  const statusClass = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/40';
      case 'completed':
        return 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-500/40';
      case 'cancelled':
        return 'bg-slate-700/60 text-slate-200 ring-1 ring-slate-500/40';
      default:
        return 'bg-slate-800/80 text-slate-200 ring-1 ring-slate-700/60';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reservas – vista semanal</h1>
          <p className="text-slate-400 text-sm">Semana del {formatWeekRange(weekStart, weekEnd)}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/reservas-dia?weekStart=${addDays(weekStart, -7)}`}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
          >
            Semana anterior
          </Link>
          <Link
            href={`/reservas-dia?weekStart=${addDays(weekStart, 7)}`}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
          >
            Semana siguiente
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {weekDays.map((day) => {
          const dayEvents = eventsByDate.get(day) ?? [];
          const statusRow = statusesMap.get(day);
          const badge = badgeForDay(statusRow);

          return (
            <div
              key={day}
              className="flex h-full flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{day}</p>
                  <p className="text-lg font-semibold text-slate-100">{formatDayLabel(day)}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {dayEvents.length === 0 && (
                  <p className="text-sm text-slate-400">Sin reservas</p>
                )}
                {dayEvents.map((evt) => (
                  <Link
                    key={evt.group_event_id}
                    href={`/reservas-dia/detalle?date=${evt.event_date}`}
                    className="group rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 transition hover:border-slate-700 hover:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-100">
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
                href={`/reservas-dia/detalle?date=${day}`}
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
