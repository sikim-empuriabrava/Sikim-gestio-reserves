import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabaseClient';

export default async function GroupReservationDetail({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const { data: detail, error } = await supabase
    .from('v_group_events_daily_detail')
    .select('*')
    .eq('group_event_id', params.id)
    .maybeSingle();

  const reservation = detail ?? null;

  if (!reservation || error) {
    const { data: fallback } = await supabase
      .from('group_events')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (!fallback) {
      return (
        <div className="p-6 space-y-4">
          <Link href="/reservas?view=week" className="text-sm text-emerald-300 hover:underline">
            ← Volver a reservas
          </Link>
          <div className="rounded-lg border border-red-800 bg-red-950/60 p-4 text-sm text-red-100">
            No se encontró la reserva solicitada.
          </div>
        </div>
      );
    }

    return (
      <div className="p-6 space-y-4">
        <Link href="/reservas?view=week" className="text-sm text-emerald-300 hover:underline">
          ← Volver a reservas
        </Link>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <h1 className="text-2xl font-semibold text-slate-100">{fallback.name}</h1>
          <p className="text-slate-400">{fallback.event_date} · {fallback.entry_time?.slice?.(0, 5) ?? '—'}h</p>
          <p className="text-sm text-slate-300">{fallback.total_pax ?? '—'} pax</p>
          <p className="text-sm text-slate-300">Estado: {fallback.status}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-primary-200">Detalle de reserva</p>
          <h1 className="text-2xl font-semibold text-slate-100">{reservation.group_name}</h1>
          <p className="text-slate-400">
            {reservation.event_date} · {reservation.entry_time ? `${reservation.entry_time.slice(0, 5)}h` : '—'}
          </p>
        </div>
        <Link
          href={`/reservas?view=day&date=${reservation.event_date}`}
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
        >
          ← Volver al día
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <h2 className="text-lg font-semibold text-slate-100">Datos generales</h2>
          <p className="text-sm text-slate-300">Pax: {reservation.total_pax ?? '—'}</p>
          <p className="text-sm text-slate-300">Estado: {reservation.status}</p>
          {reservation.room_name && (
            <p className="text-sm text-slate-300">Sala: {reservation.room_name}</p>
          )}
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            {reservation.has_private_dining_room && <span className="rounded-full bg-slate-800 px-2 py-0.5">Sala privada</span>}
            {reservation.has_private_party && <span className="rounded-full bg-slate-800 px-2 py-0.5">Fiesta privada</span>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <h2 className="text-lg font-semibold text-slate-100">Notas</h2>
          <p className="text-sm text-slate-300">Notas de servicio: {reservation.service_outcome_notes || '—'}</p>
        </div>
      </div>
    </div>
  );
}
