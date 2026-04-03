import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireCheffingAccess } from '@/lib/cheffing/requireCheffing';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabaseAdmin';

import { ProcurementDocumentDetailManager } from './ProcurementDocumentDetailManager';

export default async function CheffingCompraDetailPage({ params }: { params: { id: string } }) {
  await requireCheffingAccess();

  const supabase = createSupabaseServerClient();
  const [{ data: document, error: documentError }, { data: suppliers }, { data: ingredients }, { data: units }] = await Promise.all([
    supabase
      .from('cheffing_purchase_documents')
      .select('id, supplier_id, document_kind, document_number, document_date, effective_at, status, validation_notes, declared_total, storage_bucket, storage_path, ocr_raw_text, interpreted_payload, applied_at, applied_by, created_at, updated_at, cheffing_suppliers(trade_name), cheffing_purchase_document_lines(id, line_number, raw_description, interpreted_description, raw_quantity, raw_unit, interpreted_quantity, interpreted_unit, normalized_unit_code, validated_unit, raw_unit_price, raw_line_total, suggested_ingredient_id, validated_ingredient_id, line_status, warning_notes, user_note, validated_ingredient:cheffing_ingredients!cheffing_purchase_document_lines_validated_ingredient_id_fkey(name))')
      .eq('id', params.id)
      .order('line_number', { ascending: true, foreignTable: 'cheffing_purchase_document_lines' })
      .maybeSingle(),
    supabase.from('cheffing_suppliers').select('id, trade_name').eq('is_active', true).order('trade_name', { ascending: true }),
    supabase.from('cheffing_ingredients').select('id, name').order('name', { ascending: true }),
    supabase.from('cheffing_units').select('code, name').order('code', { ascending: true }),
  ]);

  if (documentError || !document) {
    console.error('[cheffing/compras/:id] Failed to load document', documentError);
    notFound();
  }

  let sourceFileUrl: string | null = null;
  if (document.storage_bucket && document.storage_path) {
    const admin = createSupabaseAdminClient();
    const { data: signedData, error: signedError } = await admin.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 60 * 60);
    if (!signedError) sourceFileUrl = signedData.signedUrl;
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

      <ProcurementDocumentDetailManager
        document={document}
        suppliers={suppliers ?? []}
        ingredients={ingredients ?? []}
        units={units ?? []}
        initialSourceFileUrl={sourceFileUrl}
      />
    </section>
  );
}
