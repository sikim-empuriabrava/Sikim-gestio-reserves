import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';

import { ProcurementDocumentsManager } from './ProcurementDocumentsManager';

export default async function CheffingComprasPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const [{ data: documents, error: documentsError }, { data: suppliers, error: suppliersError }] = await Promise.all([
    supabase
      .from('cheffing_purchase_documents')
      .select('id, status, document_kind, document_number, document_date, created_at, updated_at, supplier_id, cheffing_suppliers(trade_name), cheffing_purchase_document_lines(id)')
      .order('document_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('cheffing_suppliers')
      .select('id, trade_name, is_active')
      .eq('is_active', true)
      .order('trade_name', { ascending: true }),
  ]);

  if (documentsError || suppliersError) {
    console.error('[cheffing/compras] Failed to load procurement data', documentsError ?? suppliersError);
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Compras</h2>
        <p className="text-sm text-slate-400">Documentos de compra en gestión manual V1 (sin OCR/LLM ni aplicación automática).</p>
      </header>

      <ProcurementDocumentsManager initialDocuments={documents ?? []} suppliers={suppliers ?? []} />
    </section>
  );
}
