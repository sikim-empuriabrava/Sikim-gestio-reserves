import Link from 'next/link';

import { SharedProcurementDocumentIntake } from '@/components/procurement/SharedProcurementDocumentIntake';
import { PageHeader } from '@/components/ui';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';

export default async function CheffingComprasNewPage() {
  await requireCheffingAccess();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cheffing · Compras"
        title="Nuevo documento"
        description="Entrada rápida para dejar una factura, albarán o ticket subido y listo para revisar después."
      />

      <SharedProcurementDocumentIntake
        title="Haz una foto o sube una factura/albarán/ticket"
        description="Pensado para móvil: cámara, galería o PDF. Crea el borrador, sube el archivo original y lanza el mismo intake OCR existente."
        initialDocumentKind="delivery_note"
        runOcrAfterUpload
        variant="warm"
      />

      <Link
        href="/cheffing/compras"
        className="inline-flex min-h-11 items-center rounded-xl border border-slate-700/80 bg-slate-950/50 px-4 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900/70 hover:text-white"
      >
        Volver a compras
      </Link>
    </div>
  );
}
