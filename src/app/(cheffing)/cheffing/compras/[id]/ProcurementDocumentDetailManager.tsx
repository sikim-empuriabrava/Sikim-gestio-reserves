'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  documentKindLabel,
  documentStatusLabel,
  inferProcurementSourceFileKind,
  lineStatusLabel,
  PROCUREMENT_CANONICAL_UNITS,
  PROCUREMENT_SOURCE_FILE_ACCEPTED_MIME_TYPES,
  type ProcurementDocumentKind,
  type ProcurementCanonicalUnit,
} from '@/lib/cheffing/procurement';

type Ingredient = { id: string; name: string };
type Supplier = { id: string; trade_name: string };

type Line = {
  id: string;
  line_number: number;
  raw_description: string;
  raw_quantity: number | null;
  raw_unit: string | null;
  validated_unit: ProcurementCanonicalUnit | null;
  raw_unit_price: number | null;
  raw_line_total: number | null;
  validated_ingredient_id: string | null;
  line_status: 'unresolved' | 'resolved';
  warning_notes: string | null;
  user_note: string | null;
  validated_ingredient: { name: string | null } | { name: string | null }[] | null;
};

type Doc = {
  id: string;
  supplier_id: string | null;
  document_kind: ProcurementDocumentKind;
  document_number: string | null;
  document_date: string;
  effective_at: string | null;
  status: 'draft' | 'applied' | 'discarded';
  validation_notes: string | null;
  declared_total: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  interpreted_payload: Record<string, unknown> | null;
  applied_at: string | null;
  applied_by: string | null;
  cheffing_purchase_document_lines: Line[] | null;
};

const emptyLine = {
  raw_description: '',
  raw_quantity: '',
  raw_unit: '',
  validated_unit: '',
  raw_unit_price: '',
  raw_line_total: '',
  validated_ingredient_id: '',
  user_note: '',
};

const emptySupplierForm = {
  trade_name: '',
  legal_name: '',
  tax_id: '',
  phone: '',
  email: '',
};

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function normalizeNullableText(value: string): string | null {
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function parseNullableNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized.length) return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

