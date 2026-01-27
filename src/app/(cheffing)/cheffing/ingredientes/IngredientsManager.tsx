'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { IngredientCost, Unit, UnitDimension } from '@/lib/cheffing/types';

const baseUnitLabelByDimension: Record<UnitDimension, string> = {
  mass: 'g',
  volume: 'ml',
  unit: 'u',
};

type IngredientsManagerProps = {
  initialIngredients: IngredientCost[];
  units: Unit[];
};

type IngredientFormState = {
  name: string;
  purchase_unit_code: string;
  purchase_pack_qty: string;
  purchase_price: string;
  waste_pct: string;
};

export function IngredientsManager({ initialIngredients, units }: IngredientsManagerProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<IngredientFormState | null>(null);

  const sortedUnits = useMemo(() => {
    return [...units].sort((a, b) => a.code.localeCompare(b.code));
  }, [units]);

  const baseUnitLabel = (dimension: UnitDimension | null) => {
    if (!dimension) return '-';
    return baseUnitLabelByDimension[dimension] ?? '-';
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—';
    return value.toFixed(4);
  };

  const formatFactor = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—';
    return value.toFixed(3);
  };

  const parseWastePct = (value: string) => {
    const percentValue = Number(value);
    if (!Number.isFinite(percentValue) || percentValue < 0 || percentValue >= 100) {
      return null;
    }
    return percentValue / 100;
  };

  const startEditing = (ingredient: IngredientCost) => {
    setEditingId(ingredient.id);
    setEditingState({
      name: ingredient.name,
      purchase_unit_code: ingredient.purchase_unit_code,
      purchase_pack_qty: String(ingredient.purchase_pack_qty),
      purchase_price: String(ingredient.purchase_price),
      waste_pct: String((ingredient.waste_pct * 100).toFixed(2)),
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingState(null);
  };

  const saveEditing = async (ingredientId: string) => {
    if (!editingState) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const wastePctValue = parseWastePct(editingState.waste_pct);
      if (wastePctValue === null) {
        throw new Error('La merma debe estar entre 0 y 99,99%.');
      }

      const response = await fetch(`/api/cheffing/ingredients/${ingredientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingState.name,
          purchase_unit_code: editingState.purchase_unit_code,
          purchase_pack_qty: Number(editingState.purchase_pack_qty),
          purchase_price: Number(editingState.purchase_price),
          waste_pct: wastePctValue,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error('Ya existe un ingrediente con ese nombre.');
        }
        throw new Error(payload?.error ?? 'Error actualizando ingrediente');
      }

      cancelEditing();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteIngredient = async (ingredientId: string) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/cheffing/ingredients/${ingredientId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Error eliminando ingrediente');
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/cheffing/ingredientes/new"
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
        >
          Nuevo ingrediente
        </Link>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800/70">
        <table className="w-full min-w-[960px] text-left text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Ingrediente</th>
              <th className="px-4 py-3">Compra</th>
              <th className="px-4 py-3">Precio pack</th>
              <th className="px-4 py-3">Merma</th>
              <th className="px-4 py-3">FC</th>
              <th className="px-4 py-3">Coste base bruto</th>
              <th className="px-4 py-3">Coste base neto</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {initialIngredients.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                  No hay ingredientes todavía.
                </td>
              </tr>
            ) : (
              initialIngredients.map((ingredient) => {
                const isEditing = editingId === ingredient.id;
                const editingValues = isEditing ? editingState : null;
                const baseUnit = baseUnitLabel(ingredient.purchase_unit_dimension);

                return (
                  <tr key={ingredient.id} className="border-t border-slate-800/60">
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
                        <span className="font-semibold text-white">{ingredient.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                            value={editingValues?.purchase_pack_qty ?? ''}
                            onChange={(event) =>
                              setEditingState((prev) =>
                                prev ? { ...prev, purchase_pack_qty: event.target.value } : prev,
                              )
                            }
                          />
                          <select
                            className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                            value={editingValues?.purchase_unit_code ?? ''}
                            onChange={(event) =>
                              setEditingState((prev) =>
                                prev ? { ...prev, purchase_unit_code: event.target.value } : prev,
                              )
                            }
                          >
                            {sortedUnits.map((unit) => (
                              <option key={unit.code} value={unit.code}>
                                {unit.code}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        `${ingredient.purchase_pack_qty} ${ingredient.purchase_unit_code}`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-24 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                          value={editingValues?.purchase_price ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) =>
                              prev ? { ...prev, purchase_price: event.target.value } : prev,
                            )
                          }
                        />
                      ) : (
                        `${ingredient.purchase_price.toFixed(2)} €`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          max="99.99"
                          step="0.01"
                          className="w-20 rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                          value={editingValues?.waste_pct ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) => (prev ? { ...prev, waste_pct: event.target.value } : prev))
                          }
                        />
                      ) : (
                        `${(ingredient.waste_pct * 100).toFixed(1)}%`
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-100">
                      {formatFactor(ingredient.waste_factor)}x
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {formatCurrency(ingredient.cost_gross_per_base)} €/ {baseUnit}
                    </td>
                    <td className="px-4 py-3 text-slate-100">
                      {formatCurrency(ingredient.cost_net_per_base)} €/ {baseUnit}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEditing(ingredient.id)}
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
                            <button
                              type="button"
                              onClick={() => startEditing(ingredient)}
                              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteIngredient(ingredient.id)}
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
