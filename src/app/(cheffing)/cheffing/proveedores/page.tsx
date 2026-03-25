import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';

import { ProcurementSuppliersManager } from './ProcurementSuppliersManager';

export default async function CheffingSuppliersPage() {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const { data: suppliers, error } = await supabase
    .from('cheffing_suppliers')
    .select('id, trade_name, legal_name, tax_id, phone, email, is_active, created_at, updated_at')
    .order('trade_name', { ascending: true });

  if (error) {
    console.error('[cheffing/proveedores] Failed to load suppliers', error);
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Proveedores</h2>
        <p className="text-sm text-slate-400">Gestión manual de proveedores para compras de Cheffing.</p>
      </header>

      <ProcurementSuppliersManager initialSuppliers={suppliers ?? []} />
    </section>
  );
}
