import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';

import { ProcurementDocumentDetailManager } from './ProcurementDocumentDetailManager';

export default async function CheffingCompraDetailPage({ params }: { params: { id: string } }) {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const [{ data: document, error: documentError }, { data: suppliers }, { data: ingredients }] = await Promise.all([
    supabase
      .from('cheffing_purchase_documents')
      .select('id, supplier_id, document_kind, document_number, document_date, status, validation_notes, created_at, updated_at, cheffing_suppliers(trade_name), cheffing_purchase_document_lines(id, line_number, raw_description, raw_quantity, raw_unit, raw_unit_price, raw_line_total, validated_ingredient_id, line_status, warning_notes, cheffing_ingredients(name))')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.from('cheffing_suppliers').select('id, trade_name').eq('is_active', true).order('trade_name', { ascending: true }),
    supabase.from('cheffing_ingredients').select('id, name').order('name', { ascending: true }),
  ]);

  if (documentError || !document) {
    console.error('[cheffing/compras/:id] Failed to load document', documentError);
    notFound();
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6">
      <div className="text-sm text-slate-400">
        <Link href="/cheffing" className="underline-offset-2 hover:text-slate-200 hover:underline">Cheffing</Link>
        <span className="mx-2">/</span>
        <Link href="/cheffing/compras" className="underline-offset-2 hover:text-slate-200 hover:underline">Compras</Link>
        <span className="mx-2">/</span>
        <span className="text-white">Documento</span>
      </div>

      <ProcurementDocumentDetailManager document={document} suppliers={suppliers ?? []} ingredients={ingredients ?? []} />
    </section>
  );
}
