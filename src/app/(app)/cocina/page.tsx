import { redirect } from 'next/navigation';
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  OperationalEmptyState,
  OperationalPage,
  OperationalPageHeader,
  OperationalPanel,
  OperationalPill,
  OperationalSectionHeader,
  operationalButtonClass,
} from '@/components/operational/OperationalUI';
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
    <OperationalPage>
      <OperationalPageHeader
        title="Servicio de hoy"
        meta={
          <>
            <span className="inline-flex items-center gap-2">
              <CalendarDaysIcon className="h-5 w-5 text-[#a99d90]" aria-hidden="true" />
              {formatLongDate(today)}
            </span>
          </>
        }
        actions={
          <>
            <OperationalPill tone="accent" className="h-10 px-4">
              <ClipboardDocumentListIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              {totalReservations} reservas
            </OperationalPill>
            <OperationalPill tone="accent" className="h-10 px-4">
              <UserGroupIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              {totalPax} pax
            </OperationalPill>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <OperationalPanel className="p-5">
          <OperationalSectionHeader
            icon={PencilSquareIcon}
            title="Notas de hoy (Cocina)"
            meta={formatLongDate(today)}
          />
          <div className="mt-5">
            {notes ? (
              <div className="min-h-[18rem] whitespace-pre-wrap rounded-2xl border border-[#3c342a]/70 bg-[#12110f]/55 p-4 text-sm leading-6 text-[#efe8dc] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
                {notes}
              </div>
            ) : (
              <OperationalEmptyState
                icon={ClipboardDocumentListIcon}
                title="Sin notas para hoy."
                description="Cuando el chef o el equipo añadan notas, las verás aquí."
              />
            )}
          </div>
        </OperationalPanel>

        <OperationalPanel className="p-5">
          <OperationalSectionHeader
            icon={CalendarDaysIcon}
            title="Reservas de hoy"
            meta={
              <span className="rounded-xl border border-[#4a3f32]/80 bg-[#151412]/85 px-3 py-2 text-sm text-[#b9aea1]">
                Ordenadas por hora de entrada
              </span>
            }
          />

          <div className="mt-5">
            {reservationsError ? (
              <OperationalEmptyState
                icon={ExclamationTriangleIcon}
                title="No se pudieron cargar reservas de hoy."
                description="Intenta actualizar la vista o verifica la conexión con el sistema de reservas."
                tone="warning"
                action={
                  <a href="/cocina" className={operationalButtonClass}>
                    <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
                    Reintentar
                  </a>
                }
              />
            ) : reservations.length === 0 ? (
              <OperationalEmptyState
                icon={CalendarDaysIcon}
                title="No hay reservas de grupo para hoy."
                description="El pase de cocina aparecerá aquí cuando haya reservas cargadas."
              />
            ) : (
              <KitchenReservations reservations={reservations} />
            )}
          </div>
        </OperationalPanel>
      </div>
    </OperationalPage>
  );
}
