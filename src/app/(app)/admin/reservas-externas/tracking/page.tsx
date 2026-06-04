import Link from 'next/link';
import { redirect } from 'next/navigation';
import { OperationalPageHeader, operationalSecondaryButtonClass } from '@/components/operational/OperationalUI';
import { loadExternalTrackingIntegrations } from '@/lib/reservations/externalTrackingIntegrations';
import type { ExternalTrackingIntegration } from '@/lib/reservations/externalTrackingIntegrations';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ExternalTrackingIntegrationsManager } from './ExternalTrackingIntegrationsManager';

export const dynamic = 'force-dynamic';

export default async function AdminExternalReservationTrackingPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/admin/reservas-externas/tracking')}`);
  }

  let initialRows: ExternalTrackingIntegration[] = [];
  let initialLoadError: string | null = null;

  try {
    initialRows = await loadExternalTrackingIntegrations();
  } catch (error) {
    console.error('[admin/reservas-externas/tracking] Failed to load tracking integrations', error);
    initialLoadError = 'No se pudieron cargar las integraciones de tracking.';
  }

  return (
    <>
      <OperationalPageHeader
        eyebrow="Admin"
        title="Tracking y píxeles"
        description="Configura los IDs de medicion que se usaran en el motor publico de reservas cuando exista consentimiento."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/reservas-externas" className={operationalSecondaryButtonClass}>
              Configuracion reservas externas
            </Link>
            <Link href="/admin/reservas-externas/atribucion" className={operationalSecondaryButtonClass}>
              Atribucion reservas externas
            </Link>
          </div>
        }
      />

      <ExternalTrackingIntegrationsManager initialRows={initialRows} initialLoadError={initialLoadError} />
    </>
  );
}
