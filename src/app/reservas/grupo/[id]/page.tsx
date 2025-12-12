import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
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
  noStore();
  const supabase = createSupabaseAdminClient();
  const dateParam = searchParams?.date;

  const { data: reservation, error } = await supabase
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

  return (
    <div className="p-6 space-y-4">
      <EditableReservationForm reservation={preparedReservation} backDate={dateParam} />
    </div>
  );
}
