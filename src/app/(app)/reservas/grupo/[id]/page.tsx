import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { CreateTaskFromReservation } from '@/components/tasks/CreateTaskFromReservation';
import type { TodayGroupEvent } from '@/app/(app)/cocina/types';
import { EditableReservationForm } from './EditableReservationForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function GroupReservationDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { date?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const nextPath = `/reservas/grupo/${params.id}${searchParams?.date ? `?date=${searchParams.date}` : ''}`;
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  noStore();
  const supabaseAdmin = createSupabaseAdminClient();
  const dateParam = searchParams?.date;

  const { data: reservation, error } = await supabaseAdmin
    .from('group_events')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!reservation || error) {
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

  const preparedReservation = {
    id: reservation.id,
    name: reservation.name ?? '',
    event_date: reservation.event_date ?? '',
    entry_time: reservation.entry_time ?? '',
    adults: reservation.adults ?? null,
    children: reservation.children ?? null,
    total_pax: reservation.total_pax ?? null,
    has_private_dining_room: Boolean(reservation.has_private_dining_room),
    has_private_party: Boolean(reservation.has_private_party),
    second_course_type: reservation.second_course_type ?? null,
    menu_text: reservation.menu_text ?? null,
    allergens_and_diets: reservation.allergens_and_diets ?? null,
    extras: reservation.extras ?? null,
    setup_notes: reservation.setup_notes ?? null,
    invoice_data: reservation.invoice_data ?? null,
    deposit_amount: reservation.deposit_amount ?? null,
    deposit_status: reservation.deposit_status ?? null,
    status: reservation.status ?? 'confirmed',
  };

  const reservationForTasks: TodayGroupEvent = {
    id: reservation.id,
    name: reservation.name ?? '',
    event_date: reservation.event_date ?? '',
    entry_time: reservation.entry_time ?? null,
    adults: reservation.adults ?? null,
    children: reservation.children ?? null,
    total_pax: reservation.total_pax ?? null,
    status: reservation.status ?? 'confirmed',
    menu_text: reservation.menu_text ?? null,
    second_course_type: reservation.second_course_type ?? null,
    seconds_confirmed: reservation.seconds_confirmed ?? null,
    allergens_and_diets: reservation.allergens_and_diets ?? null,
    extras: reservation.extras ?? null,
    setup_notes: reservation.setup_notes ?? null,
    has_private_dining_room: reservation.has_private_dining_room ?? null,
    has_private_party: reservation.has_private_party ?? null,
  };

  return (
    <div className="p-6 space-y-4">
      <EditableReservationForm reservation={preparedReservation} backDate={dateParam} />

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Crear tarea desde esta reserva</h2>
            <p className="text-sm text-slate-400">
              Envía la información a los tableros de Cocina o Mantenimiento.
            </p>
          </div>
        </div>

        <CreateTaskFromReservation reservation={reservationForTasks} />
      </section>
    </div>
  );
}
