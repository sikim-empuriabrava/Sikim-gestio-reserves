'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Supplier = {
  id: string;
  trade_name: string;
  legal_name: string | null;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
};

type SupplierForm = {
  trade_name: string;
  legal_name: string;
  tax_id: string;
  phone: string;
  email: string;
  is_active: boolean;
};

const emptyForm: SupplierForm = {
  trade_name: '',
  legal_name: '',
  tax_id: '',
  phone: '',
  email: '',
  is_active: true,
};

export function ProcurementSuppliersManager({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [createForm, setCreateForm] = useState<SupplierForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<SupplierForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredSuppliers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return initialSuppliers;
    return initialSuppliers.filter((supplier) =>
      [supplier.trade_name, supplier.legal_name ?? '', supplier.tax_id ?? '', supplier.email ?? '']
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [initialSuppliers, query]);

  const toPayload = (form: SupplierForm) => ({
    trade_name: form.trade_name,
    legal_name: form.legal_name,
    tax_id: form.tax_id,
    phone: form.phone,
    email: form.email,
    is_active: form.is_active,
  });

  async function createSupplier() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/cheffing/procurement/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(createForm)),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo crear proveedor');
      }
      setCreateForm(emptyForm);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateSupplier(id: string) {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cheffing/procurement/suppliers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(editingForm)),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'No se pudo actualizar proveedor');
      }
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  const FormFields = ({ form, setForm }: { form: SupplierForm; setForm: (form: SupplierForm) => void }) => (
    <div className="grid gap-3 md:grid-cols-3">
      <input className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" placeholder="Nombre comercial" value={form.trade_name} onChange={(event) => setForm({ ...form, trade_name: event.target.value })} />
      <input className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" placeholder="Razón social" value={form.legal_name} onChange={(event) => setForm({ ...form, legal_name: event.target.value })} />
      <input className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" placeholder="NIF/CIF" value={form.tax_id} onChange={(event) => setForm({ ...form, tax_id: event.target.value })} />
      <input className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" placeholder="Teléfono" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
      <input className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      <label className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
        <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
        Activo
      </label>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <h3 className="text-sm font-semibold text-white">Nuevo proveedor</h3>
        <FormFields form={createForm} setForm={setCreateForm} />
        <button type="button" onClick={createSupplier} disabled={isSubmitting} className="rounded-full border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-200">Crear proveedor</button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <input className="w-full max-w-md rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-white" placeholder="Buscar proveedor..." value={query} onChange={(event) => setQuery(event.target.value)} />
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800/70">
        <table className="w-full min-w-[940px] text-left text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">Nombre comercial</th><th className="px-4 py-3">Razón social</th><th className="px-4 py-3">NIF/CIF</th><th className="px-4 py-3">Contacto</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Acciones</th></tr></thead>
          <tbody>
            {filteredSuppliers.map((supplier) => {
              const isEditing = editingId === supplier.id;
              return (
                <tr key={supplier.id} className="border-t border-slate-800/60">
                  <td className="px-4 py-3">{isEditing ? <input className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" value={editingForm.trade_name} onChange={(event) => setEditingForm({ ...editingForm, trade_name: event.target.value })} /> : supplier.trade_name}</td>
                  <td className="px-4 py-3">{isEditing ? <input className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" value={editingForm.legal_name} onChange={(event) => setEditingForm({ ...editingForm, legal_name: event.target.value })} /> : (supplier.legal_name ?? '—')}</td>
                  <td className="px-4 py-3">{isEditing ? <input className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" value={editingForm.tax_id} onChange={(event) => setEditingForm({ ...editingForm, tax_id: event.target.value })} /> : (supplier.tax_id ?? '—')}</td>
                  <td className="px-4 py-3">{isEditing ? <div className="flex flex-col gap-1"><input className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" value={editingForm.phone} placeholder="Teléfono" onChange={(event) => setEditingForm({ ...editingForm, phone: event.target.value })} /><input className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1" value={editingForm.email} placeholder="Email" onChange={(event) => setEditingForm({ ...editingForm, email: event.target.value })} /></div> : <span>{supplier.phone ?? '—'} · {supplier.email ?? '—'}</span>}</td>
                  <td className="px-4 py-3">{isEditing ? <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editingForm.is_active} onChange={(event) => setEditingForm({ ...editingForm, is_active: event.target.checked })} />Activo</label> : supplier.is_active ? 'Activo' : 'Inactivo'}</td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex gap-2"><button type="button" onClick={() => updateSupplier(supplier.id)} className="rounded-full border border-emerald-400/60 px-3 py-1 text-xs">Guardar</button><button type="button" onClick={() => setEditingId(null)} className="rounded-full border border-slate-700 px-3 py-1 text-xs">Cancelar</button></div>
                    ) : (
                      <button type="button" onClick={() => { setEditingId(supplier.id); setEditingForm({ trade_name: supplier.trade_name, legal_name: supplier.legal_name ?? '', tax_id: supplier.tax_id ?? '', phone: supplier.phone ?? '', email: supplier.email ?? '', is_active: supplier.is_active }); }} className="rounded-full border border-slate-700 px-3 py-1 text-xs">Editar</button>
                    )}
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
