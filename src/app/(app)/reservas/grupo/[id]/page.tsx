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
  cheffing_dish_id: string | null;
  cheffing_menu_item_id: string | null;
  display_name_snapshot: string;
  description_snapshot: string | null;
  quantity: number;
  notes: string | null;
  needs_doneness_points: boolean;
  sort_order: number;
};

type GroupEventOfferingSelectionDoneness = {
  id: string;
  selection_id: string;
  point: 'crudo' | 'poco' | 'al_punto' | 'hecho' | 'muy_hecho';
  quantity: number;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function ReservaGroupPilotStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          body:has(.reservas-group-detail-pilot) {
            background: #11100e;
          }

          .aforo-standalone-shell:has(.reservas-group-detail-pilot) {
            max-width: none;
            gap: 0;
            padding: 0;
            background:
              radial-gradient(circle at 18% 0%, rgba(156, 117, 70, 0.10), transparent 26rem),
              linear-gradient(135deg, #171614 0%, #11100e 52%, #0f0e0d 100%);
          }

          .aforo-standalone-shell:has(.reservas-group-detail-pilot) > aside {
            width: 18.5rem;
            border-right: 1px solid rgba(120, 103, 82, 0.30);
            background: linear-gradient(180deg, rgba(29, 28, 25, 0.98), rgba(20, 19, 17, 0.98));
          }

          .aforo-standalone-shell:has(.reservas-group-detail-pilot) > aside > div {
            top: 0;
            min-height: 100dvh;
            padding: 1rem;
          }

          .aforo-standalone-shell:has(.reservas-group-detail-pilot) > div {
            min-width: 0;
            gap: 0;
          }

          .aforo-standalone-shell:has(.reservas-group-detail-pilot) > div > header {
            border-radius: 0;
            border-width: 0 0 1px 0;
            border-color: rgba(120, 103, 82, 0.28);
            background: rgba(18, 17, 15, 0.88);
            box-shadow: none;
          }

          .aforo-standalone-shell:has(.reservas-group-detail-pilot) > div > header > div > div:first-child {
            display: none;
          }

          .aforo-standalone-shell:has(.reservas-group-detail-pilot) > div > header > div {
            justify-content: flex-end;
          }

          .aforo-standalone-shell:has(.reservas-group-detail-pilot) footer {
            display: none;
          }

          .aforo-standalone-shell:has(.reservas-group-detail-pilot) aside nav > div {
            border-color: rgba(120, 103, 82, 0.22);
            background: transparent;
            box-shadow: none;
          }

          .aforo-standalone-shell:has(.reservas-group-detail-pilot) aside nav button {
            background: rgba(28, 27, 24, 0.62);
            color: #efe8dc;
          }

          .aforo-standalone-shell:has(.reservas-group-detail-pilot) aside nav a[aria-current="page"] {
            background: rgba(150, 112, 66, 0.22);
            color: #f1c98f;
            box-shadow: inset 0 0 0 1px rgba(194, 144, 82, 0.20);
          }

          .aforo-standalone-shell:has(.reservas-group-detail-pilot) a {
            color: inherit;
          }

          .reservas-group-detail-pilot input:not([type="checkbox"]),
          .reservas-group-detail-pilot select,
          .reservas-group-detail-pilot textarea {
            border-color: rgba(120, 103, 82, 0.50) !important;
            background: rgba(18, 17, 15, 0.92) !important;
            color: #f5eee4 !important;
          }

          .reservas-group-detail-pilot input:not([type="checkbox"]):focus,
          .reservas-group-detail-pilot select:focus,
          .reservas-group-detail-pilot textarea:focus {
            outline: none !important;
            border-color: rgba(201, 149, 85, 0.72) !important;
            box-shadow: 0 0 0 3px rgba(201, 149, 85, 0.16) !important;
          }

          .reservas-group-detail-pilot button {
            transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease, transform 160ms ease;
          }

          .reservas-group-detail-pilot button[class*="bg-emerald"],
          .reservas-group-detail-pilot button[class*="bg-primary"] {
            border: 1px solid rgba(214, 167, 110, 0.66) !important;
            background: linear-gradient(180deg, #d9b170, #a66e38) !important;
            color: #16120d !important;
          }
        `,
      }}
    />
  );
}

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
      <div className="reservas-group-detail-pilot mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <ReservaGroupPilotStyles />
        <Link href="/reservas?view=week" className="text-sm font-medium text-[#d6a76e] hover:text-[#f0c58d]">
          ← Volver a reservas
        </Link>
        <div className="rounded-2xl border border-red-500/30 bg-red-950/25 p-4 text-sm text-red-100">
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
          'id, group_event_offering_id, selection_kind, cheffing_dish_id, cheffing_menu_item_id, display_name_snapshot, description_snapshot, quantity, notes, needs_doneness_points, sort_order',
        )
        .in('group_event_offering_id', offeringIds)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
    : { data: [] };

  const offeringSelections = (selectionsData ?? []) as GroupEventOfferingSelection[];
  const selectionIds = offeringSelections.map((selection) => selection.id);

  const { data: selectionDonenessData } = selectionIds.length
    ? await supabaseAdmin
        .from('group_event_offering_selection_doneness')
        .select('id, selection_id, point, quantity')
        .in('selection_id', selectionIds)
        .order('point', { ascending: true })
    : { data: [] };

  const selectionDoneness = (selectionDonenessData ?? []) as GroupEventOfferingSelectionDoneness[];

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
    <div className="reservas-group-detail-pilot mx-auto w-full max-w-6xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <ReservaGroupPilotStyles />
      <EditableReservationForm
        reservation={preparedReservation}
        offerings={offerings}
        offeringSelections={offeringSelections}
        selectionDoneness={selectionDoneness}
        backDate={dateParam}
      />

      <section className="rounded-2xl border border-[#4a3f32]/70 bg-[#181715]/92 p-5 shadow-[0_24px_80px_-56px_rgba(0,0,0,0.95)] space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#f5eee4]">Crear tarea desde esta reserva</h2>
            <p className="text-sm text-[#a89c8e]">
              Envía la información a los tableros de Cocina o Mantenimiento.
            </p>
          </div>
        </div>

        <CreateTaskFromReservation reservation={reservationForTasks} />
      </section>
    </div>
  );
}
