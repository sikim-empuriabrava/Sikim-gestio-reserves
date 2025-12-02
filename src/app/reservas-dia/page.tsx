import Link from 'next/link';
import { ReservasDiaDatePicker } from '@/components/ReservasDiaDatePicker';
import { createSupabaseServerClient } from '@/lib/supabaseClient';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type GroupEventDailyDetail = {
  event_date: string;
  entry_time: string | null;
  group_event_id: string;
  group_name: string;
  status: string;
  total_pax: number | null;
  has_private_dining_room: boolean | null;
  has_private_party: boolean | null;
  room_id: string | null;
  room_name: string | null;
  room_total_pax: number | null;
  room_override_capacity: boolean | null;
  recommended_waiters: number | null;
  recommended_runners: number | null;
  recommended_bartenders: number | null;
};

type ReservasDiaPageProps = {
  searchParams?: { date?: string };
};

function formatDateToDisplay(dateString: string) {
  const formatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'full' });
  return formatter.format(new Date(dateString));
}

function getAdjacentDates(selectedDate: string) {
  const date = new Date(selectedDate);

  const prev = new Date(date);
  prev.setDate(date.getDate() - 1);

  const next = new Date(date);
  next.setDate(date.getDate() + 1);

  const toString = (d: Date) => d.toISOString().slice(0, 10);

  return {
    prevDate: toString(prev),
    nextDate: toString(next),
  };
}

function BooleanPill({ value }: { value: boolean | null }) {
  const isTrue = value === true;
  const isFalse = value === false;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isTrue
          ? 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/50'
          : 'bg-slate-700/60 text-slate-200 ring-1 ring-slate-500/40'
      }`}
    >
      {isTrue ? 'Sí' : isFalse ? 'No' : '—'}
    </span>
  );
}

export default async function ReservasDiaPage({ searchParams }: ReservasDiaPageProps) {
  const today = new Date().toISOString().slice(0, 10);
  const selectedDate =
    searchParams?.date && DATE_REGEX.test(searchParams.date) ? searchParams.date : today;

  const { prevDate, nextDate } = getAdjacentDates(selectedDate);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('v_group_events_daily_detail')
    .select('*')
    .eq('event_date', selectedDate)
    .order('entry_time', { ascending: true });

  if (error) {
    console.error('[Supabase error]', error);
    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Reservas por día</h1>
            <p className="text-slate-400 text-sm">{formatDateToDisplay(selectedDate)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <ReservasDiaDatePicker selectedDate={selectedDate} />
            <div className="flex gap-2">
              <Link
                href={`/reservas-dia?date=${prevDate}`}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
              >
                Día anterior
              </Link>
              <Link
                href={`/reservas-dia?date=${nextDate}`}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
              >
                Día siguiente
              </Link>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-red-900/60 bg-red-950/70 p-4 text-sm text-red-100">
          <p className="font-semibold">No se pudo cargar la información de Supabase.</p>
          <p className="text-red-200">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reservas por día</h1>
          <p className="text-slate-400 text-sm">{formatDateToDisplay(selectedDate)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ReservasDiaDatePicker selectedDate={selectedDate} />
          <div className="flex gap-2">
            <Link
              href={`/reservas-dia?date=${prevDate}`}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
            >
              Día anterior
            </Link>
            <Link
              href={`/reservas-dia?date=${nextDate}`}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
            >
              Día siguiente
            </Link>
          </div>
        </div>
      </div>

      {(!data || data.length === 0) && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200">
          No hay grupos para esta fecha.
        </div>
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-inner shadow-black/30">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900 text-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Hora</th>
                <th className="px-3 py-2 text-left">Grupo</th>
                <th className="px-3 py-2 text-left">Sala</th>
                <th className="px-3 py-2 text-right">Pax sala</th>
                <th className="px-3 py-2 text-right">Pax total</th>
                <th className="px-3 py-2 text-left">Privado</th>
                <th className="px-3 py-2 text-left">Fiesta privada</th>
                <th className="px-3 py-2 text-right">Waiters</th>
                <th className="px-3 py-2 text-right">Runners</th>
                <th className="px-3 py-2 text-right">Bartenders</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row: GroupEventDailyDetail) => (
                <tr key={`${row.group_event_id}-${row.room_id ?? 'roomless'}`} className="border-t border-slate-800">
                  <td className="px-3 py-2 align-middle font-mono text-xs text-slate-200">
                    {row.entry_time ?? '—'}
                  </td>
                  <td className="px-3 py-2 align-middle font-semibold text-slate-100">{row.group_name}</td>
                  <td className="px-3 py-2 align-middle text-slate-100">{row.room_name ?? '—'}</td>
                  <td className="px-3 py-2 align-middle text-right text-slate-100">
                    {row.room_total_pax ?? '—'}
                  </td>
                  <td className="px-3 py-2 align-middle text-right text-slate-100">{row.total_pax ?? '—'}</td>
                  <td className="px-3 py-2 align-middle">
                    <BooleanPill value={row.has_private_dining_room} />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <BooleanPill value={row.has_private_party} />
                  </td>
                  <td className="px-3 py-2 align-middle text-right text-slate-100">
                    {row.recommended_waiters ?? '—'}
                  </td>
                  <td className="px-3 py-2 align-middle text-right text-slate-100">
                    {row.recommended_runners ?? '—'}
                  </td>
                  <td className="px-3 py-2 align-middle text-right text-slate-100">
                    {row.recommended_bartenders ?? '—'}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-100">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
