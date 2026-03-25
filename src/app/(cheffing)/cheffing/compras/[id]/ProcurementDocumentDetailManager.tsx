'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { documentKindLabel, documentStatusLabel, lineStatusLabel, type ProcurementDocumentKind } from '@/lib/cheffing/procurement';

type Ingredient = { id: string; name: string };
type Supplier = { id: string; trade_name: string };

type Line = {
  id: string;
  line_number: number;
  raw_description: string;
  raw_quantity: number | null;
  raw_unit: string | null;
  raw_unit_price: number | null;
  raw_line_total: number | null;
  validated_ingredient_id: string | null;
  line_status: 'unresolved' | 'resolved';
  warning_notes: string | null;
  cheffing_ingredients: { name: string | null } | { name: string | null }[] | null;
};

type Doc = {
  id: string;
  supplier_id: string | null;
  document_kind: ProcurementDocumentKind;
  document_number: string | null;
  document_date: string;
  status: 'draft' | 'applied' | 'discarded';
  validation_notes: string | null;
  cheffing_purchase_document_lines: Line[] | null;
};

const emptyLine = {
  raw_description: '',
  raw_quantity: '',
  raw_unit: '',
  raw_unit_price: '',
  raw_line_total: '',
  validated_ingredient_id: '',
  warning_notes: '',
};

