'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { Subrecipe, Unit, UnitDimension } from '@/lib/cheffing/types';
import { normalizeSearchText } from '@/lib/cheffing/search';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

const displayUnitByDimension: Record<UnitDimension, 'kg' | 'l' | 'u'> = {
  mass: 'kg',
  volume: 'l',
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

type SortDirection = 'asc' | 'desc';
type SubrecipeSortKey =
  | 'name'
  | 'output_qty'
  | 'waste_pct'
  | 'items_cost_total'
  | 'cost_net_per_base';

export function SubrecipesManager({ initialSubrecipes, units }: SubrecipesManagerProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<SubrecipeFormState | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortState, setSortState] = useState<{ key: SubrecipeSortKey; direction: SortDirection }>({
    key: 'name',
    direction: 'asc',
  });

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const sortedUnits = useMemo(() => {
    return [...units].sort((a, b) => a.code.localeCompare(b.code));
  }, [units]);

  const formatDisplayCost = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—';
    return value.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatInternalCost = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—';
    return value.toLocaleString('es-ES', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  const resolveDisplayCost = (costPerBase: number | null, dimension: UnitDimension | null) => {
    if (costPerBase === null || Number.isNaN(costPerBase) || !dimension) {
      return { value: null, unit: '-', secondary: null as string | null };
    }

    if (dimension === 'mass') {
      return {
        value: costPerBase * 1000,
        unit: displayUnitByDimension[dimension],
        secondary: `Coste base interno: ${formatInternalCost(costPerBase)} €/g`,
      };
    }

    if (dimension === 'volume') {
      return {
        value: costPerBase * 1000,
        unit: displayUnitByDimension[dimension],
        secondary: `Coste base interno: ${formatInternalCost(costPerBase)} €/ml`,
      };
    }

    return {
      value: costPerBase,
      unit: displayUnitByDimension[dimension],
      secondary: null,
    };
  };

  const resolveImageUrl = (subrecipe: SubrecipeCost) => {
    if (!subrecipe.image_path) return null;
    const { data } = supabase.storage.from('cheffing-images').getPublicUrl(subrecipe.image_path);
    const cacheKey = subrecipe.updated_at ?? Date.now().toString();
    return `${data.publicUrl}?v=${encodeURIComponent(cacheKey)}`;
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

  const indicator = (key: SubrecipeSortKey) => {
    if (sortState.key !== key) return '↕';
    return sortState.direction === 'asc' ? '↑' : '↓';
  };

  const handleSort = (key: SubrecipeSortKey) => {
    setSortState((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const filteredAndSortedSubrecipes = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchTerm);
    const filteredSubrecipes =
      normalizedQuery.length === 0
        ? initialSubrecipes
        : initialSubrecipes.filter((subrecipe) => normalizeSearchText(subrecipe.name).includes(normalizedQuery));

    const directionMultiplier = sortState.direction === 'asc' ? 1 : -1;
    return [...filteredSubrecipes].sort((a, b) => {
      let result = 0;
      switch (sortState.key) {
        case 'name':
          result = a.name.localeCompare(b.name, 'es');
          break;
        default: {
          const aValue = a[sortState.key] ?? 0;
          const bValue = b[sortState.key] ?? 0;
          result = aValue - bValue;
          break;
        }
      }
      if (result === 0) {
        return a.name.localeCompare(b.name, 'es');
      }
      return result * directionMultiplier;
    });
  }, [initialSubrecipes, searchTerm, sortState]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/cheffing/elaboraciones/new"
          className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
        >
          Nueva elaboración
        </Link>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar elaboración por nombre"
          className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500"
        />
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800/70">
        <table className="w-full min-w-[1000px] text-left text-sm text-slate-200">
          <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">
                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('name')}>
                  Elaboración <span className="text-[10px]">{indicator('name')}</span>
                </button>
              </th>
              <th className="px-4 py-3">Imagen</th>
              <th className="px-4 py-3">
                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('output_qty')}>
                  Producción <span className="text-[10px]">{indicator('output_qty')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort('waste_pct')}>
                  Merma <span className="text-[10px]">{indicator('waste_pct')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => handleSort('items_cost_total')}
                >
                  Coste total <span className="text-[10px]">{indicator('items_cost_total')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => handleSort('cost_net_per_base')}
                >
                  Coste unitario <span className="text-[10px]">{indicator('cost_net_per_base')}</span>
                </button>
              </th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {initialSubrecipes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                  No hay elaboraciones todavía.
                </td>
              </tr>
            ) : filteredAndSortedSubrecipes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                  No hay elaboraciones que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              filteredAndSortedSubrecipes.map((subrecipe) => {
                const isEditing = editingId === subrecipe.id;
                const editingValues = isEditing ? editingState : null;
                const imageUrl = resolveImageUrl(subrecipe);
                const netDisplayCost = resolveDisplayCost(
                  subrecipe.cost_net_per_base,
                  subrecipe.output_unit_dimension,
                );

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
                    <td className="px-4 py-3">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={`Imagen de ${subrecipe.name}`}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
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
                      {formatDisplayCost(subrecipe.items_cost_total)} €
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div className="inline-flex items-center gap-1">
                        <span>
                          {formatDisplayCost(netDisplayCost.value)} €/{netDisplayCost.unit}
                        </span>
                        {netDisplayCost.secondary ? (
                          <span className="group relative inline-flex items-center">
                            <button
                              type="button"
                              aria-label="Ver coste base interno"
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[10px] font-semibold text-slate-300"
                            >
                              i
                            </button>
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-52 rounded-md border border-slate-700 bg-slate-950/95 p-2 text-[11px] normal-case text-slate-200 opacity-0 shadow-lg transition-opacity delay-700 group-hover:opacity-100 group-focus-within:opacity-100"
                            >
                              {netDisplayCost.secondary}
                            </span>
                          </span>
                        ) : null}
                      </div>
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
