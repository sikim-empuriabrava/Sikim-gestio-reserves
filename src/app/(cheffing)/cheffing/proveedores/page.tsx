import { PageHeader } from '@/components/ui';
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
    <>
      <PageHeader
        eyebrow="Cheffing"
        title="Proveedores"
        description="Gestión manual de proveedores para compras de Cheffing."
      />

      <ProcurementSuppliersManager initialSuppliers={suppliers ?? []} />
    </>
  );
}
