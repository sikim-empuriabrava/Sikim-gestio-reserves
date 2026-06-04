import Link from 'next/link';
import { redirect } from 'next/navigation';
import { OperationalPageHeader, operationalSecondaryButtonClass } from '@/components/operational/OperationalUI';
import type { ExternalReservationSettingsAdminData } from '@/lib/reservations/externalReservationSettings';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadExternalReservationSettingsAdminData } from '@/lib/reservations/externalReservationSettings';
import { ExternalReservationSettingsManager } from './ExternalReservationSettingsManager';

export const dynamic = 'force-dynamic';

export default async function AdminExternalReservationsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/admin/reservas-externas')}`);
  }

  let initialData: ExternalReservationSettingsAdminData = {
    summary: {
      isEnabled: false,
      currentType: 'none' as const,
      currentTypeLabel: 'Sin asignacion' as const,
      currentName: null,
      currentCardId: null,
      currentMenuId: null,
      defaultRoomId: null,
      defaultRoomName: null,
      updatedAt: null,
    },
    cards: [] as Array<{ id: string; name: string }>,
    menus: [] as Array<{ id: string; name: string; price_per_person: number | null }>,
    rooms: [] as Array<{ id: string; name: string }>,
  };
  let initialLoadError: string | null = null;

  try {
    initialData = await loadExternalReservationSettingsAdminData();
  } catch (error) {
    console.error('[admin/reservas-externas] Failed to load external reservation settings', error);
    initialLoadError = 'No se pudo cargar la configuracion actual de reservas externas.';
  }

  return (
    <>
      <OperationalPageHeader
        eyebrow="Admin"
        title="Reservas externas"
        description="Define que carta o menu se asigna automaticamente a las solicitudes que llegan desde el motor publico de reservas."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/reservas-externas/tracking" className={operationalSecondaryButtonClass}>
              Tracking reservas externas
            </Link>
            <Link href="/admin/reservas-externas/atribucion" className={operationalSecondaryButtonClass}>
              Atribucion reservas externas
            </Link>
          </div>
        }
      />

      <ExternalReservationSettingsManager
        initialSummary={initialData.summary}
        initialCards={initialData.cards}
        initialMenus={initialData.menus}
        initialRooms={initialData.rooms}
        initialLoadError={initialLoadError}
      />
    </>
  );
}
