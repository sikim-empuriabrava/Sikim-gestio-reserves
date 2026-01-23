'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { Dish } from '@/lib/cheffing/types';

type DishCost = Dish & {
  items_cost_total: number | null;
};

type DishesManagerProps = {
  initialDishes: DishCost[];
};

type DishFormState = {
  name: string;
  selling_price: string;
};

export function DishesManager({ initialDishes }: DishesManagerProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<DishFormState | null>(null);
  const [formState, setFormState] = useState<DishFormState>({
    name: '',
    selling_price: '',
  });

  const formatCurrency = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—';
    return `${value.toFixed(2)} €`;
  };

  const submitNewDish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const sellingPriceValue =
        formState.selling_price.trim() === '' ? null : Number(formState.selling_price);

      const response = await fetch('/api/cheffing/dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name,
          selling_price: sellingPriceValue,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error('Ya existe un plato con ese nombre.');
        }
        throw new Error(payload?.error ?? 'Error creando plato');
      }

      setFormState({ name: '', selling_price: '' });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (dish: DishCost) => {
    setEditingId(dish.id);
    setEditingState({
      name: dish.name,
      selling_price: dish.selling_price === null ? '' : String(dish.selling_price),
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingState(null);
  };

  const saveEditing = async (dishId: string) => {
    if (!editingState) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const sellingPriceValue =
        editingState.selling_price.trim() === '' ? null : Number(editingState.selling_price);

      const response = await fetch(`/api/cheffing/dishes/${dishId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingState.name,
          selling_price: sellingPriceValue,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error('Ya existe un plato con ese nombre.');
        }
        throw new Error(payload?.error ?? 'Error actualizando plato');
      }

      cancelEditing();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteDish = async (dishId: string) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/cheffing/dishes/${dishId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Error eliminando plato');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={submitNewDish}
        className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Nuevo plato</h3>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Nombre
            <input
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Ej. Burger X"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            PVP (€)
            <input
              type="number"
              min="0"
              step="0.01"
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.selling_price}
              onChange={(event) => setFormState((prev) => ({ ...prev, selling_price: event.target.value }))}
              placeholder="Opcional"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Guardar plato
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-800/70">
        <table className="w-full min-w-[840px] text-left text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Plato</th>
              <th className="px-4 py-3">PVP</th>
              <th className="px-4 py-3">Coste total</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {initialDishes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                  No hay platos todavía.
                </td>
              </tr>
            ) : (
              initialDishes.map((dish) => {
                const isEditing = editingId === dish.id;
                const editingValues = isEditing ? editingState : null;

                return (
                  <tr key={dish.id} className="border-t border-slate-800/60">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                          value={editingValues?.name ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                          }
                        />
                      ) : (
                        <Link href={`/cheffing/platos/${dish.id}`} className="font-semibold text-white">
                          {dish.name}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-32 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                          value={editingValues?.selling_price ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) => (prev ? { ...prev, selling_price: event.target.value } : prev))
                          }
                        />
                      ) : (
                        formatCurrency(dish.selling_price)
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-100">
                      {formatCurrency(dish.items_cost_total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEditing(dish.id)}
                              disabled={isSubmitting}
                              className="rounded-full border border-emerald-400/60 px-3 py-1 text-xs font-semibold text-emerald-200"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <Link
                              href={`/cheffing/platos/${dish.id}`}
                              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200"
                            >
                              Ver
                            </Link>
                            <button
                              type="button"
                              onClick={() => startEditing(dish)}
                              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteDish(dish.id)}
                              disabled={isSubmitting}
                              className="rounded-full border border-rose-500/70 px-3 py-1 text-xs font-semibold text-rose-200"
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
