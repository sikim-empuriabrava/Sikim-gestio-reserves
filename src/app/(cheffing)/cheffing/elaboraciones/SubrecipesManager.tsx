'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  EyeIcon,
  PencilSquareIcon,
  PhotoIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import { DataTableShell, StatusBadge, Toolbar, cn } from '@/components/ui';
import type { Subrecipe, Unit, UnitDimension } from '@/lib/cheffing/types';
import { normalizeSearchText } from '@/lib/cheffing/search';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import {
  CheffingButton,
  CheffingEmptyState,
  CheffingSearchInput,
  CheffingTableActionButton,
  CheffingTableActionLink,
  cheffingEditingRowClassName,
  cheffingHeaderButtonClassName,
  cheffingInputClassName,
  cheffingNumericClassName,
  cheffingRowClassName,
  cheffingSelectClassName,
  cheffingTableClassName,
  cheffingTheadClassName,
} from '@/app/(cheffing)/cheffing/components/CheffingUi';

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

const sortLabelByKey: Record<SubrecipeSortKey, string> = {
  name: 'Nombre',
  output_qty: 'Producción',
  waste_pct: 'Merma',
  items_cost_total: 'Coste total',
  cost_net_per_base: 'Coste unitario',
};

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
    if (value === null || Number.isNaN(value)) return '-';
    return value.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatInternalCost = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '-';
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
        secondary: `Coste base interno: ${formatInternalCost(costPerBase)} \u20ac/g`,
      };
    }

    if (dimension === 'volume') {
      return {
        value: costPerBase * 1000,
        unit: displayUnitByDimension[dimension],
        secondary: `Coste base interno: ${formatInternalCost(costPerBase)} \u20ac/ml`,
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
        throw new Error('La produccion debe ser mayor que 0.');
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
          throw new Error('Ya existe una elaboracion con ese nombre.');
        }
        throw new Error(payload?.error ?? 'Error actualizando elaboracion');
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
      const confirmed = window.confirm('Seguro que quieres eliminar esta elaboracion?');
      if (!confirmed) {
        return;
      }
      const response = await fetch(`/api/cheffing/subrecipes/${subrecipeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Error eliminando elaboracion');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const indicator = (key: SubrecipeSortKey) => {
    if (sortState.key !== key) return '<>';
    return sortState.direction === 'asc' ? '^' : 'v';
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
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100">
          {error}
        </div>
      ) : null}

      <DataTableShell
        title="Listado de elaboraciones"
        description="Producciones internas, merma y coste base reutilizable."
        toolbar={
          <Toolbar
            leading={
              <CheffingSearchInput
                label="Buscar elaboración por nombre"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar elaboración por nombre"
                className="w-full xl:w-[420px]"
              />
            }
            actions={
              <StatusBadge tone={searchTerm ? 'accent' : 'muted'}>
                {filteredAndSortedSubrecipes.length} visibles
              </StatusBadge>
            }
          />
        }
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Mostrando {filteredAndSortedSubrecipes.length} de {initialSubrecipes.length} elaboraciones
            </span>
            <span>
              Orden: {sortLabelByKey[sortState.key]} {sortState.direction === 'asc' ? 'ascendente' : 'descendente'}
            </span>
          </div>
        }
      >
        <table className={cn(cheffingTableClassName, 'min-w-[1000px]')}>
          <thead className={cheffingTheadClassName}>
            <tr className="border-b border-slate-800/80">
              <th className="w-[32%] px-4 py-3">
                <button type="button" className={cheffingHeaderButtonClassName} onClick={() => handleSort('name')}>
                  Elaboración <span className="text-[10px] text-primary-200">{indicator('name')}</span>
                </button>
              </th>
              <th className="px-4 py-3 font-semibold text-slate-300">Imagen</th>
              <th className="px-4 py-3">
                <button type="button" className={cheffingHeaderButtonClassName} onClick={() => handleSort('output_qty')}>
                  Producción <span className="text-[10px] text-primary-200">{indicator('output_qty')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" className={cheffingHeaderButtonClassName} onClick={() => handleSort('waste_pct')}>
                  Merma <span className="text-[10px] text-primary-200">{indicator('waste_pct')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className={cheffingHeaderButtonClassName}
                  onClick={() => handleSort('items_cost_total')}
                >
                  Coste total <span className="text-[10px] text-primary-200">{indicator('items_cost_total')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  className={cheffingHeaderButtonClassName}
                  onClick={() => handleSort('cost_net_per_base')}
                >
                  Coste unitario <span className="text-[10px] text-primary-200">{indicator('cost_net_per_base')}</span>
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/20">
            {initialSubrecipes.length === 0 ? (
              <CheffingEmptyState
                colSpan={7}
                title="No hay elaboraciones todavía."
                description="Crea una elaboración para reutilizarla en platos."
              />
            ) : filteredAndSortedSubrecipes.length === 0 ? (
              <CheffingEmptyState
                colSpan={7}
                title="No hay elaboraciones para esta búsqueda."
                description="Prueba con otro nombre o limpia el filtro."
              />
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
                  <tr
                    key={subrecipe.id}
                    className={cn(cheffingRowClassName, isEditing && cheffingEditingRowClassName)}
                  >
                    <td className="px-4 py-3 align-middle">
                      {isEditing ? (
                        <input
                          aria-label="Nombre de la elaboración"
                          className={cheffingInputClassName}
                          value={editingValues?.name ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                          }
                        />
                      ) : (
                        <Link
                          href={`/cheffing/elaboraciones/${subrecipe.id}`}
                          className="font-semibold text-white underline-offset-4 transition hover:text-primary-100 hover:underline"
                        >
                          {subrecipe.name}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={`Imagen de ${subrecipe.name}`}
                          className="h-10 w-10 rounded-lg border border-slate-700/80 object-cover"
                        />
                      ) : (
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/70 text-slate-600">
                          <PhotoIcon className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Sin imagen</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-300">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            aria-label="Cantidad producida"
                            className={cn(cheffingInputClassName, 'w-24')}
                            value={editingValues?.output_qty ?? ''}
                            onChange={(event) =>
                              setEditingState((prev) =>
                                prev ? { ...prev, output_qty: event.target.value } : prev,
                              )
                            }
                          />
                          <select
                            aria-label="Unidad de producción"
                            className={cn(cheffingSelectClassName, 'w-24')}
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
                        <span className="font-medium text-slate-200">
                          {subrecipe.output_qty} {subrecipe.output_unit_code}
                        </span>
                      )}
                    </td>
                    <td className={cn('px-4 py-3 align-middle', cheffingNumericClassName)}>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          max="99.99"
                          step="0.01"
                          aria-label="Merma"
                          className={cn(cheffingInputClassName, 'w-20')}
                          value={editingValues?.waste_pct ?? ''}
                          onChange={(event) =>
                            setEditingState((prev) => (prev ? { ...prev, waste_pct: event.target.value } : prev))
                          }
                        />
                      ) : (
                        `${(subrecipe.waste_pct * 100).toFixed(1)}%`
                      )}
                    </td>
                    <td className={cn('px-4 py-3 align-middle', cheffingNumericClassName)}>
                      {formatDisplayCost(subrecipe.items_cost_total)} &euro;
                    </td>
                    <td className="px-4 py-3 align-middle tabular-nums text-slate-100">
                      <div className="inline-flex items-center gap-1">
                        <span>
                          {formatDisplayCost(netDisplayCost.value)} &euro;/{netDisplayCost.unit}
                        </span>
                        {netDisplayCost.secondary ? (
                          <span className="group relative inline-flex items-center">
                            <button
                              type="button"
                              aria-label="Ver coste base interno"
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[10px] font-semibold text-slate-300 transition hover:border-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20"
                            >
                              i
                            </button>
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-52 rounded-md border border-slate-700 bg-slate-950/95 p-2 text-[11px] normal-case text-slate-200 opacity-0 shadow-lg shadow-slate-950/40 transition-opacity delay-700 group-hover:opacity-100 group-focus-within:opacity-100"
                            >
                              {netDisplayCost.secondary}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <CheffingButton
                              type="button"
                              tone="success"
                              onClick={() => saveEditing(subrecipe.id)}
                              disabled={isSubmitting}
                            >
                              Guardar
                            </CheffingButton>
                            <CheffingTableActionButton
                              type="button"
                              onClick={cancelEditing}
                              aria-label="Cancelar edicion"
                              title="Cancelar"
                            >
                              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                            </CheffingTableActionButton>
                          </>
                        ) : (
                          <>
                            <CheffingTableActionLink href={`/cheffing/elaboraciones/${subrecipe.id}`}>
                              <EyeIcon className="h-4 w-4" aria-hidden="true" />
                              Ver
                            </CheffingTableActionLink>
                            <CheffingTableActionButton type="button" onClick={() => startEditing(subrecipe)}>
                              <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                              Editar
                            </CheffingTableActionButton>
                            <CheffingTableActionButton
                              type="button"
                              tone="danger"
                              onClick={() => deleteSubrecipe(subrecipe.id)}
                              disabled={isSubmitting}
                            >
                              <TrashIcon className="h-4 w-4" aria-hidden="true" />
                              Eliminar
                            </CheffingTableActionButton>
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
      </DataTableShell>
    </div>
  );
}
