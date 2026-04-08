'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { SharedProcurementDocumentIntake } from '@/components/procurement/SharedProcurementDocumentIntake';
import { documentKindLabel, documentStatusLabel, type ProcurementDocumentKind } from '@/lib/cheffing/procurement';

type SupplierOption = { id: string; trade_name: string; is_active: boolean };

type PurchaseDocumentLineLite = {
  id: string;
  line_status: 'unresolved' | 'resolved' | null;
  validated_ingredient_id: string | null;
};

type PurchaseDocument = {
  id: string;
  status: 'draft' | 'applied' | 'discarded';
  document_kind: ProcurementDocumentKind;
  document_number: string | null;
  document_date: string;
  created_at?: string | null;
  updated_at?: string | null;
  declared_total: number | null;
  interpreted_payload: Record<string, unknown> | null;
  supplier_id: string | null;
  cheffing_suppliers: { trade_name: string | null } | { trade_name: string | null }[] | null;
  cheffing_purchase_document_lines: PurchaseDocumentLineLite[] | null;
};

type ProcurementListTab = 'draft' | 'applied' | 'discarded';
type OperationalStatusTone = 'critical' | 'warning' | 'ok' | 'neutral';

type OperationalStatus = {
  label: string;
  description: string;
  tone: OperationalStatusTone;
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(parsed);
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function resolveSupplierName(document: PurchaseDocument): string | null {
  const confirmed = Array.isArray(document.cheffing_suppliers)
    ? document.cheffing_suppliers[0]?.trade_name
    : document.cheffing_suppliers?.trade_name;
  if (document.supplier_id && confirmed?.trim()) return confirmed.trim();

  const payload = document.interpreted_payload && typeof document.interpreted_payload === 'object' ? document.interpreted_payload : null;
  const detected = payload?.supplier_detected;
  if (detected && typeof detected === 'object') {
    const typed = detected as Record<string, unknown>;
    const provisionalName =
      typeof typed.trade_name === 'string'
        ? typed.trade_name
        : typeof typed.legal_name === 'string'
          ? typed.legal_name
          : typeof typed.name === 'string'
            ? typed.name
            : null;
    if (provisionalName?.trim()) return provisionalName.trim();
  }

  const existingSuggestion = payload?.supplier_existing_suggestion;
  if (existingSuggestion && typeof existingSuggestion === 'object') {
    const typed = existingSuggestion as Record<string, unknown>;
    if (typeof typed.trade_name === 'string' && typed.trade_name.trim()) return typed.trade_name.trim();
  }

  return null;
}

function resolveDetectedTotal(document: PurchaseDocument): number | null {
  if (typeof document.declared_total === 'number' && Number.isFinite(document.declared_total)) {
    return document.declared_total;
  }
  const payload = document.interpreted_payload && typeof document.interpreted_payload === 'object' ? document.interpreted_payload : null;
  const detected = payload?.document_detected;
  if (!detected || typeof detected !== 'object') return null;
  const typed = detected as Record<string, unknown>;
  return typeof typed.declared_total === 'number' && Number.isFinite(typed.declared_total) ? typed.declared_total : null;
}

function resolveOperationalStatus(document: PurchaseDocument, supplierName: string | null): OperationalStatus {
  if (document.status === 'applied') {
    return { label: 'Aplicado', description: 'Documento aplicado, sin trabajo pendiente de revisión.', tone: 'neutral' };
  }
  if (document.status === 'discarded') {
    return { label: 'Descartado', description: 'Fuera de flujo operativo, recuperable si fuese necesario.', tone: 'neutral' };
  }

  const lines = document.cheffing_purchase_document_lines ?? [];
  if (!supplierName || !document.supplier_id) {
    return { label: 'Sin proveedor confirmado', description: 'Confirmar proveedor antes de aplicar el documento.', tone: 'critical' };
  }
  if (!lines.length) {
    return { label: 'Listo para revisar', description: 'Sin líneas detectadas: revisar OCR o añadir líneas manualmente.', tone: 'warning' };
  }

  const unresolvedCount = lines.filter((line) => line.line_status !== 'resolved').length;
  const missingIngredientCount = lines.filter((line) => !line.validated_ingredient_id).length;

  if (unresolvedCount > 0 || missingIngredientCount > 0) {
    return {
      label: 'Líneas pendientes',
      description: `${unresolvedCount} sin resolver · ${missingIngredientCount} sin ingrediente validado`,
      tone: 'warning',
    };
  }

  return { label: 'Listo para aplicar', description: 'Proveedor confirmado y líneas resueltas.', tone: 'ok' };
}

function statusBadgeClasses(status: PurchaseDocument['status']): string {
  if (status === 'draft') return 'border-amber-400/50 bg-amber-500/10 text-amber-100';
  if (status === 'applied') return 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100';
  return 'border-slate-500/50 bg-slate-700/30 text-slate-200';
}

function operationalBadgeClasses(tone: OperationalStatusTone): string {
  if (tone === 'critical') return 'border-rose-400/50 bg-rose-500/10 text-rose-100';
  if (tone === 'warning') return 'border-amber-400/50 bg-amber-500/10 text-amber-100';
  if (tone === 'ok') return 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100';
  return 'border-slate-500/50 bg-slate-700/30 text-slate-200';
}

export function ProcurementDocumentsManager({
  initialDocuments,
  suppliers,
}: {
  initialDocuments: PurchaseDocument[];
  suppliers: SupplierOption[];
}) {
  const router = useRouter();
  const [manualError, setManualError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<ProcurementListTab>('draft');
  const [form, setForm] = useState({
    document_kind: 'delivery_note' as ProcurementDocumentKind,
    document_number: '',
    document_date: new Date().toISOString().slice(0, 10),
    supplier_id: '',
  });

  const documentsByTab = useMemo(() => {
    return {
      draft: initialDocuments.filter((document) => document.status === 'draft'),
      applied: initialDocuments.filter((document) => document.status === 'applied'),
      discarded: initialDocuments.filter((document) => document.status === 'discarded'),
    };
  }, [initialDocuments]);

  const visibleDocuments = useMemo(() => {
    return [...documentsByTab[activeTab]].sort((a, b) => {
      const aDate = new Date(a.document_date).getTime();
      const bDate = new Date(b.document_date).getTime();
      if (aDate !== bDate) return bDate - aDate;
      const aUpdated = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      const bUpdated = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
      if (aUpdated !== bUpdated) return bUpdated - aUpdated;
      return b.id.localeCompare(a.id);
    });
  }, [activeTab, documentsByTab]);

  async function createDocument() {
    setManualError(null);
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
      setManualError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function discardDocument(documentId: string) {
    setManualError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${documentId}/discard`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo descartar el documento');
      }
      router.refresh();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function recoverDocument(documentId: string) {
    setManualError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${documentId}/recover`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo recuperar el documento');
      }
      router.refresh();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteDocumentPermanently(documentId: string) {
    const confirmed = window.confirm('¿Seguro que quieres eliminar este documento?\n\nEsta acción no se puede deshacer.');
    if (!confirmed) return;

    setManualError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${documentId}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo eliminar el documento');
      }
      router.refresh();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Error desconocido');
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
        {manualError ? <p className="text-sm text-rose-400">{manualError}</p> : null}
      </div>

      <SharedProcurementDocumentIntake
        title="Pase 1 OCR (factura/albarán)"
        description="Sube una foto, imagen o PDF para crear el draft y lanzar el OCR inicial automáticamente."
        initialDocumentKind="delivery_note"
        runOcrAfterUpload
        redirectToDetailOnSuccess
      />

      <div className="space-y-3 rounded-xl border border-slate-800/70 bg-slate-950/40 p-3">
        <div className="flex flex-wrap gap-2">
          {([
            { id: 'draft', label: 'Borradores' },
            { id: 'applied', label: 'Aplicados' },
            { id: 'discarded', label: 'Descartados' },
          ] as Array<{ id: ProcurementListTab; label: string }>).map((tab) => {
            const isActive = tab.id === activeTab;
            const count = documentsByTab[tab.id].length;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-100' : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span>{tab.label}</span>
                <span className="rounded-full bg-black/30 px-2 py-0.5 text-[11px]">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full min-w-[1280px] text-left text-sm text-slate-200">
            <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Estado DB</th>
                <th className="px-4 py-3">Estado operativo</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Fecha doc.</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Líneas</th>
                <th className="px-4 py-3">Importe útil</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocuments.length === 0 ? (
                <tr className="border-t border-slate-800/60">
                  <td className="px-4 py-6 text-sm text-slate-400" colSpan={9}>
                    No hay documentos en esta bandeja.
                  </td>
                </tr>
              ) : null}
              {visibleDocuments.map((document) => {
                const supplierName = resolveSupplierName(document);
                const hasConfirmedSupplier = Boolean(document.supplier_id && supplierName);
                const linesCount = document.cheffing_purchase_document_lines?.length ?? 0;
                const operationalStatus = resolveOperationalStatus(document, supplierName);
                const declaredTotal = resolveDetectedTotal(document);

                return (
                  <tr key={document.id} className="border-t border-slate-800/60 align-top">
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusBadgeClasses(document.status)}`}>
                        {documentStatusLabel(document.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${operationalBadgeClasses(operationalStatus.tone)}`}>
                          {operationalStatus.label}
                        </span>
                        <p className="text-xs text-slate-400">{operationalStatus.description}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{documentKindLabel(document.document_kind)}</td>
                    <td className="px-4 py-3">{document.document_number ?? '—'}</td>
                    <td className="px-4 py-3">{formatDate(document.document_date)}</td>
                    <td className="px-4 py-3">
                      {supplierName ? (
                        <div className="space-y-1">
                          <p className="font-medium text-slate-100">{supplierName}</p>
                          {hasConfirmedSupplier ? (
                            <p className="text-xs text-emerald-200">Confirmado</p>
                          ) : (
                            <p className="text-xs text-amber-200">OCR provisional · pendiente de confirmar</p>
                          )}
                        </div>
                      ) : (
                        <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">Sin proveedor</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{linesCount}</td>
                    <td className="px-4 py-3">{formatCurrency(declaredTotal)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/cheffing/compras/${document.id}`} className="rounded-full border border-slate-700 px-3 py-1 text-xs">Ver detalle</Link>
                        {document.status === 'draft' ? <button type="button" onClick={() => discardDocument(document.id)} className="rounded-full border border-rose-500/50 px-3 py-1 text-xs text-rose-200">Descartar</button> : null}
                        {document.status === 'discarded' ? <button type="button" onClick={() => recoverDocument(document.id)} className="rounded-full border border-emerald-500/50 px-3 py-1 text-xs text-emerald-200">Recuperar</button> : null}
                        {document.status !== 'applied' ? <button type="button" onClick={() => deleteDocumentPermanently(document.id)} className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200">Eliminar definitivo</button> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
