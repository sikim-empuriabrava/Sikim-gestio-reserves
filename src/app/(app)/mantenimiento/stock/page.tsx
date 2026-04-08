import { redirect } from 'next/navigation';

import { SharedProcurementDocumentIntake } from '@/components/procurement/SharedProcurementDocumentIntake';
import { ModulePlaceholder } from '@/components/ModulePlaceholder';
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
    <section className="space-y-6">
      <SharedProcurementDocumentIntake
        title="Subir albarán/factura"
        description="Entrada rápida para mantenimiento: hacer foto, usar galería o subir PDF y enviar el borrador a revisión de Cheffing."
        initialDocumentKind="delivery_note"
        runOcrAfterUpload
        showDocumentLinkOnSuccess={false}
      />

      <ModulePlaceholder
        title="Stock y reposición"
        subtitle="Controla el inventario técnico y las reposiciones necesarias para mantenimiento y reparaciones."
        cards={cards}
        quickNotes={quickNotes}
      />
    </section>
  );
}
