'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { documentKindLabel, documentStatusLabel, type ProcurementDocumentKind } from '@/lib/cheffing/procurement';

type SupplierOption = { id: string; trade_name: string; is_active: boolean };

type PurchaseDocument = {
  id: string;
  status: 'draft' | 'applied' | 'discarded';
  document_kind: ProcurementDocumentKind;
  document_number: string | null;
  document_date: string;
  supplier_id: string | null;
  cheffing_suppliers: { trade_name: string | null } | { trade_name: string | null }[] | null;
  cheffing_purchase_document_lines: { id: string }[] | null;
};

export function ProcurementDocumentsManager({
  initialDocuments,
  suppliers,
}: {
  initialDocuments: PurchaseDocument[];
  suppliers: SupplierOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    document_kind: 'invoice' as ProcurementDocumentKind,
    document_number: '',
    document_date: new Date().toISOString().slice(0, 10),
    supplier_id: '',
  });

  async function createDocument() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/cheffing/procurement/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_kind: form.document_kind,
          document_number: form.document_number,
          document_date: form.document_date,
          supplier_id: form.supplier_id || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.id) {
        throw new Error(payload?.error ?? 'No se pudo crear el documento');
      }
      router.push(`/cheffing/compras/${payload.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function discardDocument(documentId: string) {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${documentId}/discard`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo descartar el documento');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <h3 className="text-sm font-semibold text-white">Nuevo documento manual</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <select value={form.document_kind} onChange={(event) => setForm({ ...form, document_kind: event.target.value as ProcurementDocumentKind })} className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white">
            <option value="invoice">Factura</option>
            <option value="delivery_note">Albarán</option>
            <option value="other">Otro</option>
          </select>
          <input value={form.document_number} onChange={(event) => setForm({ ...form, document_number: event.target.value })} placeholder="Número" className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" />
          <input type="date" value={form.document_date} onChange={(event) => setForm({ ...form, document_date: event.target.value })} className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" />
          <select value={form.supplier_id} onChange={(event) => setForm({ ...form, supplier_id: event.target.value })} className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white">
            <option value="">Sense proveïdor</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.trade_name}</option>)}
          </select>
        </div>
        <button type="button" onClick={createDocument} disabled={isSubmitting} className="rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200">Crear documento</button>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800/70">
        <table className="w-full min-w-[980px] text-left text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Número</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Líneas</th><th className="px-4 py-3">Acciones</th></tr></thead>
          <tbody>
            {initialDocuments.map((document) => {
              const supplierName = Array.isArray(document.cheffing_suppliers)
                ? document.cheffing_suppliers[0]?.trade_name
                : document.cheffing_suppliers?.trade_name;
              const hasSupplier = Boolean(document.supplier_id && supplierName);
              return (
                <tr key={document.id} className="border-t border-slate-800/60">
                  <td className="px-4 py-3">{documentStatusLabel(document.status)}</td>
                  <td className="px-4 py-3">{documentKindLabel(document.document_kind)}</td>
                  <td className="px-4 py-3">{document.document_number ?? '—'}</td>
                  <td className="px-4 py-3">{document.document_date}</td>
                  <td className="px-4 py-3">{hasSupplier ? supplierName : <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">⚠ Sense proveïdor</span>}</td>
                  <td className="px-4 py-3">{document.cheffing_purchase_document_lines?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/cheffing/compras/${document.id}`} className="rounded-full border border-slate-700 px-3 py-1 text-xs">Ver detalle</Link>
                      {document.status === 'draft' ? <button type="button" onClick={() => discardDocument(document.id)} className="rounded-full border border-rose-500/50 px-3 py-1 text-xs text-rose-200">Descartar</button> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
