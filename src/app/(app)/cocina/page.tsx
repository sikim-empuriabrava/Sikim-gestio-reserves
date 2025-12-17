import { redirect } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { KitchenReservations } from './KitchenReservations';
import type { TodayGroupEvent } from './types';

type TodayReservationsResult = {
  reservations: TodayGroupEvent[];
  error?: string;
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
            <KitchenReservations reservations={reservations} />
          )}
        </div>
      </div>
    </div>
  );
}
