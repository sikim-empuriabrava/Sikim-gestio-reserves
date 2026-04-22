import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { CreateTaskFromReservation } from '@/components/tasks/CreateTaskFromReservation';
import type { TodayGroupEvent } from '@/app/(app)/cocina/types';
import { EditableReservationForm } from './EditableReservationForm';

type GroupEventOffering = {
  id: string;
  offering_kind: 'cheffing_menu' | 'cheffing_card';
  cheffing_menu_id: string | null;
  cheffing_card_id: string | null;
  assigned_pax: number;
  display_name_snapshot: string;
  notes: string | null;
  sort_order: number;
};

type GroupEventOfferingSelection = {
  id: string;
  group_event_offering_id: string;
  selection_kind: 'menu_second' | 'custom_menu' | 'kids_menu';
  display_name_snapshot: string;
  description_snapshot: string | null;
  quantity: number;
  notes: string | null;
  needs_doneness_points: boolean;
  sort_order: number;
};

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

  const { data: offeringsData } = await supabaseAdmin
    .from('group_event_offerings')
    .select('id, offering_kind, cheffing_menu_id, cheffing_card_id, assigned_pax, display_name_snapshot, notes, sort_order')
    .eq('group_event_id', params.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const offerings = (offeringsData ?? []) as GroupEventOffering[];
  const offeringIds = offerings.map((offering) => offering.id);

  const { data: selectionsData } = offeringIds.length
    ? await supabaseAdmin
        .from('group_event_offering_selections')
        .select(
          'id, group_event_offering_id, selection_kind, display_name_snapshot, description_snapshot, quantity, notes, needs_doneness_points, sort_order',
        )
        .in('group_event_offering_id', offeringIds)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
    : { data: [] };

  const offeringSelections = (selectionsData ?? []) as GroupEventOfferingSelection[];

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
      <EditableReservationForm
        reservation={preparedReservation}
        offerings={offerings}
        offeringSelections={offeringSelections}
        backDate={dateParam}
      />

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