export function ProcurementDocumentDetailManager({ document, suppliers, ingredients }: { document: Doc; suppliers: Supplier[]; ingredients: Ingredient[] }) {
  const router = useRouter();
  const [header, setHeader] = useState({
    document_kind: document.document_kind,
    document_number: document.document_number ?? '',
    document_date: document.document_date,
    supplier_id: document.supplier_id ?? '',
    validation_notes: document.validation_notes ?? '',
  });
  const [newLine, setNewLine] = useState(emptyLine);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lines = document.cheffing_purchase_document_lines ?? [];
  const hasUnresolvedLines = lines.some((line) => line.line_status !== 'resolved' || !line.validated_ingredient_id);
  const isDraft = document.status === 'draft';

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
          raw_unit_price: newLine.raw_unit_price ? Number(newLine.raw_unit_price) : null,
          raw_line_total: newLine.raw_line_total ? Number(newLine.raw_line_total) : null,
          validated_ingredient_id: newLine.validated_ingredient_id || null,
          line_status: newLine.validated_ingredient_id ? 'resolved' : 'unresolved',
          warning_notes: newLine.warning_notes,
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
          raw_unit_price: updates.raw_unit_price ? Number(updates.raw_unit_price) : null,
          raw_line_total: updates.raw_line_total ? Number(updates.raw_line_total) : null,
          validated_ingredient_id: validatedId,
          line_status: validatedId ? 'resolved' : 'unresolved',
          warning_notes: updates.warning_notes,
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

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Documento de compra</h2>
        <p className="text-sm text-slate-400">Estado actual: {documentStatusLabel(document.status)} · Tipo: {documentKindLabel(document.document_kind)}</p>
        {document.status === 'draft' ? <p className="text-xs text-amber-300">Borrador pendiente de completar/validar. Aplicar documento todavía no disponible en V1 manual.</p> : null}
      </header>

      {!header.supplier_id ? <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 text-sm text-amber-200">⚠ Sense proveïdor: completa el proveedor antes de preparar la aplicación futura.</div> : null}
      {hasUnresolvedLines ? <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">Hay líneas sin ingrediente validado. Este documento no está listo para aplicar.</div> : <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">Todas las líneas tienen ingrediente validado.</div>}
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <h3 className="text-sm font-semibold text-white">Cabecera</h3>
        <div className="grid gap-3 md:grid-cols-5">
          <select disabled={!isDraft} value={header.document_kind} onChange={(event) => setHeader({ ...header, document_kind: event.target.value as ProcurementDocumentKind })} className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"><option value="invoice">Factura</option><option value="delivery_note">Albarán</option><option value="other">Otro</option></select>
          <input disabled={!isDraft} value={header.document_number} onChange={(event) => setHeader({ ...header, document_number: event.target.value })} placeholder="Número" className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" />
          <input disabled={!isDraft} type="date" value={header.document_date} onChange={(event) => setHeader({ ...header, document_date: event.target.value })} className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" />
          <select disabled={!isDraft} value={header.supplier_id} onChange={(event) => setHeader({ ...header, supplier_id: event.target.value })} className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"><option value="">Sense proveïdor</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.trade_name}</option>)}</select>
          <button disabled={!isDraft || isSubmitting} type="button" onClick={saveHeader} className="rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200">Guardar cabecera</button>
        </div>
      </div>

      {isDraft ? <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <h3 className="text-sm font-semibold text-white">Añadir línea manual</h3>
        <LineForm value={newLine} onChange={setNewLine} ingredients={ingredients} />
        <button type="button" onClick={addLine} disabled={isSubmitting} className="rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200">Añadir línea</button>
      </div> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-800/70">
        <table className="w-full min-w-[1200px] text-left text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Descripción original</th><th className="px-4 py-3">Cantidad</th><th className="px-4 py-3">Unidad</th><th className="px-4 py-3">P.Unit</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Ingrediente validado</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Warning/notas</th><th className="px-4 py-3">Acciones</th></tr></thead>
          <tbody>
            {lines.map((line) => <EditableLineRow key={line.id} line={line} ingredients={ingredients} isDraft={isDraft} isEditing={editingLineId === line.id} onEdit={() => setEditingLineId(line.id)} onCancel={() => setEditingLineId(null)} onSave={saveLine} onDelete={deleteLine} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LineForm({ value, onChange, ingredients }: { value: typeof emptyLine; onChange: (value: typeof emptyLine) => void; ingredients: Ingredient[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      <input value={value.raw_description} onChange={(event) => onChange({ ...value, raw_description: event.target.value })} placeholder="Descripción" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white" />
      <input type="number" step="0.001" value={value.raw_quantity} onChange={(event) => onChange({ ...value, raw_quantity: event.target.value })} placeholder="Cantidad" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white" />
      <input value={value.raw_unit} onChange={(event) => onChange({ ...value, raw_unit: event.target.value })} placeholder="Unidad" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white" />
      <input type="number" step="0.0001" value={value.raw_unit_price} onChange={(event) => onChange({ ...value, raw_unit_price: event.target.value })} placeholder="Precio unitario" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white" />
      <input type="number" step="0.0001" value={value.raw_line_total} onChange={(event) => onChange({ ...value, raw_line_total: event.target.value })} placeholder="Total línea" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white" />
      <select value={value.validated_ingredient_id} onChange={(event) => onChange({ ...value, validated_ingredient_id: event.target.value })} className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"><option value="">Sin validar</option>{ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}</select>
      <input value={value.warning_notes} onChange={(event) => onChange({ ...value, warning_notes: event.target.value })} placeholder="Warning/nota" className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white md:col-span-2" />
    </div>
  );
}

function EditableLineRow({ line, ingredients, isDraft, isEditing, onEdit, onCancel, onSave, onDelete }: { line: Line; ingredients: Ingredient[]; isDraft: boolean; isEditing: boolean; onEdit: () => void; onCancel: () => void; onSave: (line: Line, updates: typeof emptyLine) => void; onDelete: (lineId: string) => void }) {
  const ingredientName = useMemo(() => {
    const source = line.cheffing_ingredients;
    return Array.isArray(source) ? source[0]?.name : source?.name;
  }, [line.cheffing_ingredients]);
  const [form, setForm] = useState({
    raw_description: line.raw_description,
    raw_quantity: line.raw_quantity?.toString() ?? '',
    raw_unit: line.raw_unit ?? '',
    raw_unit_price: line.raw_unit_price?.toString() ?? '',
    raw_line_total: line.raw_line_total?.toString() ?? '',
    validated_ingredient_id: line.validated_ingredient_id ?? '',
    warning_notes: line.warning_notes ?? '',
  });

  return (
    <tr className="border-t border-slate-800/60">
      <td className="px-4 py-3">{line.line_number}</td>
      <td className="px-4 py-3">{isEditing ? <input value={form.raw_description} onChange={(event) => setForm({ ...form, raw_description: event.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : line.raw_description}</td>
      <td className="px-4 py-3">{isEditing ? <input type="number" value={form.raw_quantity} onChange={(event) => setForm({ ...form, raw_quantity: event.target.value })} className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : (line.raw_quantity ?? '—')}</td>
      <td className="px-4 py-3">{isEditing ? <input value={form.raw_unit} onChange={(event) => setForm({ ...form, raw_unit: event.target.value })} className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : (line.raw_unit ?? '—')}</td>
      <td className="px-4 py-3">{isEditing ? <input type="number" value={form.raw_unit_price} onChange={(event) => setForm({ ...form, raw_unit_price: event.target.value })} className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : (line.raw_unit_price ?? '—')}</td>
      <td className="px-4 py-3">{isEditing ? <input type="number" value={form.raw_line_total} onChange={(event) => setForm({ ...form, raw_line_total: event.target.value })} className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : (line.raw_line_total ?? '—')}</td>
      <td className="px-4 py-3">{isEditing ? <select value={form.validated_ingredient_id} onChange={(event) => setForm({ ...form, validated_ingredient_id: event.target.value })} className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1"><option value="">Sin validar</option>{ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}</select> : (ingredientName ?? '—')}</td>
      <td className="px-4 py-3">{lineStatusLabel(line.line_status)}</td>
      <td className="px-4 py-3">{isEditing ? <input value={form.warning_notes} onChange={(event) => setForm({ ...form, warning_notes: event.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" /> : (line.warning_notes ?? '—')}</td>
      <td className="px-4 py-3">
        {isDraft ? (
          isEditing ? <div className="flex gap-2"><button type="button" onClick={() => onSave(line, form)} className="rounded-full border border-emerald-400/60 px-3 py-1 text-xs">Guardar</button><button type="button" onClick={onCancel} className="rounded-full border border-slate-700 px-3 py-1 text-xs">Cancelar</button></div> : <div className="flex gap-2"><button type="button" onClick={onEdit} className="rounded-full border border-slate-700 px-3 py-1 text-xs">Editar</button><button type="button" onClick={() => onDelete(line.id)} className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-200">Borrar</button></div>
        ) : <span className="text-xs text-slate-500">Solo lectura</span>}
      </td>
    </tr>
  );
}
