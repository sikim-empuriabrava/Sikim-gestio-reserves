import { redirect } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type TodayGroupEvent = {
  id: string;
  name: string;
  event_date: string;
  entry_time: string | null;
  adults: number | null;
  children: number | null;
  total_pax: number | null;
  status: string;
  menu_text: string | null;
  second_course_type: string | null;
  seconds_confirmed: boolean | null;
  allergens_and_diets: string | null;
  extras: string | null;
  setup_notes: string | null;
  has_private_dining_room: boolean | null;
  has_private_party: boolean | null;
};

type TodayReservationsResult = {
  reservations: TodayGroupEvent[];
  error?: string;
};

const statusStyles: Record<string, string> = {
  confirmed: 'bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/40',
  draft: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40',
  completed: 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-500/40',
  cancelled: 'bg-slate-800/70 text-slate-200 ring-1 ring-slate-600/50',
  incident: 'bg-red-500/25 text-red-100 ring-1 ring-red-400/50',
  no_show: 'bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/50',
};

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatLongDate(value: string) {
  const formatter = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return formatter.format(new Date(value));
}

function formatTime(time: string | null) {
  if (!time) return '—';
  return time.slice(0, 5);
}

function getStatusBadge(status: string) {
  const normalized = status?.toLowerCase?.() ?? 'unknown';
  const className = statusStyles[normalized] ?? 'bg-slate-800/80 text-slate-100 ring-1 ring-slate-700/70';
  return { label: normalized.replace('_', ' ') || 'estado', className };
}

function getReservationTotals(reservations: TodayGroupEvent[]) {
  const totalReservations = reservations.length;
  const totalPax = reservations.reduce((acc, reservation) => {
    const adults = reservation.adults ?? 0;
    const children = reservation.children ?? 0;
    const total = reservation.total_pax ?? adults + children;
    return acc + total;
  }, 0);

  return { totalReservations, totalPax };
}

async function fetchTodayReservations(): Promise<TodayReservationsResult> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/group-events/today`, {
      cache: 'no-store',
    });

    const payload = (await response.json()) as { data?: TodayGroupEvent[]; error?: string };

    if (!response.ok) {
      return { reservations: [], error: payload?.error || 'No se pudieron cargar las reservas.' };
    }

    return { reservations: payload.data ?? [] };
  } catch (error) {
    console.error('[Cocina] Error fetching today reservations', error);
    return { reservations: [], error: 'No se pudieron cargar reservas de hoy.' };
  }
}

export const dynamic = 'force-dynamic';

export default async function CocinaPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/cocina')}`);
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const today = toISODate(new Date());
  const [{ reservations, error: reservationsError }, { data }] = await Promise.all([
    fetchTodayReservations(),
    supabaseAdmin
      .from('day_status')
      .select('event_date, notes_kitchen, cocina_notes, day_notes')
      .eq('event_date', today)
      .maybeSingle(),
  ]);
  const notes = (data?.notes_kitchen ?? data?.cocina_notes ?? data?.day_notes ?? '').trim();
  const { totalReservations, totalPax } = getReservationTotals(reservations);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Servicio de hoy</h1>
          <p className="text-slate-400">{formatLongDate(today)}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-semibold text-slate-100">
          <span className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1">
            {totalReservations} reservas
          </span>
          <span className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1">
            {totalPax} pax
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Notas de hoy (Cocina)</h2>
            <p className="text-sm text-slate-400">{formatLongDate(today)}</p>
          </div>
          <p className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-100">
            {notes || 'Sin notas para hoy.'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Reservas de hoy</h2>
            <span className="text-sm text-slate-400">Ordenadas por hora de entrada</span>
          </div>

          {reservationsError ? (
            <p className="rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-100">
              No se pudieron cargar reservas de hoy.
            </p>
          ) : reservations.length === 0 ? (
            <p className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
              No hay reservas de grupo para hoy.
            </p>
          ) : (
            <div className="space-y-3">
              {reservations.map((reservation) => {
                const statusBadge = getStatusBadge(reservation.status);
                const showAllergens = Boolean(reservation.allergens_and_diets);
                const showExtras = Boolean(reservation.extras);
                const showSecondsAlert =
                  reservation.second_course_type && reservation.seconds_confirmed === false;
                const totalPax =
                  reservation.total_pax ?? (reservation.adults ?? 0) + (reservation.children ?? 0);

                return (
                  <div
                    key={reservation.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 shadow-sm shadow-slate-950"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-col gap-1 text-slate-100 sm:flex-row sm:items-center sm:gap-3">
                          <span className="text-lg font-semibold text-primary-100">
                            {formatTime(reservation.entry_time)}
                          </span>
                          <span className="text-base font-semibold">{reservation.name}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm text-slate-200">
                          <span className="rounded-md border border-slate-800 bg-slate-900/70 px-2 py-1 font-semibold">
                            {reservation.adults ?? 0} adultos
                          </span>
                          <span className="rounded-md border border-slate-800 bg-slate-900/70 px-2 py-1 font-semibold">
                            {reservation.children ?? 0} niños
                          </span>
                          <span className="rounded-md border border-primary-700/60 bg-primary-900/30 px-2 py-1 font-semibold text-primary-100">
                            {totalPax}{' '}
                            total
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-slate-200">
                          <p className="font-semibold text-slate-100">Menú / resumen</p>
                          <p className="whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-900/60 p-2 text-slate-100">
                            {reservation.menu_text || 'Sin menú definido.'}
                          </p>
                        </div>

                        {reservation.setup_notes && (
                          <div className="space-y-1 text-sm text-slate-200">
                            <p className="font-semibold text-slate-100">Notas de sala</p>
                            <p className="whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-900/60 p-2 text-slate-100">
                              {reservation.setup_notes}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {showAllergens && (
                            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-100 ring-1 ring-amber-500/50">
                              Alergias
                            </span>
                          )}
                          {showSecondsAlert && (
                            <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-100 ring-1 ring-rose-500/50">
                              Segundos no confirmados
                            </span>
                          )}
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 text-sm text-slate-200 sm:w-64">
                        {showAllergens && (
                          <div className="space-y-1">
                            <p className="font-semibold text-amber-100">Alergias / dietas</p>
                            <p className="whitespace-pre-wrap rounded-md border border-amber-500/40 bg-amber-950/30 p-2 text-amber-50">
                              {reservation.allergens_and_diets}
                            </p>
                          </div>
                        )}

                        {showExtras && (
                          <div className="space-y-1">
                            <p className="font-semibold text-sky-100">Extras / notas cocina</p>
                            <p className="whitespace-pre-wrap rounded-md border border-sky-500/40 bg-sky-950/30 p-2 text-sky-50">
                              {reservation.extras}
                            </p>
                          </div>
                        )}

                        {(reservation.has_private_dining_room || reservation.has_private_party) && (
                          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-primary-100">
                            {reservation.has_private_dining_room && (
                              <span className="rounded-md border border-primary-500/40 bg-primary-900/30 px-2 py-1">
                                Sala privada
                              </span>
                            )}
                            {reservation.has_private_party && (
                              <span className="rounded-md border border-primary-500/40 bg-primary-900/30 px-2 py-1">
                                Fiesta privada
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
