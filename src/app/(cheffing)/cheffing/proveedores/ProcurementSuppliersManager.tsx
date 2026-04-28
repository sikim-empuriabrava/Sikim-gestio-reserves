'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';

import { DataTableShell, StatusBadge, Surface, Toolbar, cn } from '@/components/ui';
import {
  CheffingButton,
  CheffingEmptyState,
  CheffingSearchInput,
  CheffingTableActionButton,
  cheffingEditingRowClassName,
  cheffingInputClassName,
  cheffingRowClassName,
  cheffingTableClassName,
  cheffingTheadClassName,
} from '@/app/(cheffing)/cheffing/components/CheffingUi';

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
      <input
        className={cheffingInputClassName}
        placeholder="Nombre comercial"
        value={form.trade_name}
        onChange={(event) => setForm({ ...form, trade_name: event.target.value })}
      />
      <input
        className={cheffingInputClassName}
        placeholder="Razón social"
        value={form.legal_name}
        onChange={(event) => setForm({ ...form, legal_name: event.target.value })}
      />
      <input
        className={cheffingInputClassName}
        placeholder="NIF/CIF"
        value={form.tax_id}
        onChange={(event) => setForm({ ...form, tax_id: event.target.value })}
      />
      <input
        className={cheffingInputClassName}
        placeholder="Teléfono"
        value={form.phone}
        onChange={(event) => setForm({ ...form, phone: event.target.value })}
      />
      <input
        className={cheffingInputClassName}
        placeholder="Email"
        value={form.email}
        onChange={(event) => setForm({ ...form, email: event.target.value })}
      />
      <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-950/75 px-3 text-sm text-slate-200 transition-colors hover:border-slate-600">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
          className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-primary-500 focus:ring-primary-500/30"
        />
        Activo
      </label>
    </div>
  );

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100">
          {error}
        </div>
      ) : null}

      <Surface padding="md">
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">Nuevo proveedor</h3>
            <p className="text-sm text-slate-400">Alta manual para documentos de compra.</p>
          </div>
          <FormFields form={createForm} setForm={setCreateForm} />
          <CheffingButton type="button" tone="success" onClick={createSupplier} disabled={isSubmitting}>
            Crear proveedor
          </CheffingButton>
        </div>
      </Surface>

      <DataTableShell
        title="Listado de proveedores"
        description="Contacto, fiscal y estado operativo para compras."
        toolbar={
          <Toolbar
            leading={
              <CheffingSearchInput
                label="Buscar proveedor"
                placeholder="Buscar proveedor"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full xl:w-[420px]"
              />
            }
            actions={
              <StatusBadge tone={query ? 'accent' : 'muted'}>
                {filteredSuppliers.length} visibles
              </StatusBadge>
            }
          />
        }
        footer={`Mostrando ${filteredSuppliers.length} de ${initialSuppliers.length} proveedores`}
      >
        <table className={cn(cheffingTableClassName, 'min-w-[980px]')}>
          <thead className={cheffingTheadClassName}>
            <tr className="border-b border-slate-800/80">
              <th className="px-4 py-3 font-semibold text-slate-300">Nombre comercial</th>
              <th className="px-4 py-3 font-semibold text-slate-300">Razón social</th>
              <th className="px-4 py-3 font-semibold text-slate-300">NIF/CIF</th>
              <th className="px-4 py-3 font-semibold text-slate-300">Contacto</th>
              <th className="px-4 py-3 font-semibold text-slate-300">Estado</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/20">
            {filteredSuppliers.length === 0 ? (
              <CheffingEmptyState
                colSpan={6}
                title="No hay proveedores para esta busqueda."
                description="Limpia el filtro o crea un proveedor nuevo."
              />
            ) : (
              filteredSuppliers.map((supplier) => {
                const isEditing = editingId === supplier.id;
                return (
                  <tr key={supplier.id} className={cn(cheffingRowClassName, isEditing && cheffingEditingRowClassName)}>
                    <td className="px-4 py-3 align-middle">
                      {isEditing ? (
                        <input
                          className={cheffingInputClassName}
                          value={editingForm.trade_name}
                          onChange={(event) => setEditingForm({ ...editingForm, trade_name: event.target.value })}
                        />
                      ) : (
                        <span className="font-semibold text-white">{supplier.trade_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-300">
                      {isEditing ? (
                        <input
                          className={cheffingInputClassName}
                          value={editingForm.legal_name}
                          onChange={(event) => setEditingForm({ ...editingForm, legal_name: event.target.value })}
                        />
                      ) : (
                        supplier.legal_name ?? '-'
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-300">
                      {isEditing ? (
                        <input
                          className={cheffingInputClassName}
                          value={editingForm.tax_id}
                          onChange={(event) => setEditingForm({ ...editingForm, tax_id: event.target.value })}
                        />
                      ) : (
                        supplier.tax_id ?? '-'
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-300">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <input
                            className={cheffingInputClassName}
                            value={editingForm.phone}
                            placeholder="Teléfono"
                            onChange={(event) => setEditingForm({ ...editingForm, phone: event.target.value })}
                          />
                          <input
                            className={cheffingInputClassName}
                            value={editingForm.email}
                            placeholder="Email"
                            onChange={(event) => setEditingForm({ ...editingForm, email: event.target.value })}
                          />
                        </div>
                      ) : (
                        <span>
                          {supplier.phone ?? '-'} / {supplier.email ?? '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {isEditing ? (
                        <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                          <input
                            type="checkbox"
                            checked={editingForm.is_active}
                            onChange={(event) => setEditingForm({ ...editingForm, is_active: event.target.checked })}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-primary-500 focus:ring-primary-500/30"
                          />
                          Activo
                        </label>
                      ) : (
                        <StatusBadge tone={supplier.is_active ? 'success' : 'muted'}>
                          {supplier.is_active ? 'Activo' : 'Inactivo'}
                        </StatusBadge>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <CheffingButton
                              type="button"
                              tone="success"
                              onClick={() => updateSupplier(supplier.id)}
                              disabled={isSubmitting}
                            >
                              Guardar
                            </CheffingButton>
                            <CheffingTableActionButton
                              type="button"
                              onClick={() => setEditingId(null)}
                              aria-label="Cancelar edicion"
                              title="Cancelar"
                            >
                              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                            </CheffingTableActionButton>
                          </>
                        ) : (
                          <CheffingTableActionButton
                            type="button"
                            onClick={() => {
                              setEditingId(supplier.id);
                              setEditingForm({
                                trade_name: supplier.trade_name,
                                legal_name: supplier.legal_name ?? '',
                                tax_id: supplier.tax_id ?? '',
                                phone: supplier.phone ?? '',
                                email: supplier.email ?? '',
                                is_active: supplier.is_active,
                              });
                            }}
                          >
                            <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                            Editar
                          </CheffingTableActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
