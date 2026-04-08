'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  runProcurementIntakeFlow,
  SharedProcurementDocumentIntake,
  type ProcurementIntakeStep,
} from '@/components/procurement/SharedProcurementDocumentIntake';
import {
  documentKindLabel,
  documentStatusLabel,
  PROCUREMENT_SOURCE_FILE_ACCEPT_ATTRIBUTE,
  type ProcurementDocumentKind,
} from '@/lib/cheffing/procurement';

type SupplierOption = { id: string; trade_name: string; is_active: boolean };

type PurchaseDocumentLineLite = {
  id: string;
  line_status: 'unresolved' | 'resolved' | null;
  validated_ingredient_id: string | null;
  raw_unit_price: number | null;
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
type BatchQueueStatus = 'pending' | ProcurementIntakeStep | 'completed' | 'failed';

type OperationalStatus = {
  label: string;
  description: string;
  tone: OperationalStatusTone;
};

type BatchQueueItem = {
  id: string;
  file: File;
  fileName: string;
  documentKind: ProcurementDocumentKind;
  status: BatchQueueStatus;
  error: string | null;
  documentId: string | null;
};

type PossibleDuplicateSignal = {
  isPossibleDuplicate: boolean;
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

function parsePrudentNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized.length) return null;
  const parsed = Number(normalized.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
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
  const declaredTotal = parsePrudentNumber(document.declared_total);
  if (declaredTotal !== null) return declaredTotal;
  const payload = document.interpreted_payload && typeof document.interpreted_payload === 'object' ? document.interpreted_payload : null;
  const detected = payload?.document_detected;
  if (!detected || typeof detected !== 'object') return null;
  const typed = detected as Record<string, unknown>;
  return parsePrudentNumber(typed.declared_total);
}

function resolvePossibleDuplicateSignal(document: PurchaseDocument): PossibleDuplicateSignal {
  const payload = document.interpreted_payload && typeof document.interpreted_payload === 'object' ? document.interpreted_payload : null;
  const possibleDuplicate = payload?.possible_document_duplicate;
  if (!possibleDuplicate || typeof possibleDuplicate !== 'object') {
    return { isPossibleDuplicate: false };
  }
  const typed = possibleDuplicate as Record<string, unknown>;
  return { isPossibleDuplicate: typed.status === 'possible_duplicate' };
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
  const missingApplicableCostCount = lines.filter((line) => line.raw_unit_price === null).length;

  if (unresolvedCount > 0 || missingIngredientCount > 0 || missingApplicableCostCount > 0) {
    const pendingSegments: string[] = [];
    if (unresolvedCount > 0) pendingSegments.push(`${unresolvedCount} sin resolver`);
    if (missingIngredientCount > 0) pendingSegments.push(`${missingIngredientCount} sin ingrediente validado`);
    if (missingApplicableCostCount > 0) pendingSegments.push(`${missingApplicableCostCount} sin coste`);
    return {
      label: 'Líneas pendientes',
      description: pendingSegments.length ? pendingSegments.join(' · ') : 'Revisión pendiente',
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
  const [batchDocumentKind, setBatchDocumentKind] = useState<ProcurementDocumentKind>('delivery_note');
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
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
    function getOperationalPriority(document: PurchaseDocument): number {
      const supplierName = resolveSupplierName(document);
      const operationalStatus = resolveOperationalStatus(document, supplierName);
      if (operationalStatus.label === 'Sin proveedor confirmado') return 0;
      if (operationalStatus.label === 'Líneas pendientes') return 1;
      if (operationalStatus.label === 'Listo para revisar') return 2;
      return 3;
    }

    return [...documentsByTab[activeTab]].sort((a, b) => {
      if (activeTab === 'draft') {
        const aPriority = getOperationalPriority(a);
        const bPriority = getOperationalPriority(b);
        if (aPriority !== bPriority) return aPriority - bPriority;
      }
      const aDate = new Date(a.document_date).getTime();
      const bDate = new Date(b.document_date).getTime();
      if (aDate !== bDate) return bDate - aDate;
      const aUpdated = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      const bUpdated = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
      if (aUpdated !== bUpdated) return bUpdated - aUpdated;
      return b.id.localeCompare(a.id);
    });
  }, [activeTab, documentsByTab]);

  const batchSummary = useMemo(() => {
    const summary = {
      total: batchQueue.length,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
    };

    for (const item of batchQueue) {
      if (item.status === 'pending') summary.pending += 1;
      else if (item.status === 'completed') summary.completed += 1;
      else if (item.status === 'failed') summary.failed += 1;
      else summary.inProgress += 1;
    }

    return summary;
  }, [batchQueue]);

  const hasBatchItems = batchQueue.length > 0;
  const isBatchFinished = hasBatchItems && !isBatchRunning && batchSummary.pending === 0 && batchSummary.inProgress === 0;

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

  function addBatchFiles(files: FileList | null) {
    if (!files?.length || isBatchRunning) return;

    const queueItems: BatchQueueItem[] = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      fileName: file.name,
      documentKind: batchDocumentKind,
      status: 'pending',
      error: null,
      documentId: null,
    }));

    setBatchQueue((current) => [...current, ...queueItems]);
  }

  function clearFinishedBatchQueue() {
    if (isBatchRunning) return;
    setBatchQueue((current) => current.filter((item) => item.status !== 'completed' && item.status !== 'failed'));
  }

  async function runBatchUpload() {
    if (isBatchRunning) return;
    const pendingItems = batchQueue.filter((item) => item.status === 'pending');
    if (!pendingItems.length) return;

    setIsBatchRunning(true);
    for (const pendingItem of pendingItems) {
      try {
        setBatchQueue((current) =>
          current.map((item) =>
            item.id === pendingItem.id
              ? {
                  ...item,
                  status: 'creating_draft',
                  error: null,
                }
              : item,
          ),
        );

        const result = await runProcurementIntakeFlow({
          file: pendingItem.file,
          documentKind: pendingItem.documentKind,
          runOcrAfterUpload: true,
          onStepChange: (step) => {
            if (!step) return;
            setBatchQueue((current) =>
              current.map((item) =>
                item.id === pendingItem.id
                  ? {
                      ...item,
                      status: step,
                    }
                  : item,
              ),
            );
          },
        });

        setBatchQueue((current) =>
          current.map((item) =>
            item.id === pendingItem.id
              ? {
                  ...item,
                  status: 'completed',
                  error: null,
                  documentId: result.documentId,
                }
              : item,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        const erroredDocumentId = (err as Error & { documentId?: string })?.documentId ?? null;
        setBatchQueue((current) =>
          current.map((item) =>
            item.id === pendingItem.id
              ? {
                  ...item,
                  status: 'failed',
                  error: message,
                  documentId: erroredDocumentId ?? item.documentId,
                }
              : item,
          ),
        );
      }
    }
    setIsBatchRunning(false);
    router.refresh();
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

      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white">Multisubida OCR por lote</h3>
          <p className="text-xs text-slate-400">
            Selecciona varios archivos para crear borradores draft, subir el original y lanzar OCR de forma secuencial.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-center">
          <select
            value={batchDocumentKind}
            onChange={(event) => setBatchDocumentKind(event.target.value as ProcurementDocumentKind)}
            disabled={isBatchRunning}
            className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white disabled:cursor-not-allowed disabled:text-slate-500"
          >
            <option value="delivery_note">Albarán</option>
            <option value="invoice">Factura</option>
          </select>

          <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500">
            Añadir archivos
            <input
              type="file"
              multiple
              accept={PROCUREMENT_SOURCE_FILE_ACCEPT_ATTRIBUTE}
              disabled={isBatchRunning}
              className="hidden"
              onChange={(event) => {
                addBatchFiles(event.target.files);
                event.currentTarget.value = '';
              }}
            />
          </label>

          <button
            type="button"
            disabled={isBatchRunning || batchSummary.pending === 0}
            onClick={runBatchUpload}
            className="rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
          >
            {isBatchRunning ? 'Procesando lote…' : 'Procesar lote'}
          </button>
        </div>

        <p className="text-xs text-slate-500">Formatos permitidos: PDF, JPG, PNG o WEBP. Cada archivo conserva su estado y errores parciales.</p>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 text-slate-200">Total: {batchSummary.total}</span>
          <span className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 text-slate-200">Pendientes: {batchSummary.pending}</span>
          <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-sky-100">En proceso: {batchSummary.inProgress}</span>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-100">Completados: {batchSummary.completed}</span>
          <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-rose-100">Fallidos: {batchSummary.failed}</span>
          <button
            type="button"
            onClick={clearFinishedBatchQueue}
            disabled={isBatchRunning || (!batchSummary.completed && !batchSummary.failed)}
            className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
          >
            Limpiar finalizados
          </button>
        </div>

        {isBatchFinished ? (
          <p className="text-xs text-slate-400">
            Lote finalizado. Se refresca la bandeja de Compras para mostrar nuevos borradores sin redirigir al detalle.
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full min-w-[900px] text-left text-sm text-slate-200">
            <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Archivo</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Estado cola</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {batchQueue.length === 0 ? (
                <tr className="border-t border-slate-800/60">
                  <td className="px-4 py-5 text-sm text-slate-400" colSpan={5}>
                    Sin archivos en cola. Añade uno o varios para lanzar el lote OCR.
                  </td>
                </tr>
              ) : null}
              {batchQueue.map((item) => (
                <tr key={item.id} className="border-t border-slate-800/60 align-top">
                  <td className="px-4 py-3">{item.fileName}</td>
                  <td className="px-4 py-3">{documentKindLabel(item.documentKind)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100">
                      {item.status === 'pending'
                        ? 'Pendiente'
                        : item.status === 'creating_draft'
                          ? 'Creando draft'
                          : item.status === 'uploading_file'
                            ? 'Subiendo archivo'
                            : item.status === 'running_ocr'
                              ? 'Ejecutando OCR'
                              : item.status === 'completed'
                                ? 'Completado'
                                : 'Fallido'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.documentId ? (
                      <Link href={`/cheffing/compras/${item.documentId}`} className="text-sky-300 underline">
                        Abrir {item.documentId.slice(0, 8)}…
                      </Link>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-rose-300">{item.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
                const possibleDuplicateSignal = resolvePossibleDuplicateSignal(document);

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
                        {document.status === 'draft' && possibleDuplicateSignal.isPossibleDuplicate ? (
                          <p className="inline-flex rounded-full border border-amber-400/50 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-100">
                            Posible duplicado · revisar antes de aplicar
                          </p>
                        ) : null}
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