export function ProcurementDocumentDetailManager({
  document,
  suppliers,
  ingredients,
  initialSourceFileUrl,
}: {
  document: Doc;
  suppliers: Supplier[];
  ingredients: Ingredient[];
  initialSourceFileUrl: string | null;
}) {
  const router = useRouter();
  const [header, setHeader] = useState({
    document_kind: document.document_kind,
    document_number: document.document_number ?? '',
    document_date: document.document_date,
    supplier_id: document.supplier_id ?? '',
    validation_notes: document.validation_notes ?? '',
    declared_total: document.declared_total?.toString() ?? '',
  });
  const [newLine, setNewLine] = useState(emptyLine);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceFileUrl, setSourceFileUrl] = useState<string | null>(initialSourceFileUrl);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState(emptySupplierForm);

  const lines = document.cheffing_purchase_document_lines ?? [];
  const isDraft = document.status === 'draft';
  const linesCount = lines.length;
  const calculatedLinesTotal = lines.reduce((sum, line) => sum + (line.raw_line_total ?? 0), 0);
  const hasUnresolvedLines = lines.some((line) => line.line_status !== 'resolved');
  const hasLinesWithoutIngredient = lines.some((line) => !line.validated_ingredient_id);
  const hasLinesWithoutApplicableCost = lines.some((line) => line.raw_unit_price === null);
  const sourceFileKind = inferProcurementSourceFileKind(document.storage_path);

  const hasUnsavedHeaderChanges =
    header.supplier_id !== (document.supplier_id ?? '') ||
    header.document_kind !== document.document_kind ||
    normalizeNullableText(header.document_number) !== (document.document_number ?? null) ||
    header.document_date !== document.document_date ||
    normalizeNullableText(header.validation_notes) !== (document.validation_notes ?? null) ||
    parseNullableNumber(header.declared_total) !== (document.declared_total ?? null);

  const readinessReasons = [
    !header.supplier_id ? 'Falta proveedor confirmado en cabecera.' : null,
    !lines.length ? 'No hay líneas en el documento.' : null,
    hasUnresolvedLines ? 'Hay líneas pendientes de resolver.' : null,
    hasLinesWithoutIngredient ? 'Hay líneas sin ingrediente validado.' : null,
    hasLinesWithoutApplicableCost ? 'Hay líneas sin coste aplicable (raw_unit_price).' : null,
    hasUnsavedHeaderChanges ? 'Guarda la cabecera antes de aplicar el documento.' : null,
  ].filter(Boolean) as string[];
  const canApply = isDraft && readinessReasons.length === 0 && !hasUnsavedHeaderChanges;

  const supplierLabel = useMemo(
    () => suppliers.find((supplier) => supplier.id === header.supplier_id)?.trade_name ?? null,
    [header.supplier_id, suppliers],
  );

  const detectedSupplier = useMemo(() => {
    const supplier = document.interpreted_payload && typeof document.interpreted_payload === 'object' ? (document.interpreted_payload.supplier as Record<string, unknown> | undefined) : undefined;
    if (!supplier || typeof supplier !== 'object') return null;

    return {
      name: typeof supplier.name === 'string' ? supplier.name : null,
      taxId: typeof supplier.tax_id === 'string' ? supplier.tax_id : null,
      email: typeof supplier.email === 'string' ? supplier.email : null,
      phone: typeof supplier.phone === 'string' ? supplier.phone : null,
      matchHint: typeof supplier.match_hint === 'string' ? supplier.match_hint : null,
    };
  }, [document.interpreted_payload]);

  const supplierPrefill = useMemo(() => {
    const supplier = document.interpreted_payload && typeof document.interpreted_payload === 'object' ? (document.interpreted_payload.supplier as Record<string, unknown> | undefined) : undefined;
    if (!supplier || typeof supplier !== 'object') return emptySupplierForm;

    return {
      trade_name:
        typeof supplier.trade_name === 'string'
          ? supplier.trade_name
          : typeof supplier.name === 'string'
            ? supplier.name
            : '',
      legal_name: typeof supplier.legal_name === 'string' ? supplier.legal_name : '',
      tax_id: typeof supplier.tax_id === 'string' ? supplier.tax_id : '',
      phone: typeof supplier.phone === 'string' ? supplier.phone : '',
      email: typeof supplier.email === 'string' ? supplier.email : '',
    };
  }, [document.interpreted_payload]);

  function openNewSupplierForm() {
    if (hasUnsavedHeaderChanges) return;
    setNewSupplierForm(supplierPrefill);
    setIsCreatingSupplier(true);
    setError(null);
  }

  function cancelNewSupplierForm() {
    setIsCreatingSupplier(false);
    setNewSupplierForm(emptySupplierForm);
  }

  async function saveHeader() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_kind: header.document_kind,
          document_number: header.document_number,
          document_date: header.document_date,
          supplier_id: header.supplier_id || null,
          validation_notes: header.validation_notes,
          declared_total: header.declared_total ? Number(header.declared_total) : null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo guardar cabecera');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createAndAssignSupplier() {
    const tradeName = newSupplierForm.trade_name.trim();
    if (!tradeName) {
      setError('El nombre comercial (trade_name) es obligatorio.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const createResponse = await fetch('/api/cheffing/procurement/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade_name: tradeName,
          legal_name: newSupplierForm.legal_name,
          tax_id: newSupplierForm.tax_id,
          phone: newSupplierForm.phone,
          email: newSupplierForm.email,
        }),
      });

      const createPayload = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok) {
        throw new Error(createPayload?.error ?? 'No se pudo crear proveedor');
      }

      const newSupplierId = typeof createPayload?.id === 'string' ? createPayload.id : null;
      if (!newSupplierId) {
        throw new Error('No se recibió id del proveedor creado.');
      }

      const assignResponse = await fetch(`/api/cheffing/procurement/documents/${document.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id: newSupplierId }),
      });

      const assignPayload = await assignResponse.json().catch(() => ({}));
      if (!assignResponse.ok) {
        throw new Error(assignPayload?.error ?? 'No se pudo asignar el proveedor al documento');
      }

      setHeader((current) => ({ ...current, supplier_id: newSupplierId }));
      setIsCreatingSupplier(false);
      setNewSupplierForm(emptySupplierForm);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function uploadSourceFile() {
    if (!fileToUpload) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set('file', fileToUpload);

      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}/source-file`, {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? 'No se pudo subir el archivo original');
      }

      if (typeof payload.sourceFileUrl === 'string') {
        setSourceFileUrl(payload.sourceFileUrl);
      }
      setFileToUpload(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addLine() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_description: newLine.raw_description,
          raw_quantity: newLine.raw_quantity ? Number(newLine.raw_quantity) : null,
          raw_unit: newLine.raw_unit,
          validated_unit: newLine.validated_unit || null,
          raw_unit_price: newLine.raw_unit_price ? Number(newLine.raw_unit_price) : null,
          raw_line_total: newLine.raw_line_total ? Number(newLine.raw_line_total) : null,
          validated_ingredient_id: newLine.validated_ingredient_id || null,
          line_status: newLine.validated_ingredient_id ? 'resolved' : 'unresolved',
          user_note: newLine.user_note,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo crear la línea');
      }
      setNewLine(emptyLine);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveLine(line: Line, updates: typeof emptyLine) {
    setError(null);
    setIsSubmitting(true);
    try {
      const validatedId = updates.validated_ingredient_id || null;
      const response = await fetch(`/api/cheffing/procurement/lines/${line.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_description: updates.raw_description,
          raw_quantity: updates.raw_quantity ? Number(updates.raw_quantity) : null,
          raw_unit: updates.raw_unit,
          validated_unit: updates.validated_unit || null,
          raw_unit_price: updates.raw_unit_price ? Number(updates.raw_unit_price) : null,
          raw_line_total: updates.raw_line_total ? Number(updates.raw_line_total) : null,
          validated_ingredient_id: validatedId,
          line_status: validatedId ? 'resolved' : 'unresolved',
          user_note: updates.user_note,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo actualizar la línea');
      }
      setEditingLineId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteLine(lineId: string) {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/lines/${lineId}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo borrar la línea');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function applyDocument() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}/apply`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo aplicar el documento');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function discardDocument() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}/discard`, { method: 'POST' });
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

  async function recoverDocument() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}/recover`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo recuperar el documento');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteDocumentPermanently() {
    const confirmed = window.confirm('¿Seguro que quieres eliminar este documento?\n\nEsta acción no se puede deshacer.');
    if (!confirmed) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/documents/${document.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo eliminar el documento');
      }
      router.push('/cheffing/compras');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Ficha operativa</p>
            <h2 className="text-xl font-semibold text-white">Documento de compra</h2>
            <p className="text-sm text-slate-400">Misma pantalla para carga manual, borrador OCR futuro y consulta en solo lectura.</p>
          </div>
          <div className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-200">
            Estado: {documentStatusLabel(document.status)}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 xl:col-span-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Proveedor confirmado</p>
            <p className="mt-1 text-base font-semibold text-white">{supplierLabel ?? 'Sin proveedor asignado'}</p>
            {!header.supplier_id ? <p className="mt-2 text-xs text-amber-300">⚠ Completa proveedor confirmado para dejar el documento listo para aplicar.</p> : null}
          </div>
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-3 xl:col-span-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Proveedor detectado (scaffold OCR)</p>
            {detectedSupplier ? (
              <div className="mt-1 space-y-1 text-sm text-slate-200">
                <p>{detectedSupplier.name ?? 'Sin nombre detectado'}</p>
                <p className="text-xs text-slate-400">NIF/CIF: {detectedSupplier.taxId ?? '—'} · Email: {detectedSupplier.email ?? '—'} · Tel: {detectedSupplier.phone ?? '—'}</p>
                <p className="text-xs text-slate-400">Match sugerido: {detectedSupplier.matchHint ?? 'Pendiente (sin OCR real en esta fase)'}</p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-400">Sin datos detectados todavía. Este bloque queda preparado para OCR + matching futuro.</p>
            )}
          </div>
          <HeaderDatum label="Tipo" value={documentKindLabel(header.document_kind)} />
          <HeaderDatum label="Número" value={header.document_number || '—'} />
          <HeaderDatum label="Fecha" value={header.document_date} />
          <HeaderDatum label="Total declarado" value={header.declared_total ? formatCurrency(Number(header.declared_total)) : '—'} />
          <HeaderDatum label="Total calculado líneas" value={formatCurrency(calculatedLinesTotal)} />
          <HeaderDatum label="Líneas" value={String(linesCount)} />
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Cabecera del documento</h3>
              {isDraft ? (
                <button disabled={isSubmitting} type="button" onClick={saveHeader} className="rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200">
                  Guardar cabecera
                </button>
              ) : (
                <span className="text-xs text-slate-500">Solo lectura</span>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Proveedor confirmado</label>
                <select disabled={!isDraft} value={header.supplier_id} onChange={(event) => setHeader({ ...header, supplier_id: event.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white">
                  <option value="">Sense proveïdor</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.trade_name}
                    </option>
                  ))}
                </select>
                {isDraft ? (
                  <div className="space-y-2">
                    {!isCreatingSupplier ? (
                      <button
                        type="button"
                        onClick={openNewSupplierForm}
                        disabled={hasUnsavedHeaderChanges}
                        className="text-xs font-semibold text-emerald-300 underline decoration-dotted underline-offset-4 disabled:cursor-not-allowed disabled:text-slate-500"
                      >
                        Crear nuevo proveedor
                      </button>
                    ) : (
                      <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nuevo proveedor</p>
                        <div className="grid gap-2">
                          <input
                            value={newSupplierForm.trade_name}
                            onChange={(event) => setNewSupplierForm((current) => ({ ...current, trade_name: event.target.value }))}
                            placeholder="Nombre comercial *"
                            className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                          />
                          <input
                            value={newSupplierForm.legal_name}
                            onChange={(event) => setNewSupplierForm((current) => ({ ...current, legal_name: event.target.value }))}
                            placeholder="Razón social"
                            className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                          />
                          <input
                            value={newSupplierForm.tax_id}
                            onChange={(event) => setNewSupplierForm((current) => ({ ...current, tax_id: event.target.value }))}
                            placeholder="NIF/CIF"
                            className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                          />
                          <input
                            value={newSupplierForm.phone}
                            onChange={(event) => setNewSupplierForm((current) => ({ ...current, phone: event.target.value }))}
                            placeholder="Teléfono"
                            className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                          />
                          <input
                            value={newSupplierForm.email}
                            onChange={(event) => setNewSupplierForm((current) => ({ ...current, email: event.target.value }))}
                            placeholder="Email"
                            className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={createAndAssignSupplier} disabled={isSubmitting} className="rounded-full border border-emerald-400/60 px-3 py-1 text-xs font-semibold text-emerald-200">
                            Guardar y asignar
                          </button>
                          <button type="button" onClick={cancelNewSupplierForm} disabled={isSubmitting} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                    {hasUnsavedHeaderChanges ? (
                      <p className="text-xs text-amber-300">Guarda primero la cabecera antes de crear y asignar un proveedor nuevo.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Tipo de documento</label>
                <select disabled={!isDraft} value={header.document_kind} onChange={(event) => setHeader({ ...header, document_kind: event.target.value as ProcurementDocumentKind })} className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white">
                  <option value="invoice">Factura</option>
                  <option value="delivery_note">Albarán</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <input disabled={!isDraft} value={header.document_number} onChange={(event) => setHeader({ ...header, document_number: event.target.value })} placeholder="Número de documento" className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" />
              <input disabled={!isDraft} type="date" value={header.document_date} onChange={(event) => setHeader({ ...header, document_date: event.target.value })} className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" />
              <input disabled={!isDraft} type="number" step="0.01" min="0" value={header.declared_total} onChange={(event) => setHeader({ ...header, declared_total: event.target.value })} placeholder="Total declarado" className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" />
              <input disabled value={formatCurrency(calculatedLinesTotal)} className="rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-slate-300" />
              <textarea disabled={!isDraft} value={header.validation_notes} onChange={(event) => setHeader({ ...header, validation_notes: event.target.value })} placeholder="Notas internas / revisión" className="min-h-24 rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white md:col-span-2" />
            </div>
          </section>

          {isDraft ? (
            <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">Líneas del documento</h3>
                <button type="button" onClick={addLine} disabled={isSubmitting} className="rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200">
                  Añadir línea
                </button>
              </div>
              <LineForm value={newLine} onChange={setNewLine} ingredients={ingredients} />
            </section>
          ) : null}

          <section className="overflow-x-auto rounded-2xl border border-slate-800/70">
            <table className="w-full min-w-[1200px] text-left text-sm text-slate-200">
              <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Descripción original</th>
                  <th className="px-4 py-3">Ingrediente vinculado</th>
                  <th className="px-4 py-3">Cantidad</th>
                  <th className="px-4 py-3">Unidad (canónica)</th>
                  <th className="px-4 py-3">Precio unitario</th>
                  <th className="px-4 py-3">Total línea</th>
                  <th className="px-4 py-3">Warning sistema</th>
                  <th className="px-4 py-3">Nota manual</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <EditableLineRow
                    key={line.id}
                    line={line}
                    ingredients={ingredients}
                    isDraft={isDraft}
                    isEditing={editingLineId === line.id}
                    onEdit={() => setEditingLineId(line.id)}
                    onCancel={() => setEditingLineId(null)}
                    onSave={saveLine}
                    onDelete={deleteLine}
                  />
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold text-white">Documento original</h3>
            <p className="text-xs text-slate-400">Sube imagen o PDF para revisión lado a lado con cabecera y líneas. No se procesa OCR en esta fase.</p>

            {document.storage_path ? (
              <p className="text-xs text-slate-500 break-all">{document.storage_path}</p>
            ) : (
              <p className="text-xs text-slate-500">Aún no hay archivo asociado.</p>
            )}

            {isDraft ? (
              <div className="space-y-2">
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) => setFileToUpload(event.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-slate-300 file:mr-4 file:rounded-full file:border file:border-slate-700 file:bg-slate-900 file:px-3 file:py-1 file:text-slate-200"
                />
                <p className="text-[11px] text-slate-500">Tipos permitidos: {PROCUREMENT_SOURCE_FILE_ACCEPTED_MIME_TYPES.join(', ')}.</p>
                <button
                  type="button"
                  disabled={!fileToUpload || isSubmitting}
                  onClick={uploadSourceFile}
                  className="w-full rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                >
                  {document.storage_path ? 'Reemplazar archivo original' : 'Subir archivo original'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Documento en solo lectura: no se permite reemplazar archivo fuera de draft.</p>
            )}

            {sourceFileUrl && sourceFileKind === 'image' ? (
              <a href={sourceFileUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-700">
                <img src={sourceFileUrl} alt="Documento original" className="max-h-[26rem] w-full object-contain bg-slate-950" />
              </a>
            ) : null}

            {sourceFileUrl && sourceFileKind === 'pdf' ? (
              <div className="space-y-2">
                <iframe src={sourceFileUrl} title="Documento original PDF" className="h-[26rem] w-full rounded-lg border border-slate-700 bg-slate-950" />
                <a href={sourceFileUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-300 underline">Abrir PDF en pestaña nueva</a>
              </div>
            ) : null}

            {sourceFileUrl && sourceFileKind === 'unknown' ? (
              <a href={sourceFileUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-300 underline">Abrir archivo original</a>
            ) : null}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold text-white">Resumen y readiness</h3>
            <dl className="space-y-2 text-sm">
              <SummaryRow label="Líneas" value={String(linesCount)} />
              <SummaryRow label="Total calculado" value={formatCurrency(calculatedLinesTotal)} />
              <SummaryRow label="Total declarado" value={header.declared_total ? formatCurrency(Number(header.declared_total)) : '—'} />
            </dl>

            {readinessReasons.length > 0 ? (
              <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                <p className="font-semibold">Bloqueos para aplicar</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {readinessReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                Documento listo para aplicar. Se usará <code>raw_unit_price</code> como coste manual V1 por línea.
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold text-white">Acciones</h3>

            {document.status === 'draft' ? (
              <button
                type="button"
                onClick={applyDocument}
                disabled={!canApply || isSubmitting}
                className="w-full rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
              >
                Aplicar documento
              </button>
            ) : null}

            {document.status === 'draft' ? (
              <button type="button" onClick={discardDocument} disabled={isSubmitting} className="w-full rounded-full border border-amber-500/60 px-4 py-2 text-sm text-amber-200">
                Descartar documento
              </button>
            ) : null}

            {document.status === 'draft' ? (
              <button type="button" onClick={deleteDocumentPermanently} disabled={isSubmitting} className="w-full rounded-full border border-rose-500/60 px-4 py-2 text-sm text-rose-200">
                Eliminar definitivo
              </button>
            ) : null}

            {document.status === 'discarded' ? (
              <>
                <button type="button" onClick={recoverDocument} disabled={isSubmitting} className="w-full rounded-full border border-emerald-500/50 px-4 py-2 text-sm text-emerald-200">
                  Recuperar a borrador
                </button>
                <button type="button" onClick={deleteDocumentPermanently} disabled={isSubmitting} className="w-full rounded-full border border-rose-500/60 px-4 py-2 text-sm text-rose-200">
                  Eliminar definitivo
                </button>
              </>
            ) : null}

            {document.status === 'applied' ? <p className="text-xs text-emerald-300">Documento aplicado en solo lectura.</p> : null}
            {document.status === 'discarded' ? <p className="text-xs text-slate-300">Documento descartado: se puede recuperar o eliminar de forma permanente.</p> : null}
          </section>

          {error ? <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p> : null}
        </aside>
      </div>
    </div>
  );
}

function HeaderDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-2 last:border-none last:pb-0">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-white">{value}</dd>
    </div>
  );
}

function LineForm({ value, onChange, ingredients }: { value: typeof emptyLine; onChange: (value: typeof emptyLine) => void; ingredients: Ingredient[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      <input value={value.raw_description} onChange={(event) => onChange({ ...value, raw_description: event.target.value })} placeholder="Descripción original" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white md:col-span-2" />
      <select value={value.validated_ingredient_id} onChange={(event) => onChange({ ...value, validated_ingredient_id: event.target.value })} className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white md:col-span-2">
        <option value="">Ingrediente sin validar</option>
        {ingredients.map((ingredient) => (
          <option key={ingredient.id} value={ingredient.id}>
            {ingredient.name}
          </option>
        ))}
      </select>
      <input type="number" step="0.001" value={value.raw_quantity} onChange={(event) => onChange({ ...value, raw_quantity: event.target.value })} placeholder="Cantidad" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white" />
      <input value={value.raw_unit} onChange={(event) => onChange({ ...value, raw_unit: event.target.value })} placeholder="Unidad original (traza)" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white" />
      <select value={value.validated_unit} onChange={(event) => onChange({ ...value, validated_unit: event.target.value })} className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white">
        <option value="">Unidad canónica sin validar</option>
        {PROCUREMENT_CANONICAL_UNITS.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>
      <input type="number" step="0.0001" value={value.raw_unit_price} onChange={(event) => onChange({ ...value, raw_unit_price: event.target.value })} placeholder="Precio unitario" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white" />
      <input type="number" step="0.0001" value={value.raw_line_total} onChange={(event) => onChange({ ...value, raw_line_total: event.target.value })} placeholder="Total línea" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white" />
      <input value={value.user_note} onChange={(event) => onChange({ ...value, user_note: event.target.value })} placeholder="Nota manual (opcional)" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white md:col-span-4" />
    </div>
  );
}

function EditableLineRow({ line, ingredients, isDraft, isEditing, onEdit, onCancel, onSave, onDelete }: { line: Line; ingredients: Ingredient[]; isDraft: boolean; isEditing: boolean; onEdit: () => void; onCancel: () => void; onSave: (line: Line, updates: typeof emptyLine) => void; onDelete: (lineId: string) => void }) {
  const ingredientName = useMemo(() => {
    const source = line.validated_ingredient;
    return Array.isArray(source) ? source[0]?.name : source?.name;
  }, [line.validated_ingredient]);
  const [form, setForm] = useState({
    raw_description: line.raw_description,
    raw_quantity: line.raw_quantity?.toString() ?? '',
    raw_unit: line.raw_unit ?? '',
    validated_unit: line.validated_unit ?? '',
    raw_unit_price: line.raw_unit_price?.toString() ?? '',
    raw_line_total: line.raw_line_total?.toString() ?? '',
    validated_ingredient_id: line.validated_ingredient_id ?? '',
    user_note: line.user_note ?? '',
  });

  return (
    <tr className="border-t border-slate-800/60">
      <td className="px-4 py-3">{line.line_number}</td>
      <td className="px-4 py-3">{isEditing ? <input value={form.raw_description} onChange={(event) => setForm({ ...form, raw_description: event.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : line.raw_description}</td>
      <td className="px-4 py-3">{isEditing ? <select value={form.validated_ingredient_id} onChange={(event) => setForm({ ...form, validated_ingredient_id: event.target.value })} className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1"><option value="">Sin validar</option>{ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}</select> : (ingredientName ?? '—')}</td>
      <td className="px-4 py-3">{isEditing ? <input type="number" value={form.raw_quantity} onChange={(event) => setForm({ ...form, raw_quantity: event.target.value })} className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : (line.raw_quantity ?? '—')}</td>
      <td className="px-4 py-3">
        {isEditing ? (
          <select value={form.validated_unit} onChange={(event) => setForm({ ...form, validated_unit: event.target.value })} className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1">
            <option value="">—</option>
            {PROCUREMENT_CANONICAL_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-1">
            <p>{line.validated_unit ?? '—'}</p>
            <p className="text-xs text-slate-500">Original: {line.raw_unit ?? '—'}</p>
          </div>
        )}
      </td>
      <td className="px-4 py-3">{isEditing ? <input type="number" value={form.raw_unit_price} onChange={(event) => setForm({ ...form, raw_unit_price: event.target.value })} className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : (line.raw_unit_price ?? '—')}</td>
      <td className="px-4 py-3">{isEditing ? <input type="number" value={form.raw_line_total} onChange={(event) => setForm({ ...form, raw_line_total: event.target.value })} className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : (line.raw_line_total ?? '—')}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{line.warning_notes ?? '—'}</td>
      <td className="px-4 py-3">{isEditing ? <input value={form.user_note} onChange={(event) => setForm({ ...form, user_note: event.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : (line.user_note ?? '—')}</td>
      <td className="px-4 py-3">{lineStatusLabel(line.line_status)}</td>
      <td className="px-4 py-3">
        {isDraft ? (
          isEditing ? <div className="flex gap-2"><button type="button" onClick={() => onSave(line, form)} className="rounded-full border border-emerald-400/60 px-3 py-1 text-xs">Guardar</button><button type="button" onClick={onCancel} className="rounded-full border border-slate-700 px-3 py-1 text-xs">Cancelar</button></div> : <div className="flex gap-2"><button type="button" onClick={onEdit} className="rounded-full border border-slate-700 px-3 py-1 text-xs">Editar</button><button type="button" onClick={() => onDelete(line.id)} className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200">Borrar</button></div>
        ) : <span className="text-xs text-slate-500">Solo lectura</span>}
      </td>
    </tr>
  );
}
