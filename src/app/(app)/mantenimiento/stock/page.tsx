import { redirect } from 'next/navigation';

import { SharedProcurementBatchIntake } from '@/components/procurement/SharedProcurementBatchIntake';
import { SharedProcurementDocumentIntake } from '@/components/procurement/SharedProcurementDocumentIntake';
import { ModulePlaceholder } from '@/components/ModulePlaceholder';
import { OperationalPage, OperationalPageHeader } from '@/components/operational/OperationalUI';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const cards = [
  {
    title: 'Stock y reposición',
    description: 'Control de piezas críticas, consumibles y alertas de reposición para mantenimiento.',
    badge: 'Próximamente',
  },
  {
    title: 'Pedidos programados',
    description: 'Agenda de pedidos semanales y validación de entregas para evitar paradas inesperadas.',
  },
  {
    title: 'Integraciones',
    description: 'Conexión futura con inventario central y avisos automáticos a proveedores.',
  },
];

const quickNotes = {
  items: [
    'Apuntar número de filtros de aire restantes antes del viernes.',
    'Revisar stock de tornillería y tacos de pared para reparaciones rápidas.',
    'Confirmar si quedan kits de limpieza de acero inoxidable en almacén.',
  ],
};

export default async function MantenimientoStockPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/mantenimiento/stock')}`);
  }

  return (
    <OperationalPage>
      <OperationalPageHeader
        eyebrow="Mantenimiento"
        title="Stock / reposición"
        description="Controla el inventario técnico y las reposiciones necesarias para mantenimiento y reparaciones."
      />

      <SharedProcurementDocumentIntake
        title="Subir albarán/factura"
        description="Entrada rápida para mantenimiento: hacer foto, usar galería o subir PDF y enviar el borrador a revisión de Cheffing. La cámara pide confirmación explícita antes de subir."
        initialDocumentKind="delivery_note"
        runOcrAfterUpload
        showDocumentLinkOnSuccess={false}
        variant="warm"
      />

      <SharedProcurementBatchIntake
        title="Lote documental OCR para mantenimiento"
        description="Añade varios archivos y procésalos en cola: cada item crea draft, sube original y lanza OCR sin redirigirte al detalle por archivo."
        completionMessage="Lote finalizado en mantenimiento. Se refresca la vista para mantener el flujo operativo sin saltos al detalle."
        variant="warm"
      />

      <div className="space-y-3 pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d69c57]">Próximamente</p>
        <ModulePlaceholder
          title="Stock y reposición"
          subtitle="Controla el inventario técnico y las reposiciones necesarias para mantenimiento y reparaciones."
          cards={cards}
          quickNotes={quickNotes}
          showHeader={false}
        />
      </div>
    </OperationalPage>
  );
}
