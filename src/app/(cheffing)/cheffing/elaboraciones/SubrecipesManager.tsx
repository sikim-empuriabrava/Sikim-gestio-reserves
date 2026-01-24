'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { Subrecipe, Unit, UnitDimension } from '@/lib/cheffing/types';

const baseUnitLabelByDimension: Record<UnitDimension, string> = {
  mass: 'g',
  volume: 'ml',
  unit: 'u',
};

export type SubrecipeCost = Subrecipe & {
  output_unit_dimension: UnitDimension | null;
  output_unit_factor: number | null;
  items_cost_total: number | null;
  cost_gross_per_base: number | null;
  cost_net_per_base: number | null;
  waste_factor: number | null;
};

type SubrecipesManagerProps = {
  initialSubrecipes: SubrecipeCost[];
  units: Unit[];
};

type SubrecipeFormState = {
  name: string;
  output_unit_code: string;
  output_qty: string;
  waste_pct: string;
};

export function SubrecipesManager({ initialSubrecipes, units }: SubrecipesManagerProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<SubrecipeFormState | null>(null);
  const [formState, setFormState] = useState<SubrecipeFormState>({
    name: '',
    output_unit_code: units[0]?.code ?? 'g',
    output_qty: '1',
    waste_pct: '0',
  });

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

  const resetForm = () => {
    setFormState({
      name: '',
      output_unit_code: units[0]?.code ?? 'g',
      output_qty: '1',
      waste_pct: '0',
    });
  };

  const parseWastePct = (value: string) => {
    const percentValue = Number(value);
    if (!Number.isFinite(percentValue) || percentValue < 0 || percentValue >= 100) {
      return null;
    }
    return percentValue / 100;
  };

  const ensureValidQuantity = (value: string) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return null;
    }
    return numericValue;
  };

  const submitNewSubrecipe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const outputQtyValue = ensureValidQuantity(formState.output_qty);
      if (outputQtyValue === null) {
        throw new Error('La producción debe ser mayor que 0.');
      }

      const wastePctValue = parseWastePct(formState.waste_pct);
      if (wastePctValue === null) {
        throw new Error('La merma debe estar entre 0 y 99,99%.');
      }

      const response = await fetch('/api/cheffing/subrecipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name,
          output_unit_code: formState.output_unit_code,
          output_qty: outputQtyValue,
          waste_pct: wastePctValue,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error('Ya existe una elaboración con ese nombre.');
        }
        throw new Error(payload?.error ?? 'Error creando elaboración');
      }

      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (subrecipe: SubrecipeCost) => {
    setEditingId(subrecipe.id);
    setEditingState({
      name: subrecipe.name,
      output_unit_code: subrecipe.output_unit_code,
      output_qty: String(subrecipe.output_qty),
      waste_pct: String((subrecipe.waste_pct * 100).toFixed(2)),
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingState(null);
  };

  const saveEditing = async (subrecipeId: string) => {
    if (!editingState) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const outputQtyValue = ensureValidQuantity(editingState.output_qty);
      if (outputQtyValue === null) {
        throw new Error('La producción debe ser mayor que 0.');
      }

      const wastePctValue = parseWastePct(editingState.waste_pct);
      if (wastePctValue === null) {
        throw new Error('La merma debe estar entre 0 y 99,99%.');
      }

      const response = await fetch(`/api/cheffing/subrecipes/${subrecipeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingState.name,
          output_unit_code: editingState.output_unit_code,
          output_qty: outputQtyValue,
          waste_pct: wastePctValue,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error('Ya existe una elaboración con ese nombre.');
        }
        throw new Error(payload?.error ?? 'Error actualizando elaboración');
      }

      cancelEditing();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteSubrecipe = async (subrecipeId: string) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const confirmed = window.confirm('¿Seguro que quieres eliminar esta elaboración?');
      if (!confirmed) {
        return;
      }
      const response = await fetch(`/api/cheffing/subrecipes/${subrecipeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Error eliminando elaboración');
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
        onSubmit={submitNewSubrecipe}
        className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Nueva elaboración</h3>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Nombre
            <input
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Ej. Cebolla caramelizada"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Producción
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-28 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                value={formState.output_qty}
                onChange={(event) => setFormState((prev) => ({ ...prev, output_qty: event.target.value }))}
                required
              />
              <select
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                value={formState.output_unit_code}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, output_unit_code: event.target.value }))
                }
              >
                {sortedUnits.map((unit) => (
                  <option key={unit.code} value={unit.code}>
                    {unit.code} · {unit.name ?? unit.code}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Merma (%)
            <input
              type="number"
              min="0"
              max="99.99"
              step="0.01"
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
              value={formState.waste_pct}
              onChange={(event) => setFormState((prev) => ({ ...prev, waste_pct: event.target.value }))}
              required
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Guardar elaboración
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-800/70">
        <table className="w-full min-w-[960px] text-left text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Elaboración</th>
              <th className="px-4 py-3">Producción</th>
              <th className="px-4 py-3">Merma</th>
              <th className="px-4 py-3">Coste total</th>
              <th className="px-4 py-3">Coste unitario</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {initialSubrecipes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                  No hay elaboraciones todavía.
                </td>
              </tr>
            ) : (
              initialSubrecipes.map((subrecipe) => {
                const isEditing = editingId === subrecipe.id;
                const editingValues = isEditing ? editingState : null;
                const baseUnit = baseUnitLabel(subrecipe.output_unit_dimension);

                return (
                  <tr key={subrecipe.id} className="border-t border-slate-800/60">
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
                        <Link href={`/cheffing/elaboraciones/${subrecipe.id}`} className="font-semibold text-white">
                          {subrecipe.name}
                        </Link>
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
                            value={editingValues?.output_qty ?? ''}
                            onChange={(event) =>
                              setEditingState((prev) =>
                                prev ? { ...prev, output_qty: event.target.value } : prev,
                              )
                            }
                          />
                          <select
                            className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-white"
                            value={editingValues?.output_unit_code ?? ''}
                            onChange={(event) =>
                              setEditingState((prev) =>
                                prev ? { ...prev, output_unit_code: event.target.value } : prev,
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
                        `${subrecipe.output_qty} ${subrecipe.output_unit_code}`
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
                        `${(subrecipe.waste_pct * 100).toFixed(1)}%`
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-100">
                      {formatCurrency(subrecipe.items_cost_total)} €
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {formatCurrency(subrecipe.cost_net_per_base)} €/ {baseUnit}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEditing(subrecipe.id)}
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
                              href={`/cheffing/elaboraciones/${subrecipe.id}`}
                              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200"
                            >
                              Ver
                            </Link>
                            <button
                              type="button"
                              onClick={() => startEditing(subrecipe)}
                              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSubrecipe(subrecipe.id)}
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
